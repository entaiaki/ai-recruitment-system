"""岗位管理路由 — 模块 B"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.api.deps import require_hr_or_above
from app.models.user import User, UserRole
from app.models.job import Job, JobStatus
from app.schemas.schemas import JobCreate, JobUpdate, JobOut

router = APIRouter(prefix="/api/jobs", tags=["岗位"])


@router.post("/", response_model=JobOut, status_code=201)
async def create_job(
    data: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_hr_or_above),
):
    if len(data.jd_body.strip()) < settings.MIN_JD_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"JD 正文不少于 {settings.MIN_JD_LENGTH} 字",
        )

    job = Job(
        title=data.title,
        department=data.department,
        location=data.location,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        required_education=data.required_education,
        required_experience_years=data.required_experience_years,
        required_skills=data.required_skills,
        jd_body=data.jd_body,
        created_by=current_user.id,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


@router.get("/", response_model=List[JobOut])
async def list_jobs(
    status: JobStatus | None = None,
    department: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Job)
    if current_user.role in (UserRole.hr, UserRole.dept_leader) and current_user.department:
        query = query.where(Job.department == current_user.department)
    elif department:
        query = query.where(Job.department == department)
    if status:
        query = query.where(Job.status == status)
    if current_user.role == UserRole.dept_leader:
        query = query.where(Job.status != JobStatus.draft)

    result = await db.execute(
        query.offset(skip).limit(limit).order_by(Job.created_at.desc()))
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="岗位不存在")
    if current_user.role in (UserRole.hr, UserRole.dept_leader):
        if job.department != current_user.department:
            raise HTTPException(status_code=403, detail="无权查看其他部门岗位")
    return job


@router.patch("/{job_id}", response_model=JobOut)
async def update_job(
    job_id: int,
    data: JobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_hr_or_above),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="岗位不存在")
    if current_user.role == UserRole.hr and job.department != current_user.department:
        raise HTTPException(status_code=403, detail="无权修改其他部门岗位")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)
    await db.flush()
    await db.refresh(job)
    return job
