"""AI 简历打分服务 — 对齐任务书 5 维度

维度（总分 100）：
  skills    (技能匹配) — 25 分
  experience(经验匹配) — 25 分
  education (教育匹配) — 20 分
  potential (发展潜力) — 15 分
  stability (稳定性)   — 15 分

支持 Qwen3 <think> 标签剥离，三级 JSON 回退，含重试和降级。
简历文本提取委托 utils/file_parser.py，本模块只负责打分。
"""
import re
import json
import logging
from typing import Optional
from dataclasses import dataclass, field

from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── 打分结果 ────────────────────────────────────────────

@dataclass
class ScoreResult:
    skills:         float = 0
    experience:     float = 0
    education:      float = 0
    potential:      float = 0
    stability:      float = 0
    total:          float = 0
    summary:        str = ""
    strengths:      list = field(default_factory=list)
    weaknesses:     list = field(default_factory=list)
    recommendation: str = ""                     # 路由层调用 ai_result.recommendation 依赖此字段

DEFAULT_SCORE = ScoreResult(
    skills=0, experience=0, education=0, potential=0, stability=0, total=0,
    summary="AI 打分失败，请人工审核",
    strengths=[],
    weaknesses=["AI 自动打分未能完成，需人工评估"],
    recommendation="Not Recommended",
)

# ── 评分 Prompt ─────────────────────────────────────────

SCORING_PROMPT = """请对以下候选人简历进行评分。

## 岗位信息
- 岗位名称：{job_title}
- 学历要求：{edu_label}
- 工作年限要求：{exp_years}年以上
- 技能要求：{skills_str}
- 岗位要求详情：
{job_requirements}

## 候选人简历
{resume_text}

## 评分标准（总分 100 分）

| 维度 | 满分 | 说明 |
|------|------|------|
| skills (技能匹配) | 25分 | 技术栈、工具、证书与岗位要求的匹配程度 |
| experience (经验匹配) | 25分 | 工作年限、行业背景、项目经验的匹配程度 |
| education (教育匹配) | 20分 | 学历、专业、学校背景与岗位要求的匹配程度 |
| potential (发展潜力) | 15分 | 学习能力、成长轨迹、求职动机 |
| stability (稳定性) | 15分 | 工作稳定性，跳槽频率，平均在职时长 |

## 输出要求
只输出以下 JSON 格式，不要有任何其他文字：

{{
  "skills": <0-25的数字>,
  "experience": <0-25的数字>,
  "education": <0-20的数字>,
  "potential": <0-15的数字>,
  "stability": <0-15的数字>,
  "total": <以上5项之和>,
  "summary": "<100字以内的中文总结评语>",
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["不足1", "不足2"]
}}"""


# ── 服务类 ──────────────────────────────────────────────

class AIService:
    def __init__(self):
        pass

    async def _get_client(self, db) -> tuple:
        """从数据库读取激活的 LLM 配置，返回 (OpenAI client, model, timeout, max_retries)"""
        from app.models.llm_config import LLMConfig
        from sqlalchemy import select
        result = await db.execute(
            select(LLMConfig).where(LLMConfig.is_active == True)
        )
        config = result.scalar_one_or_none()
        if not config:
            raise RuntimeError("未找到激活的 LLM 配置，请在系统设置中配置并激活一个 LLM")
        client = OpenAI(
            base_url=str(config.base_url).strip(),
            api_key=str(config.api_key).strip(),
            timeout=config.timeout,
        )
        return client, config.model_name, config.timeout, config.max_retries

    # ── Qwen3 <think> 标签剥离 ──────────────────────────

    def _strip_thinking(self, text: str) -> str:
        return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

    # ── JSON 三级回退提取 ───────────────────────────────

    def _extract_json(self, text: str) -> dict:
        """从模型输出中提取 JSON：纯 JSON → ```json 代码块 → 正则 { } 匹配"""
        text = self._strip_thinking(text)

        # 1) 纯 JSON
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 2) ```json ... ``` 代码块
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # 3) 正则找第一个 { } 块
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        raise ValueError(f"无法从模型输出中提取 JSON，原始输出：\n{text[:500]}")

    # ── 分数钳位 ────────────────────────────────────────

    @staticmethod
    def _clamp(val, max_val: float) -> float:
        try:
            return max(0.0, min(float(val), max_val))
        except (TypeError, ValueError):
            return 0.0

    # ── 推荐等级 ────────────────────────────────────────

    @staticmethod
    def _calc_recommendation(total: float) -> str:
        if total >= 85:
            return "Highly Recommended"
        if total >= 70:
            return "Recommended"
        if total >= 50:
            return "Maybe"
        return "Not Recommended"

    # ── 核心打分（async，从 DB 动态取配置）─────────────

    async def score_resume(
        self,
        db,
        resume_text: str,
        job_title: str,
        job_requirements: str,
        required_education: str = "any",
        required_experience_years: int = 0,
        required_skills: Optional[list] = None,
    ) -> ScoreResult:
        """对简历执行 AI 打分，含重试和降级处理"""
        if not resume_text or not resume_text.strip():
            raise ValueError("简历文本为空")

        client, model, timeout, max_retries = await self._get_client(db)
        temperature = getattr(settings, "LLM_TEMPERATURE", 0.2)

        edu_map = {
            "any": "不限", "junior_college": "大专",
            "bachelor": "本科", "master": "硕士", "phd": "博士",
        }
        edu_label = edu_map.get(required_education, required_education)
        skills_str = "、".join(required_skills) if required_skills else "无特殊要求"
        resume_truncated = resume_text[:4000] if len(resume_text) > 4000 else resume_text

        prompt = SCORING_PROMPT.format(
            job_title=job_title,
            edu_label=edu_label,
            exp_years=required_experience_years,
            skills_str=skills_str,
            job_requirements=job_requirements,
            resume_text=resume_truncated,
        )

        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"AI 打分第 {attempt} 次尝试...")
                response = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=1500,
                )
                raw_output = response.choices[0].message.content or ""
                logger.debug(f"模型原始输出（前 300 字）：{raw_output[:300]}")

                data = self._extract_json(raw_output)
                total = round(
                    self._clamp(data.get("skills", 0), 25)
                    + self._clamp(data.get("experience", 0), 25)
                    + self._clamp(data.get("education", 0), 20)
                    + self._clamp(data.get("potential", 0), 15)
                    + self._clamp(data.get("stability", 0), 15),
                    1,
                )
                return ScoreResult(
                    skills=self._clamp(data.get("skills", 0), 25),
                    experience=self._clamp(data.get("experience", 0), 25),
                    education=self._clamp(data.get("education", 0), 20),
                    potential=self._clamp(data.get("potential", 0), 15),
                    stability=self._clamp(data.get("stability", 0), 15),
                    total=total,
                    summary=str(data.get("summary", ""))[:500],
                    strengths=data.get("strengths", []) if isinstance(data.get("strengths"), list) else [str(data.get("strengths", ""))],
                    weaknesses=data.get("weaknesses", []) if isinstance(data.get("weaknesses"), list) else [str(data.get("weaknesses", ""))],
                    recommendation=self._calc_recommendation(total),
                )
            except Exception as e:
                last_error = e
                logger.warning(f"第 {attempt} 次打分失败：{e}")

        logger.error(f"AI 打分在 {max_retries} 次重试后仍失败：{last_error}")
        raise RuntimeError(f"AI 打分失败：{last_error}")


# ── 单例 ────────────────────────────────────────────────

ai_service = AIService()
