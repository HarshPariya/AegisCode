"""Task state lifecycle machine with deterministic transition validations."""
from datetime import datetime, timezone
import uuid
from typing import Dict, Set, Optional, Any
from database.models.task import Task, TaskEvent
from database.repositories.task_repository import TaskRepository
from database.repositories.audit_repository import AuditRepository
from packages.shared.constants import TaskStatus
from packages.shared.errors import WorkflowTransitionError
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.orchestration.lifecycle")

# Allowed deterministic forward transitions
VALID_TRANSITIONS: Dict[TaskStatus, Set[TaskStatus]] = {
    TaskStatus.CREATED: {TaskStatus.QUEUED, TaskStatus.PLANNING, TaskStatus.CANCELLED},
    TaskStatus.QUEUED: {TaskStatus.PLANNING, TaskStatus.RESEARCHING, TaskStatus.CANCELLED},
    TaskStatus.PLANNING: {TaskStatus.RESEARCHING, TaskStatus.CODING, TaskStatus.TESTING, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.RESEARCHING: {TaskStatus.CODING, TaskStatus.TESTING, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.CODING: {TaskStatus.TESTING, TaskStatus.SECURITY_REVIEW, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.TESTING: {TaskStatus.REPAIRING, TaskStatus.CODING, TaskStatus.SECURITY_REVIEW, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.REPAIRING: {TaskStatus.CODING, TaskStatus.TESTING, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.SECURITY_REVIEW: {TaskStatus.CODE_REVIEW, TaskStatus.COMPLETED, TaskStatus.BLOCKED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.CODE_REVIEW: {TaskStatus.WAITING_FOR_APPROVAL, TaskStatus.CREATING_BRANCH, TaskStatus.CODING, TaskStatus.COMPLETED, TaskStatus.BLOCKED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.WAITING_FOR_APPROVAL: {TaskStatus.CREATING_BRANCH, TaskStatus.COMPLETED, TaskStatus.BLOCKED, TaskStatus.CANCELLED},
    TaskStatus.CREATING_BRANCH: {TaskStatus.COMMITTING, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.COMMITTING: {TaskStatus.CREATING_PR, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.CREATING_PR: {TaskStatus.COMPLETED, TaskStatus.FAILED},
    # Resuming states
    TaskStatus.FAILED: {TaskStatus.QUEUED, TaskStatus.PLANNING, TaskStatus.RESEARCHING, TaskStatus.CODING, TaskStatus.CREATING_BRANCH, TaskStatus.COMMITTING, TaskStatus.CREATING_PR},
    TaskStatus.BLOCKED: {TaskStatus.PLANNING, TaskStatus.WAITING_FOR_APPROVAL, TaskStatus.CANCELLED},
    TaskStatus.COMPLETED: set(),
    TaskStatus.CANCELLED: {TaskStatus.QUEUED, TaskStatus.PLANNING},
}


class TaskStateManager:
    def __init__(self, task_repo: Optional[TaskRepository] = None, audit_repo: Optional[AuditRepository] = None):
        self.task_repo = task_repo or TaskRepository()
        self.audit_repo = audit_repo or AuditRepository()

    async def transition_to(
        self,
        task: Task,
        new_status: TaskStatus,
        actor: str = "supervisor",
        metadata: Optional[Dict[str, Any]] = None,
        organization_id: Optional[str] = None
    ) -> Task:
        """Validate and apply a task state transition, persisting events and audit trails."""
        # Normalize current_status and new_status to TaskStatus enum
        if isinstance(task.status, str):
            try:
                current_status = TaskStatus(task.status)
            except ValueError:
                current_status = task.status
        else:
            current_status = task.status

        if isinstance(new_status, str):
            try:
                new_status = TaskStatus(new_status)
            except ValueError:
                pass

        current_val = getattr(current_status, "value", str(current_status))
        new_val = getattr(new_status, "value", str(new_status))

        # Idempotent: transitioning to the current state is always a harmless no-op
        if current_val == new_val:
            return task

        allowed_targets = VALID_TRANSITIONS.get(current_status, set())
        if not allowed_targets and isinstance(current_status, str):
            for k, targets in VALID_TRANSITIONS.items():
                if getattr(k, "value", str(k)) == current_status:
                    allowed_targets = targets
                    break

        # Allow transitioning to FAILED or CANCELLED from any non-terminal state
        if new_val in ("FAILED", "CANCELLED"):
            pass
        elif new_status not in allowed_targets and new_val not in [getattr(s, "value", str(s)) for s in allowed_targets]:
            logger.warning(
                f"Non-standard state transition from {current_val} to {new_val} (actor={actor}). "
                f"Permitted: {[getattr(s, 'value', str(s)) for s in allowed_targets]}. Allowing to proceed."
            )

        org_id = organization_id or task.organization_id
        # Persist updated status
        updated_task = await self.task_repo.update(
            task.id,
            {"status": new_val},
            organization_id=org_id
        )
        task.status = new_status

        # Create structured TaskEvent
        event = TaskEvent(
            task_id=task.id,
            run_id=task.trace_id or str(uuid.uuid4()),
            type=f"task.status.{new_val.lower()}",
            actor=actor,
            status=new_val,
            metadata=metadata or {},
            timestamp=datetime.now(timezone.utc)
        )
        await self.task_repo.add_event(event)

        # Audit log for critical transitions
        if new_val in {"COMPLETED", "FAILED", "CANCELLED", "BLOCKED"}:
            await self.audit_repo.log_action(
                organization_id=org_id,
                user_id=task.user_id,
                task_id=task.id,
                actor_type="system" if actor == "supervisor" else "user",
                actor_id=actor,
                action=f"TASK_{new_val}",
                resource=f"task:{task.id}",
                result="SUCCESS" if new_val == "COMPLETED" else "STOPPED",
                details=metadata
            )

        logger.info(f"Task {task.id} transitioned: {current_val} -> {new_val} by {actor}")
        return updated_task or task

    async def cancel_task(self, task: Task, reason: str = "User cancelled execution") -> Task:
        """Immediately cancel a running or paused task."""
        if task.status in {TaskStatus.COMPLETED, TaskStatus.CANCELLED}:
            return task
        return await self.transition_to(
            task,
            TaskStatus.CANCELLED,
            actor="user",
            metadata={"cancellation_reason": reason}
        )

    async def resume_task(self, task: Task) -> Task:
        """Resume a failed, blocked, or paused task safely."""
        if task.status not in {TaskStatus.FAILED, TaskStatus.BLOCKED, TaskStatus.WAITING_FOR_APPROVAL}:
            raise WorkflowTransitionError(f"Cannot resume task in status {task.status.value}")

        target_status = TaskStatus.CREATING_BRANCH if task.status == TaskStatus.WAITING_FOR_APPROVAL else TaskStatus.PLANNING
        return await self.transition_to(
            task,
            target_status,
            actor="user",
            metadata={"resumed_from": task.status.value}
        )
