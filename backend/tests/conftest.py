"""测试夹具 — 内存 SQLite，每次测试独立"""
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.database import Base
from app.models.job import Job, JobStatus
from app.models.candidate import Candidate
from app.models.resume import Resume

# 内存 SQLite：每次测试完全隔离
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="function")
async def db() -> AsyncSession:
    """每个测试函数独立的内存数据库 session"""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def seed_data(db: AsyncSession) -> dict:
    """每个测试前插入一份最小基础数据（岗位 + 候选人 + 简历）"""
    job = Job(
        title="Python 后端工程师",
        department="技术部",
        status=JobStatus.active,
        jd_body="# 岗位描述\n\n负责后端服务开发，要求 3 年以上 Python 经验。" * 3,
        created_by=1,
    )
    candidate = Candidate(
        name="张三",
        email="zhangsan@example.com",
        phone="13800138000",
    )
    db.add_all([job, candidate])
    await db.flush()

    resume = Resume(
        candidate_id=candidate.id,
        original_filename="zhangsan_resume.pdf",
        file_path="/uploads/zhangsan_resume.pdf",
        file_size=1024,
        parse_status="pending",
        uploaded_by=1,
    )
    db.add(resume)
    await db.flush()

    return {
        "job_id": job.id,
        "candidate_id": candidate.id,
        "resume_id": resume.id,
    }
