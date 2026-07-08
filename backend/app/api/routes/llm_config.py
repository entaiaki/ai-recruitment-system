"""LLM 配置管理路由"""
import time
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import OpenAI

from app.core.database import get_db
from app.models.llm_config import LLMConfig
from app.schemas.llm_config import (
    LLMConfigCreate, LLMConfigUpdate, LLMConfigOut,
    LLMConfigTest, LLMConfigTestResult,
)
from app.api.deps import require_admin

router = APIRouter(prefix="/api/llm-configs", tags=["LLM配置"])
logger = logging.getLogger(__name__)


def _mask_api_key(key: str) -> str:
    if len(key) <= 8:
        return "****"
    return key[:4] + "****" + key[-4:]


# ── 列出所有配置 ────────────────────────────────────────
@router.get("/", response_model=list[LLMConfigOut])
async def list_configs(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(LLMConfig).order_by(LLMConfig.id))
    configs = result.scalars().all()
    for c in configs:
        c.api_key = _mask_api_key(c.api_key)
    return configs


# ── 获取激活配置 ────────────────────────────────────────
@router.get("/active", response_model=LLMConfigOut)
async def get_active_config(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(LLMConfig).where(LLMConfig.is_active == True))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="尚未设置激活的LLM配置")
    config.api_key = _mask_api_key(config.api_key)
    return config


# ── 新建配置 ────────────────────────────────────────────
@router.post("/", response_model=LLMConfigOut)
async def create_config(
    data: LLMConfigCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    config = LLMConfig(**data.model_dump())
    db.add(config)
    await db.commit()
    await db.refresh(config)
    config.api_key = _mask_api_key(config.api_key)
    return config


# ── 更新配置 ────────────────────────────────────────────
@router.put("/{config_id}", response_model=LLMConfigOut)
async def update_config(
    config_id: int,
    data: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    update_data = data.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(config, k, v)
    await db.commit()
    await db.refresh(config)
    config.api_key = _mask_api_key(config.api_key)
    return config


# ── 删除配置 ────────────────────────────────────────────
@router.delete("/{config_id}")
async def delete_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    await db.delete(config)
    await db.commit()
    return {"message": "已删除"}


# ── 激活配置 ────────────────────────────────────────────
@router.post("/{config_id}/activate")
async def activate_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    # 先全部取消激活
    all_configs = await db.execute(select(LLMConfig))
    for c in all_configs.scalars():
        c.is_active = False
    # 激活目标
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    config.is_active = True
    await db.commit()
    return {"message": f"已激活配置：{config.name}"}


# ── 测试连接 ────────────────────────────────────────────
@router.post("/test", response_model=LLMConfigTestResult)
async def test_connection(
    data: LLMConfigTest,
    _=Depends(require_admin),
):
    start = time.time()
    try:
        client = OpenAI(base_url=data.base_url, api_key=data.api_key, timeout=15)
        response = client.chat.completions.create(
            model=data.model_name,
            messages=[{"role": "user", "content": "reply with OK only"}],
            max_tokens=10,
            temperature=0,
        )
        latency_ms = int((time.time() - start) * 1000)
        return LLMConfigTestResult(
            success=True,
            message=f"连接成功，模型响应：{(response.choices[0].message.content or '').strip()[:50]}",
            latency_ms=latency_ms,
        )
    except Exception as e:
        return LLMConfigTestResult(success=False, message=f"连接失败：{str(e)[:200]}")
