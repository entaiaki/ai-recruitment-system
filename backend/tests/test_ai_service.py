"""AI 打分服务单元测试 — Mock OpenAI 客户端"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.ai_service import AIService, ScoreResult, DEFAULT_SCORE


@pytest.fixture
def ai_svc() -> AIService:
    return AIService()


# ═══════════════════════════════════════════
# _clamp() 分数钳位
# ═══════════════════════════════════════════

def test_clamp_normal(ai_svc: AIService):
    assert ai_svc._clamp(20, 25) == 20.0

def test_clamp_negative(ai_svc: AIService):
    assert ai_svc._clamp(-5, 25) == 0.0

def test_clamp_exceed_max(ai_svc: AIService):
    assert ai_svc._clamp(30, 25) == 25.0

def test_clamp_string(ai_svc: AIService):
    assert ai_svc._clamp("abc", 25) == 0.0

def test_clamp_none(ai_svc: AIService):
    assert ai_svc._clamp(None, 25) == 0.0

def test_clamp_float(ai_svc: AIService):
    assert ai_svc._clamp(12.7, 25) == 12.7


# ═══════════════════════════════════════════
# _calc_recommendation() 推荐等级
# ═══════════════════════════════════════════

def test_recommend_highly(ai_svc: AIService):
    assert ai_svc._calc_recommendation(90) == "Highly Recommended"

def test_recommend_recommended(ai_svc: AIService):
    assert ai_svc._calc_recommendation(75) == "Recommended"

def test_recommend_maybe(ai_svc: AIService):
    assert ai_svc._calc_recommendation(55) == "Maybe"

def test_recommend_not(ai_svc: AIService):
    assert ai_svc._calc_recommendation(30) == "Not Recommended"

def test_recommend_boundary_85(ai_svc: AIService):
    assert ai_svc._calc_recommendation(85) == "Highly Recommended"

def test_recommend_boundary_70(ai_svc: AIService):
    assert ai_svc._calc_recommendation(70) == "Recommended"

def test_recommend_boundary_50(ai_svc: AIService):
    assert ai_svc._calc_recommendation(50) == "Maybe"

def test_recommend_boundary_49(ai_svc: AIService):
    assert ai_svc._calc_recommendation(49) == "Not Recommended"


# ═══════════════════════════════════════════
# _extract_json() JSON 提取
# ═══════════════════════════════════════════

def test_extract_json_pure(ai_svc: AIService):
    text = '{"skills":20,"experience":22,"education":15,"potential":10,"stability":8,"total":75}'
    result = ai_svc._extract_json(text)
    assert result["skills"] == 20
    assert result["total"] == 75

def test_extract_json_in_code_block(ai_svc: AIService):
    text = '```json\n{"skills":20,"experience":22,"education":15,"potential":10,"stability":8,"total":75}\n```'
    result = ai_svc._extract_json(text)
    assert result["skills"] == 20

def test_extract_json_with_think_tag(ai_svc: AIService):
    text = '<think>分析简历中...</think>\n{"skills":20,"experience":22,"education":15,"potential":10,"stability":8,"total":75}'
    result = ai_svc._extract_json(text)
    assert result["skills"] == 20

def test_extract_json_invalid_raises(ai_svc: AIService):
    with pytest.raises(ValueError, match="无法从模型输出中提取 JSON"):
        ai_svc._extract_json("这不是 JSON 文本")


# ═══════════════════════════════════════════
# _strip_thinking() Qwen3 think 剥离
# ═══════════════════════════════════════════

def test_strip_thinking_removes_tag(ai_svc: AIService):
    text = "<think>分析中...</think>真正的 JSON"
    assert ai_svc._strip_thinking(text) == "真正的 JSON"

def test_strip_thinking_no_tag(ai_svc: AIService):
    text = '{"skills":20}'
    assert ai_svc._strip_thinking(text) == '{"skills":20}'

def test_strip_thinking_multiline(ai_svc: AIService):
    text = "<think>\n分析中...\n更多分析\n</think>\n结果"
    assert ai_svc._strip_thinking(text) == "结果"


# ═══════════════════════════════════════════
# DEFAULT_SCORE 降级值
# ═══════════════════════════════════════════

def test_default_score_has_recommendation():
    assert DEFAULT_SCORE.recommendation == "Not Recommended"
    assert DEFAULT_SCORE.total == 0
    assert any("AI 自动打分未能完成" in w for w in DEFAULT_SCORE.weaknesses)


# ═══════════════════════════════════════════
# score_resume() — 空输入
# ═══════════════════════════════════════════

@pytest.mark.asyncio
async def test_score_empty_resume_raises(ai_svc: AIService):
    with pytest.raises(ValueError, match="简历文本为空"):
        await ai_svc.score_resume(
            db=MagicMock(), resume_text="",
            job_title="测试", job_requirements="测试",
        )


# ═══════════════════════════════════════════
# score_resume() — Mock OpenAI 正常打分
# ═══════════════════════════════════════════

@pytest.mark.asyncio
async def test_score_resume_success(ai_svc: AIService):
    mock_db = MagicMock()
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = (
        '{"skills":22,"experience":20,"education":15,"potential":12,"stability":10,"total":79,'
        '"summary":"匹配度较好","strengths":["技术栈匹配","沟通能力强"],'
        '"weaknesses":["经验略浅"]}'
    )

    def mock_chat(**kwargs):
        return mock_response
    mock_client.chat.completions.create = mock_chat

    with patch.object(ai_svc, "_get_client",
                      return_value=(mock_client, "gpt-4", 30, 1)):
        result = await ai_svc.score_resume(
            db=mock_db,
            resume_text="张三，5年Python经验，本科",
            job_title="Python工程师",
            job_requirements="要求3年Python经验",
        )
        assert result.total == 79.0
        assert result.skills == 22.0
        assert result.experience == 20.0
        assert result.education == 15.0
        assert result.potential == 12.0
        assert result.stability == 10.0
        assert result.summary == "匹配度较好"
        assert "技术栈匹配" in result.strengths
        assert result.recommendation == "Recommended"


@pytest.mark.asyncio
async def test_score_resume_high_score_highly_recommended(ai_svc: AIService):
    mock_db = MagicMock()
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = (
        '{"skills":25,"experience":25,"education":20,"potential":15,"stability":15,"total":100,'
        '"summary":"完美匹配","strengths":["全栈经验"],"weaknesses":[]}'
    )

    def mock_chat(**kwargs):
        return mock_response
    mock_client.chat.completions.create = mock_chat

    with patch.object(ai_svc, "_get_client",
                      return_value=(mock_client, "gpt-4", 30, 1)):
        result = await ai_svc.score_resume(
            db=mock_db,
            resume_text="优秀候选人",
            job_title="工程师",
            job_requirements="要求",
        )
        assert result.recommendation == "Highly Recommended"


@pytest.mark.asyncio
async def test_score_resume_retry_then_raise(ai_svc: AIService):
    """连续失败 → RuntimeError"""
    mock_db = MagicMock()
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("API 挂了")

    with patch.object(ai_svc, "_get_client",
                      return_value=(mock_client, "gpt-4", 30, 2)):
        with pytest.raises(RuntimeError, match="AI 打分失败"):
            await ai_svc.score_resume(
                db=mock_db,
                resume_text="张三",
                job_title="工程师",
                job_requirements="要求",
            )
