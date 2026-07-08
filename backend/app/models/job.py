"""岗位模型 — 模块 B"""
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column
import enum
from app.core.database import Base


class JobStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    closed = "closed"


class EducationLevel(str, enum.Enum):
    any = "any"
    junior_college = "junior_college"
    bachelor = "bachelor"
    master = "master"
    phd = "phd"


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(256))
    department: Mapped[str] = mapped_column(String(128))
    location: Mapped[str | None] = mapped_column(String(256))

    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)

    required_education: Mapped[EducationLevel] = mapped_column(
        SAEnum(EducationLevel), default=EducationLevel.any)
    required_experience_years: Mapped[int | None] = mapped_column(Integer)
    required_skills: Mapped[str | None] = mapped_column(JSON)

    education_requirement: Mapped[str | None] = mapped_column(String(64))
    work_years_required: Mapped[int | None] = mapped_column(Integer, default=0)
    skill_tags: Mapped[str | None] = mapped_column(JSON)

    jd_body: Mapped[str] = mapped_column(Text)
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(JobStatus), default=JobStatus.draft)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc))
