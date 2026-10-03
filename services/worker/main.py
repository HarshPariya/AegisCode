"""Durable Background Worker for AegisCode.

This worker runs independently of HTTP requests and the API process:
1. Polls MongoDB Atlas for tasks in QUEUED / CREATED status.
2. Recovers interrupted tasks whose heartbeat has expired (> 60s).
3. Atomically claims tasks via MongoDB find_one_and_update (lease-locking).
4. Executes the full multi-agent engineering lifecycle (AegisWorkflowRunner).
5. Periodically emits heartbeats to maintain task lease while executing.
6. Survives browser closure, API restarts, and worker restarts.

Usage:
    python -m services.worker.main
"""
import asyncio
import signal
import sys
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from database.connection import init_database, close_database, get_database
from database.models.task import Task
from database.repositories.task_repository import TaskRepository
from database.repositories.audit_repository import AuditRepository
from orchestration.graph.workflow import AegisWorkflowRunner
from packages.shared.constants import TaskStatus
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.durable_worker")

# Lease timeout — if no heartbeat for 60 seconds, task is considered orphaned
LEASE_TIMEOUT_SECONDS = 60
HEARTBEAT_INTERVAL_SECONDS = 10
POLL_INTERVAL_SECONDS = 2


class DurableWorker:
    """Production-grade durable background worker with atomic task leasing and crash recovery."""

    def __init__(self, worker_id: Optional[str] = None):
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.task_repo = TaskRepository()
        self.audit_repo = AuditRepository()
        self.is_running = False
        self._current_task_id: Optional[str] = None
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def claim_next_task(self, task_id: Optional[str] = None) -> Optional[Task]:
        """Atomically find and claim the next available or orphaned task from MongoDB."""
        db = await get_database()
        coll = db.get_collection("tasks")
        now = datetime.now(timezone.utc)
        stale_threshold = now - timedelta(seconds=LEASE_TIMEOUT_SECONDS)

        # Recoverable states (interrupted mid-execution)
        in_progress_statuses = [
            TaskStatus.PLANNING.value,
            TaskStatus.RESEARCHING.value,
            TaskStatus.CODING.value,
            TaskStatus.TESTING.value,
            TaskStatus.REPAIRING.value,
            TaskStatus.SECURITY_REVIEW.value,
            TaskStatus.CODE_REVIEW.value,
            TaskStatus.CREATING_BRANCH.value,
            TaskStatus.COMMITTING.value,
            TaskStatus.CREATING_PR.value,
        ]

        # Base candidate conditions
        base_or = [
            {
                "status": {"$in": [TaskStatus.QUEUED.value, TaskStatus.CREATED.value]},
                "$or": [
                    {"locked_by": None},
                    {"heartbeat_at": {"$lt": stale_threshold}},
                    {"heartbeat_at": None},
                ]
            },
            {
                "status": {"$in": in_progress_statuses},
                "$or": [
                    {"locked_by": None},
                    {"heartbeat_at": {"$lt": stale_threshold}},
                ]
            }
        ]

        if task_id:
            claim_filter = {"_id": task_id, "$or": base_or}
        else:
            claim_filter = {"$or": base_or}

        update_doc = {
            "$set": {
                "locked_by": self.worker_id,
                "locked_at": now,
                "heartbeat_at": now,
            }
        }

        # Atomic find and update prevents race conditions across multiple worker processes
        raw = await coll.find_one_and_update(
            claim_filter,
            update_doc,
            sort=[("created_at", 1)],
            return_document=True
        )

        if not raw:
            return None

        # Handle MongoDB _id mapping
        if "_id" in raw and "id" not in raw:
            raw["id"] = raw["_id"]
        return Task.model_validate(raw)

    async def _heartbeat_loop(self, task_id: str):
        """Maintain active lease on MongoDB task while executing."""
        db = await get_database()
        coll = db.get_collection("tasks")
        while self.is_running and self._current_task_id == task_id:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
                await coll.update_one(
                    {"_id": task_id, "locked_by": self.worker_id},
                    {"$set": {"heartbeat_at": datetime.now(timezone.utc)}}
                )
                logger.debug(f"Heartbeat sent for task {task_id} by {self.worker_id}")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Failed to send heartbeat for task {task_id}: {e}")

    async def release_task(self, task_id: str):
        """Release the worker lease on a completed or failed task."""
        db = await get_database()
        coll = db.get_collection("tasks")
        try:
            await coll.update_one(
                {"_id": task_id, "locked_by": self.worker_id},
                {"$set": {"locked_by": None, "heartbeat_at": None}}
            )
        except Exception as e:
            logger.warning(f"Could not release lock for task {task_id}: {e}")

    async def process_task(self, task: Task):
        """Execute the workflow for the claimed task with active heartbeat."""
        self._current_task_id = task.id
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop(task.id))
        logger.info(
            f"[{self.worker_id}] Processing claimed task {task.id} "
            f"('{task.title}') - Current status: {task.status}"
        )

        try:
            runner = AegisWorkflowRunner()
            state = await runner.execute_task_workflow(task)
            logger.info(
                f"[{self.worker_id}] Task {task.id} execution finished with status: {state.status}"
            )
        except Exception as e:
            logger.error(f"[{self.worker_id}] Error executing task {task.id}: {e}", exc_info=True)
        finally:
            if self._heartbeat_task and not self._heartbeat_task.done():
                self._heartbeat_task.cancel()
                try:
                    await self._heartbeat_task
                except asyncio.CancelledError:
                    pass
            await self.release_task(task.id)
            self._current_task_id = None
            self._heartbeat_task = None

    async def start(self):
        """Start the worker polling loop."""
        self.is_running = True
        logger.info(f"Durable Worker [{self.worker_id}] started. Polling MongoDB for tasks...")

        while self.is_running:
            try:
                task = await self.claim_next_task()
                if task:
                    await self.process_task(task)
                else:
                    await asyncio.sleep(POLL_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                logger.info(f"Durable Worker [{self.worker_id}] shutting down...")
                break
            except Exception as e:
                logger.error(f"Durable Worker [{self.worker_id}] polling error: {e}", exc_info=True)
                await asyncio.sleep(POLL_INTERVAL_SECONDS)

        self.is_running = False
        logger.info(f"Durable Worker [{self.worker_id}] stopped cleanly.")

    def stop(self):
        """Signal the worker to stop gracefully."""
        self.is_running = False


async def run_worker():
    """Main worker entrypoint."""
    logger.info("Initializing AegisCode Durable Worker Engine...")
    await init_database()

    worker = DurableWorker()
    stop_event = asyncio.Event()

    def handle_exit(*args):
        logger.info("Shutdown signal received.")
        worker.stop()
        stop_event.set()

    # Register OS signal handlers if supported (non-Windows or main thread)
    loop = asyncio.get_running_loop()
    try:
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, handle_exit)
    except (NotImplementedError, AttributeError):
        # Fallback for Windows
        signal.signal(signal.SIGINT, lambda s, f: handle_exit())
        signal.signal(signal.SIGTERM, lambda s, f: handle_exit())

    worker_task = asyncio.create_task(worker.start())

    try:
        await stop_event.wait()
    except asyncio.CancelledError:
        pass
    finally:
        worker.stop()
        if not worker_task.done():
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
        await close_database()
        logger.info("Durable Worker shutdown complete.")


if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Worker process interrupted by user.")
        sys.exit(0)
