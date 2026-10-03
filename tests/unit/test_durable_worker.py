"""Unit tests for DurableWorker lease locking, claiming, and crash recovery."""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from database.models.task import Task
from database.repositories.task_repository import TaskRepository
from database.connection import get_database
from packages.shared.constants import TaskStatus
from services.worker.main import DurableWorker, LEASE_TIMEOUT_SECONDS


@pytest.mark.asyncio
async def test_durable_worker_claim_and_release():
    task_repo = TaskRepository()
    uid = uuid.uuid4().hex[:6]

    # Create a task in QUEUED status
    task = Task(
        organization_id=f"org-{uid}",
        user_id=f"user-{uid}",
        repository_id=f"repo-{uid}",
        title="Durable Worker Test Task",
        description="Verify atomic claiming and lease management.",
        status=TaskStatus.QUEUED,
    )
    saved = await task_repo.create(task)

    worker_a = DurableWorker(worker_id=f"worker-a-{uid}")
    worker_b = DurableWorker(worker_id=f"worker-b-{uid}")

    # Worker A claims the task
    claimed_a = await worker_a.claim_next_task(saved.id)
    assert claimed_a is not None
    assert claimed_a.id == saved.id
    assert claimed_a.locked_by == worker_a.worker_id
    assert claimed_a.heartbeat_at is not None

    # Worker B tries to claim — must be None (mutual exclusion)
    claimed_b = await worker_b.claim_next_task(saved.id)
    assert claimed_b is None

    # Worker A releases the task
    await worker_a.release_task(saved.id)

    # Re-check database state
    db = await get_database()
    raw = await db.get_collection("tasks").find_one({"_id": saved.id})
    assert raw["locked_by"] is None


@pytest.mark.asyncio
async def test_durable_worker_crash_recovery_stale_lease():
    task_repo = TaskRepository()
    uid = uuid.uuid4().hex[:6]

    # Create an interrupted in-progress task with an expired heartbeat (simulating crashed worker)
    stale_heartbeat = datetime.now(timezone.utc) - timedelta(seconds=LEASE_TIMEOUT_SECONDS + 30)
    task = Task(
        organization_id=f"org-{uid}",
        user_id=f"user-{uid}",
        repository_id=f"repo-{uid}",
        title="Crashed Worker Recovery Task",
        description="Verify crash recovery picks up orphaned tasks.",
        status=TaskStatus.CODING,
        locked_by="crashed-worker-999",
        heartbeat_at=stale_heartbeat,
    )
    saved = await task_repo.create(task)

    # New worker comes online
    recovery_worker = DurableWorker(worker_id=f"recovery-worker-{uid}")

    # Recovery worker should reclaim the orphaned task
    recovered = await recovery_worker.claim_next_task(saved.id)
    assert recovered is not None
    assert recovered.id == saved.id
    assert recovered.locked_by == recovery_worker.worker_id

    # Clean up
    await recovery_worker.release_task(saved.id)
