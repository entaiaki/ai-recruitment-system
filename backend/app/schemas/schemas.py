"""Pydantic schemas — 对齐 Claude v2 模型结构"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole
from app.models.job import JobStatus, EducationLevel
from app.models.application import ApplicationStatus


# ═══════════════ 用户 ═══════════════

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.hr
    department: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ═══════════════ 岗位 ═══════════════

class JobCreate(BaseModel):
    title: str
    department: str
    location: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    required_education: EducationLevel = EducationLevel.any
    required_experience_years: Optional[int] = None
    required_skills: List[str] = []
    jd_body: str


class JobUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    required_education: Optional[EducationLevel] = None
    required_experience_years: Optional[int] = None
    required_skills: Optional[List[str]] = None
    jd_body: Optional[str] = None
    status: Optional[JobStatus] = None


class JobOut(BaseModel):
    id: int
    title: str
    department: str
    location: Optional[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    required_education: EducationLevel
    required_experience_years: Optional[int]
    required_skills: Optional[List[str]]
    jd_body: str
    status: JobStatus
    created_by: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ═══════════════ 简历 ═══════════════

class ResumeOut(BaseModel):
    id: int
    candidate_id: Optional[int]
    original_filename: str
    file_size: Optional[int]
    parse_status: str
    parse_error: Optional[str]
    parsed_text_preview: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ═══════════════ 候选人 ═══════════════

class CandidateCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str = "manual"


class CandidateOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    source: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ═══════════════ 投递 / 打分 ═══════════════

class ApplicationCreate(BaseModel):
    job_id: int
    candidate_id: int
    resume_id: int


class ApplicationStatusUpdate(BaseModel):
    new_status: ApplicationStatus
    notes: Optional[str] = None
    interview_date: Optional[datetime] = None


class ApplicationOut(BaseModel):
    id: int
    job_id: int
    candidate_id: int
    resume_id: int
    department: Optional[str]
    status: ApplicationStatus
    ai_total_score: Optional[float]
    ai_recommendation: Optional[str]
    ai_summary: Optional[str]
    ai_strengths: Optional[str]
    ai_weaknesses: Optional[str]
    scoring_error: Optional[str]
    scoring_attempts: int
    hr_notes: Optional[str]
    dept_notes: Optional[str]
    reject_reason: Optional[str]
    interview_date: Optional[datetime]
    applied_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ScoreDimension(BaseModel):
    score: float
    max: float
    comment: str


class AIResult(BaseModel):
    """AI 5 维度打分结果 — 对齐任务书模块 D"""
    total_score: float
    dimensions: dict
    recommendation: str
    strengths: List[str]
    weaknesses: List[str]
    summary: str
