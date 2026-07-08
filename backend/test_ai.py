"""
快速测试 AI 打分是否正常工作（需先在数据库中激活一个 LLM 配置）
运行方式：cd backend && python test_ai.py
"""
import asyncio
from app.core.database import AsyncSessionLocal
from app.services.ai_service import ai_service


async def main():
    resume_text = """
    姓名：张三
    学历：本科，计算机科学与技术，2018年毕业
    工作经历：
    2018-2020  XX科技有限公司  后端开发工程师
      - 负责用户服务模块开发，使用Python + FastAPI
      - 参与数据库设计，熟练使用PostgreSQL
    2020-2024  YY互联网公司  高级后端工程师
      - 独立负责订单系统重构，QPS从500提升至5000
      - 熟练使用Docker、Kubernetes进行服务部署
      - 熟悉Redis缓存、消息队列RabbitMQ
    技能：Python、FastAPI、PostgreSQL、Redis、Docker、Linux
    """

    async with AsyncSessionLocal() as db:
        result = await ai_service.score_resume(
            db=db,
            resume_text=resume_text,
            job_title="高级后端工程师",
            job_requirements="负责核心业务系统开发，需要有高并发系统经验",
            required_education="bachelor",
            required_experience_years=3,
            required_skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
        )

    print(f"技能匹配：{result.skills} / 25")
    print(f"经验匹配：{result.experience} / 25")
    print(f"教育匹配：{result.education} / 20")
    print(f"发展潜力：{result.potential} / 15")
    print(f"稳定性：  {result.stability} / 15")
    print(f"总分：    {result.total} / 100")
    print(f"总结：    {result.summary}")
    print(f"优势：    {result.strengths}")
    print(f"不足：    {result.weaknesses}")


if __name__ == "__main__":
    asyncio.run(main())
