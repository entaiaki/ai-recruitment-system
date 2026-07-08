"""种子脚本 — 写入初始 LLM 配置"""
import asyncio
from app.core.database import AsyncSessionLocal
from app.models.llm_config import LLMConfig
from sqlalchemy import select


async def seed():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(LLMConfig).where(LLMConfig.is_active == True))
        if result.scalar_one_or_none():
            print("已有激活配置，跳过种子数据")
            return

        config = LLMConfig(
            name="本地 LM Studio",
            base_url="http://192.168.2.66:1235/v1",
            api_key="lm-studio",
            model_name="qwen3vl-8b-instruct",
            timeout=120,
            max_retries=3,
            is_active=True,
        )
        db.add(config)
        await db.commit()
        print(f"种子配置已写入: {config.name}")


if __name__ == "__main__":
    asyncio.run(seed())
