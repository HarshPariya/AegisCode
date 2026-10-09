"""Human-in-the-loop approval endpoints."""
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks, Query
from pydantic import BaseModel
from database.models.approval import Approval
from database.models.task import Task
from database.models.user import User, Organization
from database.repositories.base import BaseRepository
from database.repositories.task_repository import TaskRepository
from database.repositories.audit_repository import AuditRepository
from orchestration.state.lifecycle import TaskStateManager
from packages.contracts.models import ApprovalDecisionModel, DiffSummary
from packages.shared.constants import TaskStatus, RiskLevel
from services.api.dependencies import get_current_user, get_current_organization

router = APIRouter(prefix="/api", tags=["Approvals"])


async def resume_workflow_background(task_id: str):
    from services.api.routes.tasks import _run_workflow_background
    await _run_workflow_background(task_id)


class ApprovalResponse(BaseModel):
    id: str
    organization_id: str
    task_id: str
    task_title: Optional[str] = None
    action: str
    reason: str
    risk_level: RiskLevel
    status: str
    requested_by_agent: str
    created_at: datetime
    decision_reason: Optional[str] = None
    decided_at: Optional[datetime] = None
    diff: Optional[str] = None


def _extract_diff_string(approval: Approval, task: Optional[Task]) -> Optional[str]:
    diff_val = getattr(approval, "diff", None)
    if diff_val and isinstance(diff_val, str):
        return diff_val
    if task and task.diff:
        if isinstance(task.diff, DiffSummary) and task.diff.files:
            return "\n".join(f.patch for f in task.diff.files if f.patch)
        elif isinstance(task.diff, dict) and task.diff.get("files"):
            return "\n".join(f.get("patch", "") for f in task.diff["files"] if f.get("patch"))
        elif isinstance(task.diff, str):
            return task.diff
    return None


