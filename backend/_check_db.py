import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as s:
        r = await s.execute(text("SELECT id, email, role, is_active FROM users"))
        for row in r:
            print(row)

asyncio.run(main())
