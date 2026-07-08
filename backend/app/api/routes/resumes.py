"""简历上传路由 — 模块 C"""
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import require_hr_or_above
from app.models.user import User
from app.models.resume import Resume
from app.schemas.schemas import ResumeOut
from app.utils.file_parser import parse_resume

router = APIRouter(prefix="/api/resumes", tags=["简历"])


@router.post("/upload", response_model=ResumeOut, status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    candidate_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_hr_or_above),
):

    ext = Path(file.filename or "unknown").suffix.lower()
    if ext not in (".pdf", ".docx"):
        raise HTTPException(status_code=400, detail=f"不支持格式 '{ext}'，仅 PDF/DOCX")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="文件超过 10MB 限制")

    upload_dir = Path(settings.UPLOAD_DIR) / "resumes"
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = upload_dir / stored_name
    stored_path.write_bytes(content)

    parse_status, parse_error, parsed_text = "pending", None, None
    try:
        parsed_text = parse_resume(str(stored_path))
        parse_status = "success"
    except Exception as e:
        parse_status = "failed"
        parse_error = str(e)

    resume = Resume(
        candidate_id=candidate_id,
        original_filename=file.filename or "unknown",
        file_path=str(stored_path),
        file_size=len(content),
        parsed_text=parsed_text,
        parse_status=parse_status,
        parse_error=parse_error,
        uploaded_by=current_user.id,
    )
    db.add(resume)
    await db.flush()
    await db.refresh(resume)

    result = ResumeOut.model_validate(resume)
    result.parsed_text_preview = (parsed_text or "")[:settings.RESUME_PREVIEW_LENGTH]
    return result
