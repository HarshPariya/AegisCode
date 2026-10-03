"""Task repository."""
from typing import Optional
from database.connection import get_database
from database.models.task import Task, TaskEvent
from database.repositories.base import BaseRepository
from packages.shared.errors import AuthorizationError


class TaskRepository(BaseRepository[Task]):
    def __init__(self):
        super().__init__(Task, "tasks")

    async def list(self, query: dict | None = None, organization_id: str | None = None, **kwargs) -> list[Task]:
        q = query or {}
        if organization_id:
            q["organization_id"] = organization_id
        return await super().list(q, **kwargs)

    async def get_by_id(self, id: str, organization_id: str | None = None) -> Optional[Task]:
        if organization_id:
            task = await super().get_by_id(id)
            if not task:
                return None
            if task.organization_id != organization_id:
                raise AuthorizationError(f"Task {id} does not belong to organization {organization_id}")
            return task
        return await super().get_by_id(id)

    async def update_status(self, id: str, status: str, organization_id: str) -> Optional[Task]:
        # Verify ownership first
        task = await self.get_by_id(id, organization_id=organization_id)
        if not task:
            return None
        return await self.update(id, {"status": status}, organization_id=organization_id)

    async def add_event(self, event) -> None:
        db = await get_database()
        events_col = db["task_events"]
        data = event.model_dump() if hasattr(event, "model_dump") else dict(event)
        await events_col.insert_one(data)

    async def list_events(self, task_id: str, limit: int = 500) -> list[TaskEvent]:
        db = await get_database()
        events_col = db["task_events"]
        cursor = events_col.find({"task_id": task_id}).sort("timestamp", 1).limit(limit)
        events = []
        async for doc in cursor:
            if "_id" in doc and "id" not in doc:
                doc["id"] = str(doc["_id"])
            doc.pop("_id", None)
            events.append(TaskEvent(**doc))
        return events

