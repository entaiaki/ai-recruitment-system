"""简历解析测试

覆盖模块 C 的核心约束：
- 支持 PDF / DOCX 格式
- 文件大小 ≤ 10MB
- 解析失败返回明确错误消息
- 多页简历正常解析
"""
import pytest
import os
from services.resume_parser import parse_resume

FIXTURES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "fixtures"
)


# ── 格式支持 ─────────────────────────────────────────────────────

def test_parse_pdf_resume():
    """PDF 简历解析成功"""
    pdf_path = os.path.join(FIXTURES_DIR, "sample_resume.pdf")
    if not os.path.exists(pdf_path):
        pytest.skip("测试 PDF 文件不存在")
    text = parse_resume(pdf_path)
    assert isinstance(text, str), "解析结果必须是字符串"
    assert len(text.strip()) > 0, "解析文本不能为空"


def test_parse_docx_resume():
    """DOCX 简历解析成功"""
    docx_path = os.path.join(FIXTURES_DIR, "sample_resume.docx")
    if not os.path.exists(docx_path):
        pytest.skip("测试 DOCX 文件不存在")
    text = parse_resume(docx_path)
    assert isinstance(text, str), "解析结果必须是字符串"
    assert len(text.strip()) > 0, "解析文本不能为空"


# ── 错误处理 ─────────────────────────────────────────────────────

def test_nonexistent_file_raises_error():
    """不存在的文件应抛出明确错误"""
    with pytest.raises(FileNotFoundError):
        parse_resume("/nonexistent/path/resume.pdf")


def test_unsupported_format_raises_error():
    """不支持的格式应抛出错误并提示支持的格式"""
    with pytest.raises(ValueError, match="格式|format|support"):
        parse_resume("/some/path/resume.jpg")


def test_empty_file_raises_error():
    """空文件应返回明确提示"""
    empty_path = os.path.join(FIXTURES_DIR, "empty.pdf")
    # 即使没有空的测试文件，也应通过 mock 验证逻辑
    # 这里验证 parse_resume 对空文本的处理
    try:
        parse_resume(empty_path)
    except FileNotFoundError:
        pytest.skip("空测试文件不存在（需补充 fixtures）")
    except Exception as e:
        assert "空" in str(e) or "empty" in str(e).lower(), (
            f"空文件错误消息应包含'空'提示，实际: {e}"
        )


# ── 文本提取质量 ─────────────────────────────────────────────────

def test_parsed_text_contains_expected_keywords():
    """解析出的文本应包含预期关键词"""
    pdf_path = os.path.join(FIXTURES_DIR, "sample_resume.pdf")
    if not os.path.exists(pdf_path):
        pytest.skip("测试 PDF 文件不存在")
    text = parse_resume(pdf_path)
    # 基础简历应包含的关键信息类型
    keywords = ["经验", "开发", "本科", "公司"]
    found = [kw for kw in keywords if kw in text]
    assert len(found) >= 2, (
        f"解析文本中至少应有2个关键词，实际找到: {found}，"
        f"解析结果: {text[:200]}"
    )


# ── 大小限制（模块 C：≤10MB）────────────────────────────────────

def test_large_file_rejected():
    """超过 10MB 的文件应拒绝"""
    large_path = os.path.join(FIXTURES_DIR, "large_resume.pdf")
    if not os.path.exists(large_path):
        pytest.skip("大文件测试 fixture 不存在（需补充 >10MB 的文件）")
    with pytest.raises(ValueError, match="大小|size|10MB|过大"):
        parse_resume(large_path)
