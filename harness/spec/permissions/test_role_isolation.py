"""角色权限隔离测试

覆盖任务书模块 A 的四类角色（超级管理员 / HR 专员 / 部门 Leader / 数据分析员）
和验收标准第 5 条：权限隔离严格，用户只能访问被授权的资源和操作。
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def get_token(role: str) -> str:
    """获取指定角色的测试 Token"""
    response = client.post("/api/auth/login", json={
        "username": f"test_{role}",
        "password": "test_password"
    })
    assert response.status_code == 200, f"测试用户 test_{role} 登录失败"
    return response.json()["access_token"]


# ── HR 专员权限隔离 ──────────────────────────────────────────────

def test_hr_cannot_access_other_department_jobs():
    """HR 专员不能查看其他部门的岗位"""
    token = get_token("hr_dept_a")
    response = client.get(
        "/api/jobs/dept_b_job_id",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403, (
        "HR 专员不应该能访问其他部门岗位"
    )


def test_hr_can_access_own_department_jobs():
    """HR 专员可以查看自己部门的岗位"""
    token = get_token("hr_dept_a")
    response = client.get(
        "/api/jobs",
        headers={"Authorization": f"Bearer {token}"}
    )
    # 应该只返回本部门岗位
    data = response.json()
    for job in data.get("items", []):
        assert job.get("department") == "dept_a", (
            f"HR 专员看到了其他部门的岗位: {job}"
        )


def test_hr_cannot_modify_system_config():
    """HR 专员不能修改系统配置（模块 G）"""
    token = get_token("hr")
    response = client.patch(
        "/api/config/api-keys",
        json={"model": "gpt-4"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403, (
        "HR 专员不应该能修改系统配置"
    )


# ── 部门 Leader 权限隔离 ─────────────────────────────────────────

def test_leader_cannot_modify_candidate_status():
    """部门 Leader 不能修改候选人状态"""
    token = get_token("leader")
    response = client.patch(
        "/api/candidates/test_candidate_id/status",
        json={"status": "Interview"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403, (
        "部门 Leader 不应该能修改候选人状态"
    )


def test_leader_can_view_own_dept_candidates():
    """部门 Leader 可以查看本部门的候选人"""
    token = get_token("leader_dept_a")
    response = client.get(
        "/api/candidates",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200, "部门 Leader 应该能查看候选人"
    data = response.json()
    for candidate in data.get("items", []):
        assert candidate.get("department") == "dept_a", (
            f"部门 Leader 看到了其他部门的候选人: {candidate}"
        )


def test_leader_cannot_upload_resume():
    """部门 Leader 不能上传简历"""
    token = get_token("leader")
    response = client.post(
        "/api/resumes/upload",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403, (
        "部门 Leader 不应该能上传简历"
    )


# ── 数据分析员权限隔离 ───────────────────────────────────────────

def test_analyst_can_view_dashboard():
    """数据分析员可以查看数据看板"""
    token = get_token("analyst")
    response = client.get(
        "/api/analytics/dashboard",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200, "数据分析员应该能查看数据看板"


def test_analyst_cannot_modify_jobs():
    """数据分析员不能修改岗位"""
    token = get_token("analyst")
    response = client.post(
        "/api/jobs",
        json={"title": "Test Job"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403, (
        "数据分析员不应该能创建岗位"
    )


def test_analyst_cannot_view_personal_resume_data():
    """数据分析员不能查看个人简历敏感数据（脱敏要求）"""
    token = get_token("analyst")
    response = client.get(
        "/api/resumes/test_resume_id",
        headers={"Authorization": f"Bearer {token}"}
    )
    # 数据分析员看板可以看聚合数据，但不能看单份简历详情
    assert response.status_code in (403, 404), (
        "数据分析员不应该能查看单份简历详情"
    )


# ── 超级管理员权限 ───────────────────────────────────────────────

def test_admin_can_access_all():
    """超级管理员可以访问所有接口"""
    token = get_token("admin")
    endpoints = [
        "/api/jobs",
        "/api/resumes",
        "/api/candidates",
        "/api/analytics/dashboard",
        "/api/config/api-keys",
    ]
    for endpoint in endpoints:
        response = client.get(
            endpoint,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, (
            f"超级管理员访问 {endpoint} 应返回 200，实际: {response.status_code}"
        )


# ── 未登录拦截 ───────────────────────────────────────────────────

def test_unauthenticated_cannot_access_any_api():
    """未登录用户不能访问任何业务接口"""
    endpoints = [
        "/api/jobs",
        "/api/resumes",
        "/api/candidates",
        "/api/analytics/dashboard",
    ]
    for endpoint in endpoints:
        response = client.get(endpoint)
        assert response.status_code == 401, (
            f"未认证请求访问 {endpoint} 应返回 401，实际: {response.status_code}"
        )
