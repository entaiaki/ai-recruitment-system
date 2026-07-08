"""Harness 全局配置

pytest 插件、fixture、自定义标记一切在此定义。
"""
import pytest


def pytest_configure(config):
    """注册自定义标记"""
    config.addinivalue_line(
        "markers",
        "scoring: 打分相关测试（模块 D）"
    )
    config.addinivalue_line(
        "markers",
        "permissions: 权限隔离测试（模块 A）"
    )
    config.addinivalue_line(
        "markers",
        "pipeline: 候选人状态机测试（模块 E）"
    )
    config.addinivalue_line(
        "markers",
        "resume: 简历解析测试（模块 C）"
    )
    config.addinivalue_line(
        "markers",
        "slow: 耗时测试（如稳定性 5 次打分）"
    )
    config.addinivalue_line(
        "markers",
        "integration: 需要外部 API 的集成测试"
    )
