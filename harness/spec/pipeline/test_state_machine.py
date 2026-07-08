"""候选人状态机测试

覆盖任务书模块 E 的完整状态流转规则（8 个状态节点），
确保只允许合法的状态跳转，严防越权流转。
"""
import pytest
from services.pipeline import CandidatePipeline

# ── 状态机定义（来自任务书模块 E）────────────────────────────────
#
# pending_review → ai_scoring → scored ┬→ hr_review → dept_review → interview → offer → hired
#                           │          └→ rejected
#                           └→ scoring_failed → ai_scoring
#
# 终态: hired, rejected
# scoring_failed 只允许重试 ai_scoring

VALID_TRANSITIONS = {
    "pending_review":   ["ai_scoring"],
    "ai_scoring":       ["scored", "scoring_failed"],
    "scored":           ["hr_review", "rejected"],
    "hr_review":        ["dept_review", "rejected"],
    "dept_review":      ["interview", "rejected"],
    "interview":        ["offer", "rejected"],
    "offer":            ["hired", "rejected"],
    "hired":            [],          # 终态
    "rejected":         [],          # 终态
    "scoring_failed":   ["ai_scoring"]  # 只允许重试打分
}

INVALID_TRANSITIONS = [
    ("hired",    "pending_review"),
    ("rejected", "hr_review"),
    ("offer",    "ai_scoring"),
    ("scored",   "hired"),
    ("ai_scoring", "interview"),       # 跳过了 hr_review
    ("dept_review", "offer"),          # 跳过了 interview
    ("pending_review", "hr_review"),   # 跳过了 ai_scoring
    ("scoring_failed", "hr_review"),   # scoring_failed 只能到 ai_scoring
]


@pytest.mark.parametrize("from_state,to_state", INVALID_TRANSITIONS)
def test_invalid_transitions_are_rejected(from_state, to_state):
    """非法状态流转必须被拒绝"""
    pipeline = CandidatePipeline()
    with pytest.raises(ValueError, match="Invalid transition"):
        pipeline.transition(
            candidate_id="test_id",
            from_state=from_state,
            to_state=to_state
        )


def test_terminal_states_cannot_transition():
    """终态不能继续流转"""
    pipeline = CandidatePipeline()
    for terminal_state in ["hired", "rejected"]:
        with pytest.raises(ValueError):
            pipeline.transition(
                candidate_id="test_id",
                from_state=terminal_state,
                to_state="hr_review"
            )


# ── 正向流转测试 ─────────────────────────────────────────────────

@pytest.mark.parametrize("from_state,to_state", [
    ("pending_review", "ai_scoring"),
    ("ai_scoring", "scored"),
    ("scored", "hr_review"),
    ("scored", "rejected"),
    ("hr_review", "dept_review"),
    ("hr_review", "rejected"),
    ("dept_review", "interview"),
    ("dept_review", "rejected"),
    ("interview", "offer"),
    ("interview", "rejected"),
    ("offer", "hired"),
    ("offer", "rejected"),
    ("scoring_failed", "ai_scoring"),
])
def test_valid_transitions_succeed(from_state, to_state):
    """合法状态流转应成功"""
    pipeline = CandidatePipeline()
    # 不应抛出异常
    pipeline.transition(
        candidate_id="test_id",
        from_state=from_state,
        to_state=to_state
    )


# ── 打分失败重试逻辑 ─────────────────────────────────────────────

def test_scoring_failed_only_allows_retry():
    """scoring_failed 状态只能转到 ai_scoring（重试）"""
    pipeline = CandidatePipeline()
    # scoring_failed → ai_scoring 应该成功
    pipeline.transition(
        candidate_id="test_id",
        from_state="scoring_failed",
        to_state="ai_scoring"
    )

    # 其他所有目标状态都应拒绝
    all_states = [
        "pending_review", "scored", "hr_review",
        "dept_review", "interview", "offer",
        "hired", "rejected"
    ]
    for state in all_states:
        with pytest.raises(ValueError):
            pipeline.transition(
                candidate_id="test_id",
                from_state="scoring_failed",
                to_state=state
            )


# ── 审计日志 ─────────────────────────────────────────────────────

def test_each_transition_generates_audit_log():
    """每次状态流转必须生成审计日志"""
    pipeline = CandidatePipeline()
    result = pipeline.transition(
        candidate_id="test_candidate_id",
        from_state="pending_review",
        to_state="ai_scoring"
    )
    # transition 方法应返回包含日志的结果
    assert "audit_log" in result or hasattr(pipeline, "last_audit"), (
        "状态流转必须生成操作记录"
    )


def test_reject_reason_is_recorded():
    """拒绝操作必须记录原因"""
    pipeline = CandidatePipeline()
    result = pipeline.transition(
        candidate_id="test_id",
        from_state="scored",
        to_state="rejected",
        reason="AI 评分低于阈值 30 分"
    )
    assert "reason" in result, "拒绝操作必须记录原因"


# ── 全路径完整性 ─────────────────────────────────────────────────

def test_all_states_are_defined():
    """所有 8 个状态 + scoring_failed 都必须出现在 VALID_TRANSITIONS 中"""
    all_states = [
        "pending_review", "ai_scoring", "scored",
        "hr_review", "dept_review", "interview",
        "offer", "hired", "rejected", "scoring_failed"
    ]
    for state in all_states:
        assert state in VALID_TRANSITIONS, (
            f"状态 '{state}' 未在 VALID_TRANSITIONS 中定义"
        )


def test_pipeline_cannot_skip_ai_scoring():
    """候选人不能跳过 AI 打分直接进入 HR 审核"""
    pipeline = CandidatePipeline()
    with pytest.raises(ValueError):
        pipeline.transition(
            candidate_id="test_id",
            from_state="pending_review",
            to_state="hr_review"
        )
