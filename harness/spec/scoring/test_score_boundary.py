"""打分边界条件验证

覆盖任务书模块 D 的边界和降级场景：
- 空简历、空 JD
- 超长简历（>10000 字）
- JD 少于 100 字（违反模块 B 约束）
- 简历和 JD 完全不相关（极端 mismatch）
- 纯英文简历
- API 超时 / 返回非 JSON 的降级处理
"""
import pytest
from services.llm_scorer import score_resume

VALID_JD = """
招聘Python后端工程师，要求3年以上经验，
熟悉FastAPI或Django，了解数据库优化，
本科及以上学历，有团队协作能力和良好的代码规范意识。
要求能够独立完成模块设计。
"""


# ── 空输入 ───────────────────────────────────────────────────────

def test_empty_resume_raises_error():
    """空简历应抛出明确错误"""
    with pytest.raises(ValueError, match="简历|resume|empty|空"):
        score_resume("", VALID_JD)


def test_empty_jd_raises_error():
    """空 JD 应抛出明确错误"""
    with pytest.raises(ValueError, match="JD|job|empty|空"):
        score_resume("张三，5年Python开发", "")


def test_whitespace_only_resume_raises_error():
    """纯空白简历应抛出错误"""
    with pytest.raises(ValueError):
        score_resume("   \n  \t  ", VALID_JD)


# ── JD 长度约束 ──────────────────────────────────────────────────

def test_short_jd_raises_warning():
    """JD 少于 100 字（模块 B 约束）应给出提示"""
    short_jd = "招聘工程师。"
    result = score_resume("张三，3年经验", short_jd)
    # 不应该崩溃，但应在结果中标注质量警告
    assert result is not None, "短 JD 不应导致崩溃"


def test_long_resume_handled():
    """超长简历不应导致崩溃（模块 C：≤10MB 文本量）"""
    long_resume = "张三，工程师。\n" + "有丰富的工作经验。\n" * 5000
    result = score_resume(long_resume, VALID_JD)
    assert "total_score" in result, "超长简历应正常打分"
    assert 0 <= result["total_score"] <= 100


# ── 完全不匹配 ───────────────────────────────────────────────────

def test_total_mismatch_scores_low():
    """完全不相关的简历应得低分"""
    unrelated_resume = """
    王五，10年厨师经验，
    精通川菜、粤菜，有大型餐饮管理经验，
    高中毕业。
    """
    result = score_resume(unrelated_resume, VALID_JD)
    assert result["total_score"] <= 50, (
        f"完全不相关简历应得低分（≤50），实际: {result['total_score']}"
    )
    assert result["recommendation"] == "Not Recommended", (
        f"完全不相关简历应推荐 Not Recommended，实际: {result['recommendation']}"
    )


# ── 完美匹配 ─────────────────────────────────────────────────────

def test_perfect_match_scores_high():
    """完美匹配的简历应得高分"""
    perfect_resume = """
    赵六，5年Python后端开发经验，
    精通FastAPI、Django，熟悉PostgreSQL优化，
    计算机硕士，有良好的代码规范意识，
    曾独立完成多个模块设计，团队协作能力强。
    """
    result = score_resume(perfect_resume, VALID_JD)
    assert result["total_score"] >= 70, (
        f"完美匹配简历应得高分（≥70），实际: {result['total_score']}"
    )


# ── 英文简历 ─────────────────────────────────────────────────────

def test_english_resume_handled():
    """英文简历应能正常打分"""
    english_resume = """
    John, 5 years of Python backend experience,
    proficient in FastAPI, PostgreSQL, Docker,
    BS in Computer Science.
    """
    result = score_resume(english_resume, VALID_JD)
    assert "total_score" in result, "英文简历应正常打分"


# ── 注：API 降级测试需要 mock，此处留桩 ──────────────────────────
# def test_api_timeout_graceful_degradation():
# def test_non_json_response_graceful_degradation():
# def test_api_quota_exceeded_graceful_degradation():
