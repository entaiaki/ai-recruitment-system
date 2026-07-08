"""数据访问控制测试

覆盖模块 A 的数据隔离要求和任务书中的合规约束：
- 简历是个人隐私数据，存储和传输要合规
- 用户只能看到被授权范围内的数据
- API 返回数据应按角色脱敏
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def get_token(role: str) -> str:
    response = client.post("/api/auth/login", json={
        "username": f"test_{role}",
        "password": "test_password"
    })
    assert response.status_code == 200
    return response.json()["access_token"]


# ── 简历数据访问控制 ─────────────────────────────────────────────

def test_hr_cannot_see_resume_of_other_department():
    """HR 不能查看其他部门上传的简历"""
    token = get_token("hr_dept_a")
    response = client.get(
        "/api/resumes/dept_b_resume_id",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403, (
        "HR 不应跨部门访问简历数据"
    )


def test_candidate_list_is_filtered_by_department():
    """候选人列表应按部门过滤"""
    token = get_token("hr_dept_a")
    response = client.get(
        "/api/candidates",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    for item in data.get("items", []):
        assert item.get("department") == "dept_a", (
            f"候选人列表包含其他部门数据: {item}"
        )


# ── 脱敏验证 ─────────────────────────────────────────────────────

def test_resume_phone_is_masked_for_non_owner():
    """简历中的手机号应对非直属 HR 脱敏"""
    token = get_token("analyst")
    response = client.get(
        "/api/analytics/candidate_summary",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    for item in data.get("candidates", []):
        phone = item.get("phone", "")
        # 脱敏后不应包含完整手机号（11 位连续数字）
        import re
        assert not re.search(r'\b1\d{10}\b', phone), (
            f"手机号未脱敏: {phone}"
        )


def test_resume_email_is_masked_for_analyst():
    """邮箱应对数据分析员脱敏"""
    token = get_token("analyst")
    response = client.get(
        "/api/analytics/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    for item in data.get("candidates", []):
        email = item.get("email", "")
        if "@" in email:
            # 应该脱敏为类似 t***@example.com 的格式
            assert "***" in email or email.count("@") == 0, (
                f"邮箱未脱敏: {email}"
            )


# ── 批量操作权限 ─────────────────────────────────────────────────

def test_hr_cannot_batch_export_other_dept_resumes():
    """HR 不能批量导出其他部门的简历"""
    token = get_token("hr_dept_a")
    response = client.post(
        "/api/resumes/export",
        json={"job_id": "dept_b_job_id"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403, (
        "HR 不应能导出其他部门简历"
    )


# ── 岗位数据访问控制 ─────────────────────────────────────────────

def test_leader_cannot_see_draft_jobs():
    """部门 Leader 不能看到草稿状态的岗位"""
    token = get_token("leader")
    response = client.get(
        "/api/jobs",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    for job in data.get("items", []):
        assert job.get("status") != "draft", (
            f"部门 Leader 看到了草稿岗位: {job}"
        )


def test_leader_cannot_see_closed_jobs_after_30_days():
    """已关闭超过 30 天的岗位不对部门 Leader 展示"""
    token = get_token("leader")
    response = client.get(
        "/api/jobs?include_closed=false",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    for job in data.get("items", []):
        assert job.get("status") != "closed", (
            f"部门 Leader 看到了已关闭岗位: {job}"
        )


# ── 操作日志完整性 ───────────────────────────────────────────────

def test_sensitive_operations_are_logged():
    """敏感操作必须有操作日志"""
    admin_token = get_token("admin")

    # 执行一个操作
    client.patch(
        "/api/candidates/test_id/status",
        json={"status": "hr_review"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    # 检查日志
    log_response = client.get(
        "/api/audit/logs?limit=1",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert log_response.status_code == 200
    logs = log_response.json().get("items", [])
    assert len(logs) >= 1, "操作未被记录到审计日志"
    last_log = logs[0]
    assert "candidate" in str(last_log.get("resource", "")), (
        "审计日志应记录操作资源类型"
    )
    assert "user" in last_log, "审计日志必须记录操作者"
