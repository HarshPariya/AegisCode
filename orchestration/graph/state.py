"""Typed state model for LangGraph agent orchestration."""
from typing import List, Optional
from pydantic import BaseModel, Field
from packages.contracts.models import (
    TaskPlan,
    ResearchResult,
    CodingResult,
    TestingResult,
    SecurityResult,
    ReviewResult,
    DiffSummary,
)
from packages.shared.constants import TaskStatus


class AgentTaskState(BaseModel):
    task_id: str
    organization_id: str
    user_id: str
    repository_id: str
    title: str
    description: str
    constraints: List[str] = Field(default_factory=list)
    execution_policy: str = "standard"

    # Workspace & Git
    workspace_id: str
    base_commit: str = "main"
    working_branch: str = "aegis/task-fix"

    # Step Checkpoints & Results
    plan: Optional[TaskPlan] = None
    research: Optional[ResearchResult] = None
    coding: Optional[CodingResult] = None
    testing: Optional[TestingResult] = None
    security: Optional[SecurityResult] = None
    review: Optional[ReviewResult] = None
    diff_summary: Optional[DiffSummary] = None

    # Repair & Cycle controls
    repair_count: int = 0
    max_repairs: int = 3
    repair_context: Optional[str] = None
    tokens_consumed: int = 0
    estimated_cost_usd: float = 0.0

    # Status & PR output
    status: TaskStatus = TaskStatus.CREATED
    requires_approval: bool = False
    approval_reason: Optional[str] = None
    pull_request_url: Optional[str] = None
    pull_request_number: Optional[int] = None
    error: Optional[str] = None
