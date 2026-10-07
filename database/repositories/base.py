"""Generic base repository using Motor (async MongoDB)."""
from __future__ import annotations
from typing import Generic, Optional, Type, TypeVar
from database.connection import get_database
from database.models.base import MongoBaseModel, utc_now

T = TypeVar("T", bound=MongoBaseModel)


class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T], collection_name: str):
        self.model = model
        self.collection_name = collection_name

    async def _col(self):
        db = await get_database()
        return db[self.collection_name]

    # Alias for backward compatibility
    async def _get_collection(self):
        return await self._col()

    def _to_model(self, doc: dict) -> T:
        if "id" not in doc and "_id" in doc:
            doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        try:
            return self.model.model_validate(doc)
        except Exception:
            return self.model(**doc)

    async def create(self, obj: T) -> T:
        col = await self._col()
        data = obj.model_dump()
        if "id" in data and "_id" not in data:
            data["_id"] = data["id"]
        await col.insert_one(data)
        return obj

    async def get_by_id(self, id: str, **kwargs) -> Optional[T]:
        col = await self._col()
        query = {"$or": [{"id": id}, {"_id": id}]}
        query.update(kwargs)
        doc = await col.find_one(query)
        if doc:
            return self._to_model(doc)
        return None

    async def update(self, id: str, updates: dict, **kwargs) -> Optional[T]:
        col = await self._col()
        updates["updated_at"] = utc_now()
        query = {"$or": [{"id": id}, {"_id": id}]}
        query.update(kwargs)
        await col.update_one(query, {"$set": updates})
        return await self.get_by_id(id)

    async def delete(self, id: str) -> bool:
        col = await self._col()
        result = await col.delete_one({"$or": [{"id": id}, {"_id": id}]})
        return result.deleted_count > 0

    async def list(
        self,
        query: dict | None = None,
        skip: int = 0,
        limit: int = 100,
        sort_field: str = "created_at",
        sort_direction: int = -1,
        **kwargs,
    ) -> list[T]:
        col = await self._col()
        q = query or {}
        q.update(kwargs)
        cursor = col.find(q, allow_disk_use=True).sort(sort_field, sort_direction).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        results = []
        for d in docs:
            try:
                results.append(self._to_model(d))
            except Exception:
                pass
        return results

    async def count(self, query: dict | None = None) -> int:
        col = await self._col()
        return await col.count_documents(query or {})
