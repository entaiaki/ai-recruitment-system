"""候选人投递路由 — 模块 E：状态机 + AI 打分"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.api.deps import require_hr_or_above
from app.models.user import User, UserRole
from app.models.job import Job
from app.models.resume import Resume
from app.models.application import Application, ApplicationStatus
from app.schemas.schemas import ApplicationCreate, ApplicationOut, ApplicationStatusUpdate
from app.services.ai_service import ai_service
from app.services.application_service import (
    ApplicationService, NotFoundError, InvalidTransitionError,
)

router = APIRouter(prefix="/api/applications", tags=["投递管理"])

# ── 各状态操作权限 ───────────────────────────────────────
ROLE_TRANSITIONS = {
    ApplicationStatus.hr_review:   (UserRole.hr, UserRole.admin),
    ApplicationStatus.dept_review: (UserRole.dept_leader, UserRole.admin),
    ApplicationStatus.interview:   (UserRole.hr, UserRole.dept_leader, UserRole.admin),
    ApplicationStatus.offered:     (UserRole.hr, UserRole.admin),
    ApplicationStatus.hired:       (UserRole.hr, UserRole.admin),
}


# ── 创建投递 ─────────────────────────────────────────────
@router.post("/", response_model=ApplicationOut, status_code=201)
async def create_application(
    data: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_hr_or_above),
):
    svc = ApplicationService(db, current_user.id)
    try:
        app = await svc.submit(
            job_id=data.job_id,
            candidate_id=data.candidate_id,
            resume_id=data.resume_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    await db.commit()
    await db.refresh(app)
    return app


# ── 列表查询 ─────────────────────────────────────────────
@router.get("/", response_model=List[ApplicationOut])
async def list_applications(
    job_id: int | None = None,
    status: ApplicationStatus | None = None,
    min_score: float | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Application)
    if current_user.role in (UserRole.hr, UserRole.dept_leader) and current_user.department:
        query = query.where(Application.department == current_user.department)
    if job_id:
        query = query.where(Application.job_id == job_id)
    if status:
        query = query.where(Application.status == status)
    if min_score is not None:
        query = query.where(Application.ai_total_score >= min_score)
    result = await db.execute(
        query.offset(skip).limit(limit).order_by(Application.applied_at.desc()))
    return result.scalars().all()


# ── 详情 ─────────────────────────────────────────────────
@router.get("/{app_id}", response_model=ApplicationOut)
async def get_application(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="投递不存在")
    if current_user.role in (UserRole.hr, UserRole.dept_leader):
        if app.department != current_user.department:
            raise HTTPException(status_code=403, detail="无权查看其他部门投递")
    return app


# ── 状态流转（推进/回退）─────────────────────────────────
@router.patch("/{app_id}/status", response_model=ApplicationOut)
async def update_status(
    app_id: int,
    update: ApplicationStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    allowed_roles = ROLE_TRANSITIONS.get(update.new_status)
    if allowed_roles and current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"权限不足，需要角色：{[r.value for r in allowed_roles]}",
        )

    if update.new_status == ApplicationStatus.rejected and not update.notes:
        raise HTTPException(status_code=422, detail="拒绝必须填写原因")

    svc = ApplicationService(db, current_user.id)
    try:
        app = await svc.transition(
            app_id=app_id,
            new_status=update.new_status,
            notes=update.notes,
            interview_date=update.interview_date,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InvalidTransitionError as e:
        raise HTTPException(status_code=422, detail=str(e))

    await db.commit()
    await db.refresh(app)
    return app


# ── 触发 AI 打分 ─────────────────────────────────────────
@router.post("/{app_id}/score", response_model=ApplicationOut)
async def trigger_scoring(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_hr_or_above),
):
    svc = ApplicationService(db, current_user.id)
    try:
        app = await svc.retry_scoring(app_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    await db.flush()

    resume = await db.get(Resume, app.resume_id)
    job = await db.get(Job, app.job_id)

    if not resume or not resume.parsed_text:
        app = await svc.mark_scoring_failed(app_id, "简历解析文本为空")
        await db.commit()
        await db.refresh(app)
        return app

    try:
        ai_result = await ai_service.score_resume(
            db=db,
            resume_text=resume.parsed_text,
            job_title=job.title,
            job_requirements=job.jd_body,
            required_education=job.required_education.value if job.required_education else "any",
            required_experience_years=job.required_experience_years or 0,
            required_skills=job.required_skills or [],
        )

        app = await svc.save_scores(
            app_id=app_id,
            scores={
                "score_skills": ai_result.skills,
                "score_experience": ai_result.experience,
                "score_education": ai_result.education,
                "score_potential": ai_result.potential,
                "score_stability": ai_result.stability,
                "ai_total_score": ai_result.total,
            },
            summary=ai_result.summary,
            strengths=ai_result.strengths,
            weaknesses=ai_result.weaknesses,
            recommendation=ai_result.recommendation,
        )

    except Exception as e:
        app = await svc.mark_scoring_failed(app_id, str(e))

    await db.commit()
    await db.refresh(app)
    return app


# ── 重试打分 ─────────────────────────────────────────────
@router.post("/{app_id}/retry-scoring", response_model=ApplicationOut)
async def retry_scoring(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_hr_or_above),
):
    svc = ApplicationService(db, current_user.id)
    try:
        await svc.retry_scoring(app_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return await trigger_scoring(app_id, db, current_user)
