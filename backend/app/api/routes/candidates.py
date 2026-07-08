"""候选人路由"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.candidate import Candidate
from app.schemas.schemas import CandidateCreate, CandidateOut
from app.api.deps import require_hr_or_above

router = APIRouter(prefix="/api/candidates", tags=["候选人"])


@router.post("/", response_model=CandidateOut, status_code=201)
async def create_candidate(
    data: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_hr_or_above),
):
    candidate = Candidate(**data.model_dump())
    db.add(candidate)
    await db.flush()
    await db.refresh(candidate)
    return candidate


@router.get("/", response_model=list[CandidateOut])
async def list_candidates(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Candidate).order_by(Candidate.created_at.desc()))
    return result.scalars().all()
