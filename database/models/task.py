"""Task, TaskStep, TaskEvent, AgentRun, and ToolCall models."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import Field
from database.models.base import MongoBaseModel
from packages.contracts.models import (
    TaskPlan,
    DiffSummary,
    TestingResult,
    SecurityResult,
    ReviewResult,
)
from packages.shared.constants import TaskStatus, AgentRole


class Task(MongoBaseModel):
    organization_id: str
    user_id: str
    repository_id: str
    title: str
    description: str
    status: TaskStatus = TaskStatus.CREATED
    branch: Optional[str] = None
    target_branch: str = "main"
    constraints: List[str] = Field(default_factory=list)
    execution_policy: str = "standard"
    plan: Optional[TaskPlan] = None
    diff: Optional[DiffSummary] = None
    test_results: Optional[TestingResult] = None
    security_results: Optional[SecurityResult] = None
    review_results: Optional[ReviewResult] = None
    pull_request_url: Optional[str] = None
    pull_request_number: Optional[int] = None
    pr_status: Optional[str] = None
    merged_at: Optional[datetime] = None
    working_branch: Optional[str] = None
    base_commit: Optional[str] = None
    trace_id: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    locked_by: Optional[str] = None
    locked_at: Optional[datetime] = None
    heartbeat_at: Optional[datetime] = None


class TaskStep(MongoBaseModel):
    task_id: str
    step_number: int
    name: str
    agent: AgentRole
    status: str = "pending"
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None


class TaskEvent(MongoBaseModel):
    task_id: str
    run_id: str
    type: str
    actor: str
    status: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentRun(MongoBaseModel):
    task_id: str
    agent: AgentRole
    status: str  # running | completed | failed
    prompt_version: str = "v1"
    model_name: str
    input_tokens: int = 0
    output_tokens: int = 0
    duration_seconds: float = 0.0
    summary: Optional[str] = None
    error: Optional[str] = None


class ToolCall(MongoBaseModel):
    task_id: str
    run_id: str
    agent: AgentRole
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration_seconds: float = 0.0
    risk_level: str = "LOW"
