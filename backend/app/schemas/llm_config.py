"""LLM 配置 Schema"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LLMConfigCreate(BaseModel):
    name: str
    base_url: str
    api_key: str
    model_name: str
    timeout: int = 120
    max_retries: int = 3


class LLMConfigUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    timeout: Optional[int] = None
    max_retries: Optional[int] = None


class LLMConfigOut(BaseModel):
    id: int
    name: str
    base_url: str
    api_key: str
    model_name: str
    timeout: int
    max_retries: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class LLMConfigTest(BaseModel):
    base_url: str
    api_key: str
    model_name: str


class LLMConfigTestResult(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[int] = None
