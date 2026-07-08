"""打分稳定性验证

覆盖验收标准第 3 条：
"同一份简历对同一 JD 连续 5 次打分，总分波动不超过 5 分"
以及任务书模块 D 对 temperature=0.2 的约束。
"""
import pytest
from services.llm_scorer import score_resume

SAMPLE_RESUME = """
李四，8年Java开发经验，
主导过微服务架构设计，熟悉Spring Cloud、K8s，
硕士软件工程专业，曾在头部互联网公司任技术经理。
"""

SAMPLE_JD = """
招聘高级Java架构师，要求8年以上经验，
精通微服务架构、Spring Cloud、Kubernetes，
有团队管理经验优先，硕士及以上学历。
"""

STABILITY_RUNS = 5       # 验收标准：连续 5 次
MAX_SCORE_VARIANCE = 5   # 验收标准：波动 ≤ 5 分


def test_repeated_scoring_is_stable():
    """同一简历对同一 JD 连续打分，总分波动 ≤ 5 分"""
    scores = []
    for _ in range(STABILITY_RUNS):
        result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
        scores.append(result["total_score"])

    score_range = max(scores) - min(scores)
    assert score_range <= MAX_SCORE_VARIANCE, (
        f"打分不稳定：{STABILITY_RUNS} 次打分波动 {score_range} 分 "
        f"（允许上限 {MAX_SCORE_VARIANCE}），"
        f"分数序列: {scores}"
    )


def test_recommendation_is_stable():
    """推荐结论应该稳定（不出现大幅摇摆）"""
    recommendations = []
    for _ in range(STABILITY_RUNS):
        result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
        recommendations.append(result["recommendation"])

    # 推荐结论变化不应超过 1 个等级
    rank_map = {
        "Highly Recommended": 3,
        "Recommended": 2,
        "Maybe": 1,
        "Not Recommended": 0,
    }
    ranks = [rank_map[r] for r in recommendations]
    rank_range = max(ranks) - min(ranks)

    assert rank_range <= 1, (
        f"推荐结论不稳定：波动 {rank_range} 个等级，"
        f"结论序列: {recommendations}"
    )


def test_dimension_scores_are_individually_stable():
    """每个维度的分数也应该相对稳定"""
    all_dimension_scores = {dim: [] for dim in [
        "skills_match", "experience_match",
        "education_match", "potential", "stability"
    ]}

    for _ in range(STABILITY_RUNS):
        result = score_resume(SAMPLE_RESUME, SAMPLE_JD)
        for dim_name, dim_data in result["dimensions"].items():
            all_dimension_scores[dim_name].append(dim_data["score"])

    for dim_name, scores in all_dimension_scores.items():
        dim_range = max(scores) - min(scores)
        # 单个维度的波动容忍为 3 分
        assert dim_range <= 3, (
            f"维度 '{dim_name}' 不稳定：{STABILITY_RUNS} 次波动 {dim_range} 分，"
            f"分数序列: {scores}"
        )
