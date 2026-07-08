"""ApplicationService 单元测试 — 投递 + 状态流转 + 异常路径"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import ApplicationStatus
from app.services.application_service import (
    ApplicationService,
    NotFoundError,
    InvalidTransitionError,
)

OPERATOR_ID = 1  # 模拟操作人 id


# ═══════════════════════════════════════════
# submit() 投递相关测试
# ═══════════════════════════════════════════

async def test_submit_success(db: AsyncSession, seed_data: dict):
    """正常投递：返回 Application，状态是 submitted"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)

    assert app.id is not None
    assert app.status == ApplicationStatus.submitted
    assert app.job_id == seed_data["job_id"]
    assert app.candidate_id == seed_data["candidate_id"]


async def test_submit_with_cover_letter(db: AsyncSession, seed_data: dict):
    """带求职信的投递：cover_letter 被正确保存"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(cover_letter="我对贵公司非常感兴趣", **seed_data)

    assert app.cover_letter == "我对贵公司非常感兴趣"


async def test_submit_duplicate_raises(db: AsyncSession, seed_data: dict):
    """重复投递同一岗位：抛 ValueError"""
    svc = ApplicationService(db, OPERATOR_ID)
    await svc.submit(**seed_data)

    with pytest.raises(ValueError, match="已投递此岗位"):
        await svc.submit(**seed_data)


async def test_submit_nonexistent_job_raises(db: AsyncSession, seed_data: dict):
    """投递不存在的岗位：抛 NotFoundError"""
    svc = ApplicationService(db, OPERATOR_ID)
    with pytest.raises(NotFoundError, match="岗位不存在"):
        await svc.submit(job_id=99999, **{k: v for k, v in seed_data.items() if k != "job_id"})


async def test_submit_nonexistent_candidate_raises(db: AsyncSession, seed_data: dict):
    """投递时候选人不存在：抛 NotFoundError"""
    svc = ApplicationService(db, OPERATOR_ID)
    with pytest.raises(NotFoundError, match="候选人不存在"):
        await svc.submit(candidate_id=99999, **{k: v for k, v in seed_data.items() if k != "candidate_id"})


# ═══════════════════════════════════════════
# transition() 状态流转测试
# ═══════════════════════════════════════════

async def test_transition_submitted_to_ai_scoring(db: AsyncSession, seed_data: dict):
    """submitted → ai_scoring 合法"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)

    app = await svc.transition(app.id, ApplicationStatus.ai_scoring)
    assert app.status == ApplicationStatus.ai_scoring


async def test_transition_invalid_raises(db: AsyncSession, seed_data: dict):
    """非法跳转（submitted → hired）：抛 InvalidTransitionError"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)

    with pytest.raises(InvalidTransitionError):
        await svc.transition(app.id, ApplicationStatus.hired)


async def test_transition_reject_without_notes_raises(db: AsyncSession, seed_data: dict):
    """拒绝但不给原因：抛 ValueError"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)
    # 先把状态推进到 ai_scored，因为 submitted 不允许直接到 rejected
    await svc.transition(app.id, ApplicationStatus.ai_scoring)
    await svc.transition(app.id, ApplicationStatus.ai_scored)

    with pytest.raises(ValueError, match="必须填写拒绝原因"):
        await svc.transition(app.id, ApplicationStatus.rejected)


async def test_transition_reject_with_notes(db: AsyncSession, seed_data: dict):
    """拒绝并给出原因：成功写入 reject_reason"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)
    await svc.transition(app.id, ApplicationStatus.ai_scoring)
    await svc.transition(app.id, ApplicationStatus.ai_scored)

    app = await svc.transition(
        app.id, ApplicationStatus.rejected,
        notes="项目经验不匹配",
    )
    assert app.status == ApplicationStatus.rejected
    assert app.reject_reason == "项目经验不匹配"


async def test_transition_full_pipeline(db: AsyncSession, seed_data: dict):
    """完整流水线：submitted → hired 一路合法"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)

    pipeline = [
        ApplicationStatus.ai_scoring,
        ApplicationStatus.ai_scored,
        ApplicationStatus.hr_review,
        ApplicationStatus.dept_review,
        ApplicationStatus.interview,
        ApplicationStatus.offered,
        ApplicationStatus.hired,
    ]
    for status in pipeline:
        app = await svc.transition(app.id, status)

    assert app.status == ApplicationStatus.hired


# ═══════════════════════════════════════════
# retry_scoring() 测试
# ═══════════════════════════════════════════

async def test_retry_scoring_from_failed(db: AsyncSession, seed_data: dict):
    """scoring_failed 状态 → 可重试回 ai_scoring"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)
    # 手动把状态设为 scoring_failed
    app.status = ApplicationStatus.scoring_failed
    app.scoring_error = "timeout"
    await db.flush()

    app = await svc.retry_scoring(app.id)
    assert app.status == ApplicationStatus.ai_scoring
    assert app.scoring_error is None


async def test_retry_scoring_from_wrong_state_raises(db: AsyncSession, seed_data: dict):
    """非 scoring_failed / ai_scored 状态重试：抛 ValueError"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)

    with pytest.raises(ValueError, match="仅 scoring_failed / ai_scored"):
        await svc.retry_scoring(app.id)


# ═══════════════════════════════════════════
# save_scores() 测试
# ═══════════════════════════════════════════

async def test_save_scores(db: AsyncSession, seed_data: dict):
    """写入 AI 打分：所有字段正确落库"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)

    app = await svc.save_scores(
        app_id=app.id,
        scores={
            "score_skills": 20.0,
            "score_experience": 22.0,
            "score_education": 18.0,
            "score_potential": 12.0,
            "score_stability": 13.0,
            "ai_total_score": 85.0,
        },
        summary="技术匹配度高，建议进入面试环节",
        strengths=["Python 精通", "项目经验丰富"],
        weaknesses=["英语水平未知"],
        recommendation="strong_hire",
    )

    assert app.status == ApplicationStatus.ai_scored
    assert app.ai_total_score == 85.0
    assert app.score_skills == 20.0
    assert app.ai_recommendation == "strong_hire"


# ═══════════════════════════════════════════
# mark_scoring_failed() 测试
# ═══════════════════════════════════════════

async def test_mark_scoring_failed(db: AsyncSession, seed_data: dict):
    """标记打分失败：状态 + 错误信息 + 重试次数"""
    svc = ApplicationService(db, OPERATOR_ID)
    app = await svc.submit(**seed_data)

    app = await svc.mark_scoring_failed(app.id, "LLM 超时")

    assert app.status == ApplicationStatus.scoring_failed
    assert app.scoring_error == "LLM 超时"
    assert app.scoring_attempts == 1
