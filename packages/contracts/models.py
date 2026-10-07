"""Strongly typed Pydantic contracts for API and Agent boundaries."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from packages.shared.constants import AgentRole, RiskLevel, TaskStatus


class PlanStep(BaseModel):
    step_number: int
    title: str
    description: str
    assigned_agent: AgentRole
    status: str = "pending"  # pending | running | completed | failed


class TaskPlan(BaseModel):
    goal: str
    summary: str
    steps: List[PlanStep] = Field(default_factory=list)
    estimated_complexity: str = "medium"  # low | medium | high
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskCreateRequest(BaseModel):
    repository_id: str
    title: str
    description: str
    branch: Optional[str] = None
    constraints: List[str] = Field(default_factory=list)
    execution_policy: str = "standard"  # standard | strict | auto_approve_low_risk


class FileDiff(BaseModel):
    file_path: str
    status: str  # modified | added | deleted
    additions: int = 0
    deletions: int = 0
    patch: str = ""


class DiffSummary(BaseModel):
    files_changed: int = 0
    total_additions: int = 0
    total_deletions: int = 0
    files: List[FileDiff] = Field(default_factory=list)


class ResearchResult(BaseModel):
    summary: str
    suspected_root_cause: str
    relevant_files: List[str] = Field(default_factory=list)
    related_tests: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    confidence: float = 1.0


class CodingResult(BaseModel):
    summary: str = "Code analysis and modifications completed."
    modified_files: List[str] = Field(default_factory=list)
    diff_summary: DiffSummary = Field(default_factory=DiffSummary)
    warnings: List[str] = Field(default_factory=list)

    @field_validator("diff_summary", mode="before")
    @classmethod
    def validate_diff_summary(cls, v):
        if v is None:
            return DiffSummary()
        return v

    @field_validator("modified_files", "warnings", mode="before")
    @classmethod
    def validate_lists(cls, v):
        if v is None:
            return []
        return v


class RevisedCodeFile(BaseModel):
    file_path: str
    content: str
    summary: str



class TestCaseResult(BaseModel):
    name: str
    status: str  # passed | failed | error | skipped
    duration_seconds: float = 0.0
    failure_message: Optional[str] = None


class TestingResult(BaseModel):
    passed: bool
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    test_cases: List[TestCaseResult] = Field(default_factory=list)
    raw_output: str = ""
    repair_needed: bool = False
    repair_analysis: Optional[str] = None


class SecurityFinding(BaseModel):
    severity: RiskLevel
    category: str
    description: str
    location: Optional[str] = None
    remediation: Optional[str] = None


class SecurityResult(BaseModel):
    passed: bool
    risk_level: RiskLevel
    findings: List[SecurityFinding] = Field(default_factory=list)
    summary: str


class ReviewFinding(BaseModel):
    severity: str  # info | warning | blocker
    category: str
    comment: str
    file_path: Optional[str] = None
    line: Optional[int] = None


class ReviewResult(BaseModel):
    status: str  # approved | changes_requested | blocked
    summary: str
    findings: List[ReviewFinding] = Field(default_factory=list)


class ApprovalRequestModel(BaseModel):
    approval_id: str
    task_id: str
    action: str
    reason: str
    risk_level: RiskLevel
    details: Dict[str, Any] = Field(default_factory=dict)
    status: str = "pending"  # pending | approved | rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ApprovalDecisionModel(BaseModel):
    decision: str  # approve | reject
    reviewer_notes: Optional[str] = None


class TaskEventPayload(BaseModel):
    event_id: str
    task_id: str
    run_id: str
    type: str
    actor: str
    status: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskResponse(BaseModel):
    id: str
    organization_id: str
    repository_id: str
    title: str
    description: str
    status: TaskStatus
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
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

