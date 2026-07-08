# Skill：招聘系统开发 Harness 工程规范

## 适用场景

当你在开发或修改 AI 招聘系统的任何模块时，必须遵循本 Skill。
特别是以下情况必须触发 Harness 验证：

- 修改 AI 打分相关逻辑（Prompt、评分维度、输出解析）
- 修改用户权限或角色控制逻辑
- 修改候选人状态机流转规则
- 修改 API 调用或成本控制逻辑
- 修改简历解析逻辑

## 不适用场景

- 修改纯 UI 样式（颜色、间距、图标）
- 修改日志格式
- 修改注释或文档

---

## Harness 目录结构

项目根目录下必须维护以下结构：

    harness/
    ├── spec/
    │   ├── scoring/
    │   │   ├── test_score_output_structure.py   # 打分输出结构验证
    │   │   ├── test_score_stability.py          # 打分稳定性验证
    │   │   └── test_score_boundary.py           # 边界条件验证
    │   ├── permissions/
    │   │   ├── test_role_isolation.py           # 角色权限隔离
    │   │   └── test_data_access.py              # 数据访问控制
    │   ├── pipeline/
    │   │   └── test_state_machine.py            # 候选人状态机
    │   └── resume/
    │       └── test_parser.py                   # 简历解析
    └── fixtures/
        ├── sample_resume.pdf                    # 测试用简历
        ├── sample_resume.docx
        └── sample_jd.txt                        # 测试用 JD

---

## 操作步骤

### 修改任何核心模块前

1. 先读取对应 spec 文件，明确当前的硬约束是什么。
2. 在修改前先跑一次 Harness，确认基线是绿的。
3. 执行修改。
4. 修改完再跑一次 Harness。
5. 全部通过才能汇报完成。

### 如果 Harness 失败

1. 不要绕过测试，不要注释掉测试用例。
2. 先判断是"代码改坏了"还是"业务规则本身变了"。
3. 如果是代码改坏了：修复代码，重跑测试。
4. 如果是业务规则变了：先让用户确认，再同时更新 Spec 和 Harness。

---

## 核心 Harness 用例（必须维护）

### 打分结构验证

```python
# harness/spec/scoring/test_score_output_structure.py
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