import asyncio
import json
from typing import AsyncGenerator, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.responses import StreamingResponse
from database.models.user import User
from database.repositories.task_repository import TaskRepository
from database.repositories.user_repository import UserRepository, OrganizationRepository
from packages.shared.auth import decode_access_token
from services.api.dependencies import get_optional_current_user

router = APIRouter(prefix="/api/tasks", tags=["Realtime Events"])


@router.get("/{task_id}/events/stream")
async def stream_task_events(
    task_id: str,
    token: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Stream live task events via Server-Sent Events (SSE) with query token or header authentication."""
    org_id = None
    user = current_user

    if token:
        try:
            payload = decode_access_token(token)
            user_id = payload.get("sub")
            org_id = payload.get("org_id")
            if user_id and not user:
                user_repo = UserRepository()
                user = await user_repo.get_by_id(user_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired stream token"
            )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication for stream"
        )

    if not org_id:
        org_repo = OrganizationRepository()
        orgs = await org_repo.list({"owner_id": user.id}, limit=1)
        if orgs:
            org_id = orgs[0].id

    task_repo = TaskRepository()
    task = await task_repo.get_by_id(task_id, organization_id=org_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        last_event_count = 0
        poll_intervals = 0
        max_polls = 120  # Stream for up to ~2 minutes or until completed/failed

        while poll_intervals < max_polls:
            events = await task_repo.list_events(task_id, limit=100)
            if len(events) > last_event_count:
                new_events = events[last_event_count:]
                for ev in new_events:
                    payload = {
                        "event_id": ev.id,
                        "task_id": ev.task_id,
                        "type": ev.type,
                        "actor": ev.actor,
                        "status": ev.status,
                        "metadata": ev.metadata,
                        "timestamp": ev.timestamp.isoformat()
                    }
                    yield f"data: {json.dumps(payload)}\n\n"
                last_event_count = len(events)

            # Check if task reached final terminal state
            current_task = await task_repo.get_by_id(task_id, organization_id=org_id)
            task_status_val = getattr(current_task.status, "value", current_task.status) if current_task else None
            if task_status_val in {"COMPLETED", "FAILED", "CANCELLED", "BLOCKED"}:
                terminal_event = {
                    "event_id": "terminal",
                    "task_id": task_id,
                    "type": "task.stream.finished",
                    "actor": "system",
                    "status": task_status_val,
                    "metadata": {}
                }
                yield f"data: {json.dumps(terminal_event)}\n\n"
                break

            # Heartbeat ping to keep connection alive
            yield ": ping\n\n"
            await asyncio.sleep(1.0)
            poll_intervals += 1

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
