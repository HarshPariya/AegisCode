from typing import List, Optional
import asyncio
import json
from fastapi import APIRouter, HTTPException, Depends, Query, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from database.models.task import Task
from database.models.user import User, Organization
from database.repositories.task_repository import TaskRepository
from database.repositories.audit_repository import AuditRepository
from packages.contracts.models import (
    TaskCreateRequest,
    TaskResponse,
    DiffSummary,
    TaskEventPayload,
)
from packages.shared.constants import TaskStatus
from packages.shared.errors import WorkflowTransitionError, AuthorizationError
from orchestration.state.lifecycle import TaskStateManager
from services.api.dependencies import get_current_user, get_current_organization, get_optional_current_user
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.routes.tasks")

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


async def _run_workflow_background(task_id: str):
    """Background runner — executes multi-agent workflow for the given task."""
    task_repo = TaskRepository()
    task = await task_repo.get_by_id(task_id)
    if not task:
        logger.error(f"Background workflow: task {task_id} not found.")
        return
    from orchestration.graph.workflow import AegisWorkflowRunner
    runner = AegisWorkflowRunner()
    await runner.execute_task_workflow(task)


async def sync_task_pr_state_from_github(task: Task, organization_id: str) -> Task:
    """Sync real GitHub PR status (open, closed, merged) with the task and pull_request record in MongoDB."""
    if not task.pull_request_url or not task.pull_request_number:
        return task

    try:
        from database.repositories.repository_repository import GitHubInstallationRepository
        from database.models.pull_request import PullRequest
        from database.repositories.base import BaseRepository
        import httpx
        import re

        gh_install_repo = GitHubInstallationRepository()
        inst = None
        insts = await gh_install_repo.list_by_org(organization_id)
        for i in insts:
            if getattr(i, "auth_type", "app") == "pat" and i.access_token:
                inst = i
                break
        if not inst:
            all_insts = await gh_install_repo.list(limit=20)
            for i in all_insts:
                if getattr(i, "auth_type", "app") == "pat" and i.access_token:
                    inst = i
                    break

        if not inst or not inst.access_token:
            return task

        m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", task.pull_request_url)
        if not m:
            return task
        owner, repo, pr_num = m.group(1), m.group(2), int(m.group(3))

        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_num}",
                headers={
                    "Authorization": f"Bearer {inst.access_token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "AegisCode-App",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                is_merged = data.get("merged", False)
                state = data.get("state", "open")

                updates = {}
                task_repo = TaskRepository()
                pr_repo = BaseRepository(PullRequest, "pull_requests")

                if is_merged:
                    updates["status"] = TaskStatus.COMPLETED
                    updates["pr_status"] = "merged"
                    updates["merged_at"] = data.get("merged_at")
                    updates["error_message"] = None
                elif state == "open":
                    if task.status == TaskStatus.FAILED:
                        updates["status"] = TaskStatus.COMPLETED
                        updates["error_message"] = None
                    updates["pr_status"] = "open"

                if updates:
                    updated = await task_repo.update(task.id, updates, organization_id=organization_id)
                    if updated:
                        task = updated

                pr_docs = await pr_repo.list(query={"task_id": task.id}, limit=5)
                for pr_doc in pr_docs:
                    pr_state = "merged" if is_merged else state
                    await pr_repo.update(pr_doc.id, {"state": pr_state, "merged_at": data.get("merged_at")})
    except Exception as e:
        logger.warning(f"Failed to sync PR status for task {task.id}: {e}")

    return task


def map_task_to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        organization_id=task.organization_id,
        repository_id=task.repository_id,
        title=task.title,
        description=task.description,
        status=task.status,
        pr_status=getattr(task, "pr_status", None),
        merged_at=getattr(task, "merged_at", None),
        plan=task.plan,
        diff=task.diff,
        test_results=task.test_results,
        security_results=task.security_results,
        review_results=task.review_results,
        pull_request_url=task.pull_request_url,
        pull_request_number=task.pull_request_number,
        working_branch=task.working_branch,
        user_id=task.user_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    req: TaskCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Create a new engineering task and immediately dispatch async execution."""
    task_repo = TaskRepository()
    audit_repo = AuditRepository()

    task = Task(
        organization_id=current_org.id,
        user_id=current_user.id,
        repository_id=req.repository_id,
        title=req.title,
        description=req.description,
        branch=req.branch,
        constraints=req.constraints,
        execution_policy=req.execution_policy,
        status=TaskStatus.CREATED,
    )
    saved_task = await task_repo.create(task)

    await audit_repo.log_action(
        organization_id=current_org.id,
        user_id=current_user.id,
        task_id=saved_task.id,
        actor_type="user",
        actor_id=current_user.id,
        action="TASK_CREATED",
        resource=f"task:{saved_task.id}",
        result="SUCCESS",
        details={"title": req.title, "repository_id": req.repository_id}
    )

    # Immediately dispatch async multi-agent workflow — task runs in background
    # User can close browser; the cloud worker continues execution independently.
    background_tasks.add_task(_run_workflow_background, saved_task.id)
    logger.info(f"Task {saved_task.id} created and dispatched to background workflow runner.")

    return map_task_to_response(saved_task)


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    status_filter: Optional[TaskStatus] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    task_repo = TaskRepository()
    query = {}
    if status_filter:
        query["status"] = status_filter.value

    tasks = await task_repo.list(query=query, organization_id=current_org.id, skip=skip, limit=limit)
    return [map_task_to_response(t) for t in tasks]



@router.get("/{id}", response_model=TaskResponse)
async def get_task(
    id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    task_repo = TaskRepository()
    try:
        task = await task_repo.get_by_id(id, organization_id=current_org.id)
    except AuthorizationError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access to task denied across organizations")

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.pull_request_url and task.pull_request_number:
        task = await sync_task_pr_state_from_github(task, current_org.id)

    return map_task_to_response(task)


@router.post("/{id}/sync-pr", response_model=TaskResponse)
async def sync_task_pr(
    id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Manually force-synchronize GitHub PR status (open, closed, merged) with MongoDB."""
    task_repo = TaskRepository()
    task = await task_repo.get_by_id(id, organization_id=current_org.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.pull_request_url and task.pull_request_number:
        task = await sync_task_pr_state_from_github(task, current_org.id)

    return map_task_to_response(task)


@router.post("/{id}/cancel", response_model=TaskResponse)
async def cancel_task(
    id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    task_repo = TaskRepository()
    task = await task_repo.get_by_id(id, organization_id=current_org.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    state_mgr = TaskStateManager(task_repo)
    cancelled_task = await state_mgr.cancel_task(task, reason="Cancelled by developer")
    return map_task_to_response(cancelled_task)


@router.post("/{id}/resume", response_model=TaskResponse)
async def resume_task(
    id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    task_repo = TaskRepository()
    task = await task_repo.get_by_id(id, organization_id=current_org.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    state_mgr = TaskStateManager(task_repo)
    try:
        resumed_task = await state_mgr.resume_task(task)
        return map_task_to_response(resumed_task)
    except WorkflowTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)


@router.get("/{id}/events", response_model=List[TaskEventPayload])
async def get_task_events(
    id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    task_repo = TaskRepository()
    task = await task_repo.get_by_id(id, organization_id=current_org.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    events = await task_repo.list_events(id)
    return [
        TaskEventPayload(
            event_id=e.id,
            task_id=e.task_id,
            run_id=e.run_id,
            type=e.type,
            actor=e.actor,
            status=e.status,
            metadata=e.metadata,
            timestamp=e.timestamp,
        ) for e in events
    ]


@router.get("/{id}/events/stream")
async def stream_task_events(
    id: str,
    token: Optional[str] = Query(None),
):
    """Server-Sent Events (SSE) realtime stream for task lifecycle events."""
    from packages.shared.auth import decode_access_token
    if token:
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    async def event_generator():
        task_repo = TaskRepository()
        seen_event_ids = set()

        # Poll loop for real-time SSE push
        for _ in range(300):  # Maximum 5 minutes stream life
            events = await task_repo.list_events(id)
            for e in events:
                eid = getattr(e, "id", None) or f"{e.task_id}-{e.status}-{e.timestamp}"
                if eid not in seen_event_ids:
                    seen_event_ids.add(eid)
                    payload = {
                        "event_id": eid,
                        "task_id": e.task_id,
                        "run_id": e.run_id,
                        "type": e.type,
                        "actor": e.actor,
                        "status": e.status,
                        "metadata": e.metadata,
                        "timestamp": e.timestamp.isoformat() if hasattr(e.timestamp, "isoformat") else str(e.timestamp),
                    }
                    yield f"data: {json.dumps(payload)}\n\n"

            task = await task_repo.get_by_id(id)
            if task and str(getattr(task.status, "value", task.status)) in ("COMPLETED", "FAILED", "CANCELLED"):
                yield f'data: {json.dumps({"type": "task.stream.finished", "status": str(getattr(task.status, "value", task.status))})}\n\n'
                break

            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/{id}/diff", response_model=DiffSummary)
async def get_task_diff(
    id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    task_repo = TaskRepository()
    task = await task_repo.get_by_id(id, organization_id=current_org.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    return task.diff or DiffSummary()


# ---------------------------------------------------------------------------
# History endpoint — task-level permanent records (COMPLETED + FAILED tasks)
# ---------------------------------------------------------------------------

_history_router = APIRouter(prefix="/api", tags=["History"])


@_history_router.get("/history", response_model=List[TaskResponse])
async def get_history(
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Permanent task history: completed, failed, cancelled, and blocked tasks.
    Each record represents a task-level outcome — distinct from activity/audit events.
    """
    if not current_user:
        return []

    from database.repositories.user_repository import OrganizationRepository
    org_repo = OrganizationRepository()
    orgs = await org_repo.list({"owner_id": current_user.id}, limit=1)
    if not orgs:
        return []
    org_id = orgs[0].id

    task_repo = TaskRepository()

    # Default: show all terminal/completed states
    terminal_statuses = ["COMPLETED", "FAILED", "CANCELLED", "BLOCKED"]
    if status_filter and status_filter.upper() in terminal_statuses:
        query = {"status": status_filter.upper()}
    elif status_filter and status_filter.upper() == "ALL":
        query = {}
    else:
        # Return all task history regardless of status when no filter
        query = {}

    tasks = await task_repo.list(query=query, organization_id=org_id, skip=skip, limit=limit)

    # Apply search filter in memory (title search)
    if search:
        search_lower = search.lower()
        tasks = [
            t for t in tasks
            if search_lower in (t.title or "").lower()
            or search_lower in (t.repository_id or "").lower()
            or search_lower in (t.id or "").lower()
        ]

    return [map_task_to_response(t) for t in tasks]
