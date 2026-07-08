"""打分输出结构验证

覆盖模块 D 核心约束：
- 输出必须是合法 JSON，包含 total_score / dimensions / recommendation / strengths / weaknesses / summary
- 5 个评分维度必须齐全：技能25 + 经验25 + 教育20 + 潜力15 + 稳定性15
- 各维度分数之和等于总分（容忍 ±2）
- recommendation 必须属于枚举值
"""
import pytest
import json
from services.llm_scorer import score_resume

SAMPLE_RESUME = """
张三，5年Python开发经验，
熟悉FastAPI、PostgreSQL、Docker，
本科计算机专业，曾就职于互联网公司。
"""

SAMPLE_JD = """
招聘Python后端工程师，要求3年以上经验，
熟悉FastAPI或Django，了解数据库优化，
本科及以上学历。
"""

REQUIRED_DIMENSIONS = [
    "skills_match",
    "experience_match",
    "education_match",
    "potential",
    "stability"
]

VALID_RECOMMENDATIONS = [
    "Highly Recommended",
    "Recommended",
    "Maybe",
    "Not Recommended"
]


def test_output_is_valid_json():
    """打分结果必须是合法 JSON"""
    result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
    assert isinstance(result, dict), "结果必须是字典类型"


def test_total_score_in_range():
    """总分必须在 0-100 之间"""
    result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
    assert "total_score" in result, "必须包含 total_score 字段"
    score = result["total_score"]
    assert isinstance(score, (int, float)), "total_score 必须是数字"
    assert 0 <= score <= 100, f"total_score {score} 超出 0-100 范围"


def test_all_dimensions_present():
    """所有评分维度必须存在"""
    result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
    assert "dimensions" in result, "必须包含 dimensions 字段"
    for dim in REQUIRED_DIMENSIONS:
        assert dim in result["dimensions"], f"缺少维度: {dim}"


def test_dimension_scores_have_required_fields():
    """每个维度必须包含 score、max、comment"""
    result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
    for dim_name in REQUIRED_DIMENSIONS:
        dim = result["dimensions"][dim_name]
        assert "score" in dim, f"{dim_name} 缺少 score 字段"
        assert "max" in dim, f"{dim_name} 缺少 max 字段"
        assert "comment" in dim, f"{dim_name} 缺少 comment 字段"
        assert dim["score"] <= dim["max"], (
            f"{dim_name} 的 score {dim['score']} 超过 max {dim['max']}"
        )


def test_dimension_scores_sum_matches_total():
    """各维度分数之和必须等于总分"""
    result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
    dimension_sum = sum(
        result["dimensions"][d]["score"]
        for d in REQUIRED_DIMENSIONS
    )
    total = result["total_score"]
    assert abs(dimension_sum - total) <= 2, (
        f"维度总和 {dimension_sum} 与 total_score {total} 差异超过容忍范围"
    )


def test_recommendation_is_valid():
    """recommendation 必须是枚举值之一"""
    result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
    assert "recommendation" in result, "必须包含 recommendation 字段"
    assert result["recommendation"] in VALID_RECOMMENDATIONS, (
        f"非法的 recommendation 值: {result['recommendation']}"
    )


def test_strengths_and_weaknesses_are_lists():
    """strengths 和 weaknesses 必须是列表"""
    result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
    assert isinstance(result.get("strengths"), list), "strengths 必须是列表"
    assert isinstance(result.get("weaknesses"), list), "weaknesses 必须是列表"
    assert len(result["strengths"]) >= 1, "strengths 至少要有1条"
    assert len(result["weaknesses"]) >= 1, "weaknesses 至少要有1条"


def test_summary_is_non_empty_string():
    """summary 必须是非空字符串"""
    result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
    assert isinstance(result.get("summary"), str), "summary 必须是字符串"
    assert len(result["summary"].strip()) > 0, "summary 不能为空"
