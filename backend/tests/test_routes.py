"""路由集成测试 — TestClient + 内存 SQLite 端到端"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def client():
    """每个测试独立的内存数据库 + AsyncClient"""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await engine.dispose()
    app.dependency_overrides.clear()


# ═══════════════════════════════════════════
# 认证流程
# ═══════════════════════════════════════════

async def test_register_and_login(client: AsyncClient):
    """注册 → 登录 → 拿到 token"""
    resp = await client.post("/api/auth/register", json={
        "email": "hr@test.com",
        "full_name": "HR 张三",
        "password": "pass123",
        "role": "hr",
        "department": "技术部",
    })
    assert resp.status_code == 201
    assert resp.json()["email"] == "hr@test.com"

    resp = await client.post("/api/auth/login", data={
        "username": "hr@test.com",
        "password": "pass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_duplicate_register_rejected(client: AsyncClient):
    """重复注册同一邮箱 → 409"""
    payload = {"email": "dup@test.com", "full_name": "T",
               "password": "pwd", "role": "hr", "department": "技术部"}
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 201
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


async def test_login_wrong_password(client: AsyncClient):
    """错误密码 → 401"""
    await client.post("/api/auth/register", json={
        "email": "wrong@test.com", "full_name": "T",
        "password": "correct", "role": "hr", "department": "技术部",
    })
    resp = await client.post("/api/auth/login", data={
        "username": "wrong@test.com", "password": "wrong",
    })
    assert resp.status_code == 401


# ═══════════════════════════════════════════
# 辅助：获取 HR token
# ═══════════════════════════════════════════

async def _get_token(client: AsyncClient, role="hr") -> str:
    email = f"{role}@test.token"
    await client.post("/api/auth/register", json={
        "email": email, "full_name": role,
        "password": "pwd", "role": role, "department": "技术部",
    })
    resp = await client.post("/api/auth/login", data={
        "username": email, "password": "pwd",
    })
    return resp.json()["access_token"]


# ═══════════════════════════════════════════
# 岗位 CRUD
# ═══════════════════════════════════════════

async def test_create_job(client: AsyncClient):
    token = await _get_token(client, "hr")
    resp = await client.post("/api/jobs/", json={
        "title": "Python 后端",
        "department": "技术部",
        "jd_body": "# JD\n" + "负责后端开发。要求 Python 经验。" * 8,
        "required_skills": ["Python", "FastAPI"],
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    assert resp.json()["title"] == "Python 后端"


async def test_create_job_short_jd_rejected(client: AsyncClient):
    """JD 少于 100 字 → 422"""
    token = await _get_token(client, "hr")
    resp = await client.post("/api/jobs/", json={
        "title": "测试", "department": "技术部", "jd_body": "太短",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 422


async def test_list_jobs(client: AsyncClient):
    token = await _get_token(client, "hr")
    await client.post("/api/jobs/", json={
        "title": "岗位A", "department": "技术部",
        "jd_body": "# JD\n" + "要求 Python。" * 10,
    }, headers={"Authorization": f"Bearer {token}"})
    resp = await client.get("/api/jobs/",
        headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


# ═══════════════════════════════════════════
# 候选人
# ═══════════════════════════════════════════

async def test_create_candidate(client: AsyncClient):
    token = await _get_token(client, "hr")
    resp = await client.post("/api/candidates/", json={
        "name": "张三", "email": "zs@test.com", "phone": "13800138000",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "张三"


# ═══════════════════════════════════════════
# 简历上传
# ═══════════════════════════════════════════

async def test_upload_resume_pdf(client: AsyncClient):
    token = await _get_token(client, "hr")
    resp = await client.post("/api/resumes/upload",
        files={"file": ("test.pdf", b"%PDF-1.4 fake pdf content for test xxxxxx", "application/pdf")},
        data={"candidate_id": "1"},
        headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    assert resp.json()["parse_status"] in ("success", "pending", "failed")


async def test_upload_resume_bad_format_rejected(client: AsyncClient):
    token = await _get_token(client, "hr")
    resp = await client.post("/api/resumes/upload",
        files={"file": ("test.exe", b"bad", "application/octet-stream")},
        headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400


# ═══════════════════════════════════════════
# 投递 + 状态流转（端到端）
# ═══════════════════════════════════════════

async def test_full_application_flow(client: AsyncClient):
    """创建岗位 → 候选人 → 简历 → 投递 → 状态流转"""
    token = await _get_token(client, "hr")

    # 1) 岗位
    resp = await client.post("/api/jobs/", json={
        "title": "测试岗位", "department": "技术部",
        "jd_body": "# JD\n" + "要求 Python。" * 10,
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    job_id = resp.json()["id"]

    # 2) 候选人
    resp = await client.post("/api/candidates/", json={
        "name": "张三",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    candidate_id = resp.json()["id"]

    # 3) 简历
    resp = await client.post("/api/resumes/upload",
        files={"file": ("test.pdf", b"%PDF-1.4 fake pdf content for testing", "application/pdf")},
        data={"candidate_id": str(candidate_id)},
        headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    resume_id = resp.json()["id"]

    # 4) 投递
    resp = await client.post("/api/applications/", json={
        "job_id": job_id, "candidate_id": candidate_id, "resume_id": resume_id,
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    app_id = resp.json()["id"]
    assert resp.json()["status"] == "submitted"

    # 5) 推进到 ai_scoring
    resp = await client.patch(f"/api/applications/{app_id}/status", json={
        "new_status": "ai_scoring",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


async def test_duplicate_application_rejected(client: AsyncClient):
    """重复投递 → 409"""
    token = await _get_token(client, "hr")
    resp = await client.post("/api/jobs/", json={
        "title": "唯一岗", "department": "技术部",
        "jd_body": "# JD\n" + "要求 Python。" * 10,
    }, headers={"Authorization": f"Bearer {token}"})
    job_id = resp.json()["id"]
    resp = await client.post("/api/candidates/", json={
        "name": "李四",
    }, headers={"Authorization": f"Bearer {token}"})
    candidate_id = resp.json()["id"]
    resp = await client.post("/api/resumes/upload",
        files={"file": ("r.pdf", b"%PDF-1.4 xxxxxxxxxxxxx", "application/pdf")},
        headers={"Authorization": f"Bearer {token}"})
    resume_id = resp.json()["id"]

    payload = {"job_id": job_id, "candidate_id": candidate_id, "resume_id": resume_id}
    resp = await client.post("/api/applications/", json=payload,
        headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    resp = await client.post("/api/applications/", json=payload,
        headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 409


async def test_illegal_transition_rejected(client: AsyncClient):
    """submitted → hired 非法跳转 → 422"""
    token = await _get_token(client, "hr")
    resp = await client.post("/api/jobs/", json={
        "title": "状态测试岗", "department": "技术部",
        "jd_body": "# JD\n" + "要求 Python。" * 10,
    }, headers={"Authorization": f"Bearer {token}"})
    job_id = resp.json()["id"]
    resp = await client.post("/api/candidates/", json={
        "name": "王五",
    }, headers={"Authorization": f"Bearer {token}"})
    candidate_id = resp.json()["id"]
    resp = await client.post("/api/resumes/upload",
        files={"file": ("r.pdf", b"%PDF-1.4 xxxxxxxxx", "application/pdf")},
        headers={"Authorization": f"Bearer {token}"})
    resume_id = resp.json()["id"]
    resp = await client.post("/api/applications/", json={
        "job_id": job_id, "candidate_id": candidate_id, "resume_id": resume_id,
    }, headers={"Authorization": f"Bearer {token}"})
    app_id = resp.json()["id"]

    resp = await client.patch(f"/api/applications/{app_id}/status", json={
        "new_status": "hired",
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 422


# ═══════════════════════════════════════════
# 未认证拒绝
# ═══════════════════════════════════════════

async def test_unauthenticated_rejected(client: AsyncClient):
    """无 token 访问受保护路由 → 401"""
    resp = await client.get("/api/jobs/")
    assert resp.status_code == 401
