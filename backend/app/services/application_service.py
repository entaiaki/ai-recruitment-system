"""投递服务 — 收口所有 Application 读写，路由只做 HTTP 胶水"""
import json
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.application import Application, ApplicationStatus, VALID_TRANSITIONS
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.resume import Resume
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


class NotFoundError(Exception):
    """资源不存在"""


class InvalidTransitionError(Exception):
    """非法状态流转"""

    def __init__(
        self,
        from_status: ApplicationStatus,
        to_status: ApplicationStatus,
        allowed: list[ApplicationStatus],
    ):
        self.from_status = from_status
        self.to_status = to_status
        self.allowed = allowed
        super().__init__(
            f"不允许从 {from_status.value} 流转到 {to_status.value}，"
            f"当前允许：{[s.value for s in allowed]}"
        )


class ApplicationService:
    def __init__(self, db: AsyncSession, operator_id: int):
        self.db = db
        self.operator_id = operator_id

    # ── 内部工具 ─────────────────────────────────────────
    async def _get_or_404(self, model, obj_id: int, label: str):
        result = await self.db.execute(select(model).where(model.id == obj_id))
        obj = result.scalar_one_or_none()
        if obj is None:
            raise NotFoundError(f"{label}不存在 (id={obj_id})")
        return obj

    def _audit(self, action: str, resource: str,
               resource_id: str = "", detail: dict | None = None):
        self.db.add(AuditLog(
            user_id=self.operator_id, action=action,
            resource=resource, resource_id=resource_id, detail=detail,
        ))

    # ── 提交投递 ─────────────────────────────────────────
    async def submit(
        self,
        job_id: int,
        candidate_id: int,
        resume_id: int,
        cover_letter: str | None = None,
    ) -> Application:
        job = await self._get_or_404(Job, job_id, "岗位")
        candidate = await self._get_or_404(Candidate, candidate_id, "候选人")
        resume = await self._get_or_404(Resume, resume_id, "简历")

        # 防重复投递
        existing = await self.db.execute(
            select(Application).where(
                Application.job_id == job_id,
                Application.candidate_id == candidate_id,
                Application.status.not_in([ApplicationStatus.rejected]),
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("该候选人已投递此岗位，请勿重复提交")

        app = Application(
            job_id=job_id,
            candidate_id=candidate_id,
            resume_id=resume_id,
            cover_letter=cover_letter,
            status=ApplicationStatus.submitted,
            department=job.department,
        )
        self.db.add(app)
        await self.db.flush()

        self._audit(
            "create_application", "application",
            resource_id=str(app.id),
            detail={"job_id": job_id, "candidate_id": candidate_id},
        )

        logger.info("投递创建成功 app_id=%d job=%s", app.id, job.title)
        await self.db.refresh(app)
        return app

    # ── 状态流转 ─────────────────────────────────────────
    async def transition(
        self,
        app_id: int,
        new_status: ApplicationStatus,
        notes: str | None = None,
        interview_date: datetime | None = None,
    ) -> Application:
        app = await self._get_or_404(Application, app_id, "投递记录")

        allowed = VALID_TRANSITIONS.get(app.status, [])
        if new_status not in allowed:
            raise InvalidTransitionError(app.status, new_status, allowed)

        old_status = app.status

        if new_status == ApplicationStatus.rejected:
            if not notes:
                raise ValueError("必须填写拒绝原因")
            app.reject_reason = notes

        app.status = new_status

        if new_status == ApplicationStatus.hr_review:
            app.reviewed_by_hr = self.operator_id

        if new_status == ApplicationStatus.dept_review:
            app.reviewed_by_dept = self.operator_id

        if notes:
            if new_status in (ApplicationStatus.hr_review, ApplicationStatus.ai_scored):
                app.hr_notes = notes
            elif new_status == ApplicationStatus.dept_review:
                app.dept_notes = notes

        if interview_date:
            app.interview_date = interview_date

        self._audit(
            "transition_status", "application",
            resource_id=str(app_id),
            detail={"from": old_status.value, "to": new_status.value},
        )

        await self.db.flush()
        await self.db.refresh(app)

        logger.info(
            "状态流转 app_id=%d %s → %s by user=%s",
            app_id, old_status.value, new_status.value, self.operator_id,
        )
        return app

    # ── 重试 AI 打分 ─────────────────────────────────────
    async def retry_scoring(self, app_id: int) -> Application:
        app = await self._get_or_404(Application, app_id, "投递记录")
        if app.status not in (ApplicationStatus.scoring_failed, ApplicationStatus.ai_scored):
            raise ValueError("仅 scoring_failed / ai_scored 状态可重试打分")
        app.status = ApplicationStatus.ai_scoring
        app.scoring_error = None
        await self.db.flush()
        await self.db.refresh(app)
        return app

    # ── 写入 AI 打分结果 ─────────────────────────────────
    async def save_scores(
        self,
        app_id: int,
        scores: dict[str, float],
        summary: str,
        strengths: list[str],
        weaknesses: list[str],
        recommendation: str,
    ) -> Application:
        app = await self._get_or_404(Application, app_id, "投递记录")

        app.score_skills = scores.get("score_skills")
        app.score_experience = scores.get("score_experience")
        app.score_education = scores.get("score_education")
        app.score_potential = scores.get("score_potential")
        app.score_stability = scores.get("score_stability")
        app.ai_total_score = scores.get("ai_total_score")
        app.ai_summary = summary
        app.ai_strengths = json.dumps(strengths, ensure_ascii=False)
        app.ai_weaknesses = json.dumps(weaknesses, ensure_ascii=False)
        app.ai_recommendation = recommendation
        app.status = ApplicationStatus.ai_scored

        self._audit(
            "ai_scoring_success", "application",
            resource_id=str(app_id),
            detail={"total_score": scores.get("ai_total_score")},
        )

        await self.db.flush()
        await self.db.refresh(app)
        return app

    # ── 标记打分失败 ─────────────────────────────────────
    async def mark_scoring_failed(self, app_id: int, error: str) -> Application:
        app = await self._get_or_404(Application, app_id, "投递记录")
        app.scoring_error = error
        app.scoring_attempts = (app.scoring_attempts or 0) + 1
        app.status = ApplicationStatus.scoring_failed

        self._audit(
            "ai_scoring_failed", "application",
            resource_id=str(app_id),
            detail={"error": error},
        )

        await self.db.flush()
        await self.db.refresh(app)
        return app
