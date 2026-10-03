from datetime import datetime
from typing import Optional
from database.models.base import MongoBaseModel


class Approval(MongoBaseModel):
    task_id: str
    organization_id: str
    requested_by: str = "system"  # user_id or agent
    requested_by_agent: str = "supervisor"
    action: str = "High-Risk Operation"
    approved_by: Optional[str] = None
    status: str = "pending"  # pending | approved | rejected
    risk_level: str = "MEDIUM"
    reason: str = ""
    decision: Optional[str] = None
    decision_reason: Optional[str] = None
    decision_note: Optional[str] = None
    decided_by_user_id: Optional[str] = None
    decided_at: Optional[datetime] = None
    diff: Optional[str] = None

