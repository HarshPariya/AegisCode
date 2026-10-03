"""Constants and enum definitions for AegisCode."""
from enum import Enum


class TaskStatus(str, Enum):
    CREATED = "CREATED"
    QUEUED = "QUEUED"
    PLANNING = "PLANNING"
    RESEARCHING = "RESEARCHING"
    CODING = "CODING"
    TESTING = "TESTING"
    REPAIRING = "REPAIRING"
    SECURITY_REVIEW = "SECURITY_REVIEW"
    CODE_REVIEW = "CODE_REVIEW"
    WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
    CREATING_BRANCH = "CREATING_BRANCH"
    COMMITTING = "COMMITTING"
    CREATING_PR = "CREATING_PR"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    BLOCKED = "BLOCKED"


class AgentRole(str, Enum):
    SUPERVISOR = "supervisor"
    RESEARCHER = "researcher"
    CODER = "coder"
    TESTER = "tester"
    SECURITY = "security"
    REVIEWER = "reviewer"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class OrganizationRole(str, Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"


class EventType(str, Enum):
    TASK_CREATED = "task.created"
    TASK_STARTED = "task.started"
    PLAN_CREATED = "task.plan.created"
    AGENT_STARTED = "agent.started"
    AGENT_COMPLETED = "agent.completed"
    TOOL_STARTED = "tool.started"
    TOOL_COMPLETED = "tool.completed"
    TEST_STARTED = "test.started"
    TEST_COMPLETED = "test.completed"
    SECURITY_COMPLETED = "security.completed"
    REVIEW_COMPLETED = "review.completed"
    APPROVAL_REQUIRED = "approval.required"
    APPROVAL_COMPLETED = "approval.completed"
    PR_CREATED = "pr.created"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
    TASK_CANCELLED = "task.cancelled"