@router.get("/approvals", response_model=List[ApprovalResponse])
async def list_pending_approvals(
    status: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """List approvals strictly for the authenticated user's organization."""
    approval_repo = BaseRepository(Approval, "approvals")

    query = {}
    if status and status.lower() != "all":
        query["status"] = status.lower()

    approvals = await approval_repo.list(
        query=query,
        organization_id=current_org.id,
        sort_field="created_at",
        sort_direction=-1,
    )

    task_repo = TaskRepository()
    results = []
    for a in approvals:
        task = await task_repo.get_by_id(a.task_id, organization_id=current_org.id)
        task_title = task.title if task else "Autonomous Engineering Task"
        results.append(
            ApprovalResponse(
                id=a.id,
                organization_id=a.organization_id,
                task_id=a.task_id,
                task_title=task_title,
                action=getattr(a, "action", "") or "High-Risk Code / Workflow Operation",
                reason=a.reason or "",
                risk_level=getattr(a, "risk_level", "MEDIUM") or "MEDIUM",
                status=a.status,
                requested_by_agent=getattr(a, "requested_by_agent", "") or getattr(a, "requested_by", "supervisor"),
                created_at=a.created_at,
                decision_reason=getattr(a, "decision_reason", None) or getattr(a, "decision_note", None),
                decided_at=getattr(a, "decided_at", None),
                diff=_extract_diff_string(a, task),
            )
        )
    return results


@router.get("/tasks/{task_id}/approvals", response_model=List[ApprovalResponse])
async def get_task_approvals(
    task_id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Retrieve approvals for a specific task."""
    approval_repo = BaseRepository(Approval, "approvals")
    approvals = await approval_repo.list(
        query={"task_id": task_id},
        organization_id=current_org.id
    )
    task_repo = TaskRepository()
    task = await task_repo.get_by_id(task_id, organization_id=current_org.id)
    task_title = task.title if task else "Autonomous Engineering Task"

    return [
        ApprovalResponse(
            id=a.id,
            organization_id=a.organization_id,
            task_id=a.task_id,
            task_title=task_title,
            action=getattr(a, "action", "") or "High-Risk Code / Workflow Operation",
            reason=a.reason or "",
            risk_level=getattr(a, "risk_level", "MEDIUM") or "MEDIUM",
            status=a.status,
            requested_by_agent=getattr(a, "requested_by_agent", "") or getattr(a, "requested_by", "supervisor"),
            created_at=a.created_at,
            decision_reason=getattr(a, "decision_reason", None) or getattr(a, "decision_note", None),
            decided_at=getattr(a, "decided_at", None),
            diff=_extract_diff_string(a, task),
        ) for a in approvals
    ]



@router.post("/tasks/{task_id}/approve")
async def approve_task_action(
    task_id: str,
    decision: ApprovalDecisionModel,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Approve a paused high-risk task action and resume execution."""
    task_repo = TaskRepository()
    audit_repo = AuditRepository()
    approval_repo = BaseRepository(Approval, "approvals")

    task = await task_repo.get_by_id(task_id, organization_id=current_org.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Update approval records
    pending_approvals = await approval_repo.list(
        query={"task_id": task_id, "status": "pending"},
        organization_id=current_org.id
    )
    for app in pending_approvals:
        await approval_repo.update(
            app.id,
            {
                "status": "approved",
                "decision": "approved",
                "decision_reason": decision.reviewer_notes,
                "decided_by_user_id": current_user.id,
                "decided_at": datetime.now(timezone.utc),
            },
            organization_id=current_org.id
        )

    await audit_repo.log_action(
        organization_id=current_org.id,
        user_id=current_user.id,
        task_id=task_id,
        actor_type="user",
        actor_id=current_user.id,
        action="APPROVAL_GRANTED",
        resource=f"task:{task_id}",
        result="SUCCESS",
        details={"notes": decision.reviewer_notes}
    )

    # Resume task and re-dispatch workflow background runner only if actively waiting for approval
    state_mgr = TaskStateManager(task_repo, audit_repo)
    if task.status == TaskStatus.WAITING_FOR_APPROVAL:
        resumed_task = await state_mgr.resume_task(task)
        background_tasks.add_task(resume_workflow_background, task_id)
        return {"status": "approved", "resumed_status": resumed_task.status.value}

    return {"status": "approved", "task_status": task.status.value}


@router.post("/tasks/{task_id}/reject")
async def reject_task_action(
    task_id: str,
    decision: ApprovalDecisionModel,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Reject a high-risk task action and mark task as blocked."""
    task_repo = TaskRepository()
    audit_repo = AuditRepository()
    approval_repo = BaseRepository(Approval, "approvals")

    task = await task_repo.get_by_id(task_id, organization_id=current_org.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Update approval records
    pending_approvals = await approval_repo.list(
        query={"task_id": task_id, "status": "pending"},
        organization_id=current_org.id
    )
    for app in pending_approvals:
        await approval_repo.update(
            app.id,
            {
                "status": "rejected",
                "decision": "rejected",
                "decision_reason": decision.reviewer_notes,
                "decided_by_user_id": current_user.id,
                "decided_at": datetime.now(timezone.utc),
            },
            organization_id=current_org.id
        )

    await audit_repo.log_action(
        organization_id=current_org.id,
        user_id=current_user.id,
        task_id=task_id,
        actor_type="user",
        actor_id=current_user.id,
        action="APPROVAL_REJECTED",
        resource=f"task:{task_id}",
        result="BLOCKED",
        details={"notes": decision.reviewer_notes}
    )

    state_mgr = TaskStateManager(task_repo, audit_repo)
    if task.status == TaskStatus.WAITING_FOR_APPROVAL:
        blocked_task = await state_mgr.transition_to(
            task,
            TaskStatus.BLOCKED,
            actor="user",
            metadata={"rejection_reason": decision.reviewer_notes or "Rejected by user"}
        )
        return {"status": "rejected", "task_status": blocked_task.status.value}

    return {"status": "rejected", "task_status": task.status.value}


@router.post("/approvals/{approval_id}/approve")
async def approve_by_id(
    approval_id: str,
    decision: ApprovalDecisionModel,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    approval_repo = BaseRepository(Approval, "approvals")
    app = await approval_repo.get_by_id(approval_id, organization_id=current_org.id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found")

    await approval_repo.update(
        app.id,
        {
            "status": "approved",
            "decision": "approved",
            "decision_reason": decision.reviewer_notes,
            "decided_by_user_id": current_user.id,
            "decided_at": datetime.now(timezone.utc),
        },
        organization_id=current_org.id
    )

    return await approve_task_action(
        task_id=app.task_id,
        decision=decision,
        background_tasks=background_tasks,
        current_user=current_user,
        current_org=current_org,
    )


@router.post("/approvals/{approval_id}/reject")
async def reject_by_id(
    approval_id: str,
    decision: ApprovalDecisionModel,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    approval_repo = BaseRepository(Approval, "approvals")
    app = await approval_repo.get_by_id(approval_id, organization_id=current_org.id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found")

    await approval_repo.update(
        app.id,
        {
            "status": "rejected",
            "decision": "rejected",
            "decision_reason": decision.reviewer_notes,
            "decided_by_user_id": current_user.id,
            "decided_at": datetime.now(timezone.utc),
        },
        organization_id=current_org.id
    )

    return await reject_task_action(
        task_id=app.task_id,
        decision=decision,
        current_user=current_user,
        current_org=current_org,
    )


@router.post("/approvals/simulate", response_model=ApprovalResponse)
async def simulate_approval_request(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Generate a realistic high-risk approval request for testing human-in-the-loop workflows."""
    from packages.config.settings import get_settings
    settings = get_settings()
    if settings.is_production or settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Simulation endpoints are disabled in production environment."
        )
    task_repo = TaskRepository()
    tasks = await task_repo.list(organization_id=current_org.id, limit=5)
    task_id = tasks[0].id if tasks else "sim-task-001"
    task_title = tasks[0].title if tasks else "Autonomous Security Refactor"

    approval_repo = BaseRepository(Approval, "approvals")
    mock_approval = Approval(
        organization_id=current_org.id,
        task_id=task_id,
        requested_by=current_user.id,
        requested_by_agent="security",
        action="Execute sandboxed schema migration & shell command",
        reason="Security Agent detected a database migration script altering the user_sessions index. Policy requires human confirmation before executing DDL commands in production sandbox.",
        risk_level=RiskLevel.HIGH,
        status="pending",
        diff="""diff --git a/migrations/004_jwt_session_indexes.sql b/migrations/004_jwt_session_indexes.sql
new file mode 100644
--- /dev/null
+++ b/migrations/004_jwt_session_indexes.sql
@@ -0,0 +1,5 @@
+-- High-risk operational migration: altering session revocation index
+CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_revoked_tokens ON auth_tokens (token_hash, expires_at);
+ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS chk_token_validity;
+COMMIT;""",
    )
    saved = await approval_repo.create(mock_approval)
    return ApprovalResponse(
        id=saved.id,
        organization_id=saved.organization_id,
        task_id=saved.task_id,
        task_title=task_title,
        action=saved.action,
        reason=saved.reason,
        risk_level=RiskLevel.HIGH,
        status=saved.status,
        requested_by_agent=saved.requested_by_agent,
        created_at=saved.created_at,
        diff=saved.diff,
    )
