"""候选人投递记录 — 模块 E，9 节点状态机 + AI 5 维度打分"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Integer, Float, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
import enum
from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    submitted = "submitted"
    ai_scoring = "ai_scoring"
    scoring_failed = "scoring_failed"
    ai_scored = "ai_scored"
    hr_review = "hr_review"
    dept_review = "dept_review"
    interview = "interview"
    offered = "offered"
    hired = "hired"
    rejected = "rejected"


# 合法状态流转（对齐任务书模块 E）
VALID_TRANSITIONS: dict[ApplicationStatus, list[ApplicationStatus]] = {
    ApplicationStatus.submitted:      [ApplicationStatus.ai_scoring],
    ApplicationStatus.ai_scoring:     [ApplicationStatus.ai_scored, ApplicationStatus.scoring_failed],
    ApplicationStatus.scoring_failed: [ApplicationStatus.ai_scoring],
    ApplicationStatus.ai_scored:      [ApplicationStatus.hr_review, ApplicationStatus.rejected],
    ApplicationStatus.hr_review:      [ApplicationStatus.dept_review, ApplicationStatus.rejected],
    ApplicationStatus.dept_review:    [ApplicationStatus.interview, ApplicationStatus.rejected],
    ApplicationStatus.interview:      [ApplicationStatus.offered, ApplicationStatus.rejected],
    ApplicationStatus.offered:        [ApplicationStatus.hired, ApplicationStatus.rejected],
    ApplicationStatus.hired:          [],
    ApplicationStatus.rejected:       [],
}


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id"))
    department: Mapped[str | None] = mapped_column(String(128))

    status: Mapped[ApplicationStatus] = mapped_column(
        SAEnum(ApplicationStatus), default=ApplicationStatus.submitted)

    # ── AI 打分 5 维度（对齐任务书模块 D）────────────────
    # skills_match 25 | experience_match 25 | education_match 20
    # potential 15 | stability 15 = 100
    score_skills: Mapped[Optional[float]] = mapped_column(Float, default=None)
    score_experience: Mapped[Optional[float]] = mapped_column(Float, default=None)
    score_education: Mapped[Optional[float]] = mapped_column(Float, default=None)
    score_potential: Mapped[Optional[float]] = mapped_column(Float, default=None)
    score_stability: Mapped[Optional[float]] = mapped_column(Float, default=None)
    ai_total_score: Mapped[Optional[float]] = mapped_column(Float, default=None)
    ai_recommendation: Mapped[Optional[str]] = mapped_column(String(32), default=None)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, default=None)
    ai_strengths: Mapped[Optional[str]] = mapped_column(Text, default=None)
    ai_weaknesses: Mapped[Optional[str]] = mapped_column(Text, default=None)
    scoring_error: Mapped[Optional[str]] = mapped_column(Text, default=None)
    scoring_attempts: Mapped[int] = mapped_column(Integer, default=0)

    # ── 人工操作记录 ────────────────────────────────────
    hr_notes: Mapped[Optional[str]] = mapped_column(Text, default=None)
    dept_notes: Mapped[Optional[str]] = mapped_column(Text, default=None)
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, default=None)
    interview_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), default=None)
    cover_letter: Mapped[Optional[str]] = mapped_column(Text, default=None)

    reviewed_by_hr: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), default=None)
    reviewed_by_dept: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), default=None)

    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc))
