"""Audit log model and repository."""
from __future__ import annotations
from typing import Optional
from database.models.base import MongoBaseModel
from database.repositories.base import BaseRepository


class AuditLog(MongoBaseModel):
    organization_id: str
    action: str
    actor_type: str = "system"  # user | agent | system
    actor_id: Optional[str] = None
    resource: str = ""
    result: str = "success"
    details: dict = {}


class AuditRepository(BaseRepository[AuditLog]):
    def __init__(self):
        super().__init__(AuditLog, "audit_logs")

    async def log_action(
        self,
        organization_id: str,
        user_id: str,
        task_id: str,
        actor_type: str,
        actor_id: str,
        action: str,
        resource: str,
        result: str,
        details: dict | None = None
    ) -> AuditLog:
        audit_entry = AuditLog(
            organization_id=organization_id,
            action=action,
            actor_type=actor_type,
            actor_id=actor_id,
            resource=resource,
            result=result,
            details={
                **(details or {}),
                "user_id": user_id,
                "task_id": task_id
            }
        )
        return await self.create(audit_entry)
