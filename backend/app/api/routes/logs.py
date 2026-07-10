"""日志/审计路由 — 供前端 Log Monitoring 页面使用"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/api/logs", tags=["日志"])


@router.get("/")
async def list_logs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    count_result = await db.execute(select(func.count()).select_from(AuditLog))
    total = count_result.scalar()

    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.scalars().all()

    items = []
    for log in rows:
        items.append({
            "id": "LOG" + str(log.id).zfill(4),
            "statement": f"[{log.resource}] {log.action} — {log.detail or ''}",
            "runTime": "—",
            "status": "success",
            "timestamp": log.created_at.isoformat() if log.created_at else "",
        })

    return {"items": items, "total": total}
