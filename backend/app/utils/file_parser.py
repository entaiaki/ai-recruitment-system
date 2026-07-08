"""文件解析 — PDF / DOCX 简历文本提取"""
import logging
from pathlib import Path

import pdfplumber
from docx import Document
from app.core.config import settings

logger = logging.getLogger(__name__)
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def parse_resume(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    ext = path.suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持格式 '{ext}'，仅 PDF / DOCX / TXT")

    size = path.stat().st_size
    if size > settings.MAX_FILE_SIZE:
        raise ValueError(f"文件过大: {size / 1024 / 1024:.1f}MB")
    if size == 0:
        raise ValueError("文件为空")

    try:
        if ext == ".pdf":
            text = _parse_pdf(path)
        elif ext in (".docx", ".doc"):
            text = _parse_docx(path)
        else:
            text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        logger.error("解析失败 %s: %s", file_path, e)
        raise RuntimeError(f"文件解析失败: {e}") from e

    if not text or not text.strip():
        raise RuntimeError("解析后文本为空")
    return text.strip()


def _parse_pdf(path: Path) -> str:
    texts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                texts.append(text)
    return "\n".join(texts)


def _parse_docx(path: Path) -> str:
    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
