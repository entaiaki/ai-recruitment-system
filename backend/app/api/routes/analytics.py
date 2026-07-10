"""数据分析路由 — 供前端 Data Analysis 页面使用"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.application import Application

router = APIRouter(prefix="/api/analytics", tags=["数据分析"])


@router.get("/summary")
async def analytics_summary(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    # 用户数
    user_count = (await db.execute(select(func.count()).select_from(User))).scalar()
    # 岗位数
    job_count = (await db.execute(select(func.count()).select_from(Job))).scalar()
    # 候选人数
    candidate_count = (await db.execute(select(func.count()).select_from(Candidate))).scalar()
    # 投递数
    app_count = (await db.execute(select(func.count()).select_from(Application))).scalar()

    # 按岗位统计投递数
    jobs_result = await db.execute(
        select(Job.title, func.count(Application.id))
        .outerjoin(Application, Application.job_id == Job.id)
        .group_by(Job.id, Job.title)
        .order_by(func.count(Application.id).desc())
    )
    jobs_by_title = [{"title": row[0], "count": row[1]} for row in jobs_result.all()]

    # 按状态统计投递数
    status_result = await db.execute(
        select(Application.status, func.count())
        .group_by(Application.status)
    )
    status_map = {}
    for row in status_result.all():
        status_map[row[0].value if hasattr(row[0], 'value') else str(row[0])] = row[1]

    return {
        "counts": {
            "users": user_count,
            "jobs": job_count,
            "candidates": candidate_count,
            "applications": app_count,
        },
        "jobs_by_title": jobs_by_title,
        "applications_by_status": status_map,
    }
