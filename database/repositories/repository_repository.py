"""Repository and GitHubInstallation repositories."""
from typing import Optional
import uuid
from database.models.base import utc_now
from database.models.repository import Repository, GitHubInstallation
from database.repositories.base import BaseRepository


class RepositoryRepository(BaseRepository[Repository]):
    def __init__(self):
        super().__init__(Repository, "repositories")

    async def list_by_org(self, organization_id: str, limit: int = 500) -> list[Repository]:
        return await self.list(query={"organization_id": organization_id}, limit=limit)

    async def delete_by_installation(self, organization_id: str, installation_id: int | str) -> bool:
        col = await self._col()
        try:
            int_id = int(installation_id)
        except (ValueError, TypeError):
            int_id = None
        str_id = str(installation_id)
        candidates = [str_id]
        if int_id is not None:
            candidates.append(int_id)

        res = await col.delete_many({
            "organization_id": organization_id,
            "$or": [
                {"github_installation_id": {"$in": candidates}},
                {"installation_id": {"$in": candidates}},
            ],
        })
        return res.deleted_count > 0

    async def delete_by_org(self, organization_id: str) -> bool:
        col = await self._col()
        res = await col.delete_many({"organization_id": organization_id})
        return res.deleted_count > 0

    async def upsert_from_github(
        self,
        organization_id: str,
        github_installation_id: int,
        repo_data: dict,
    ) -> Repository:
        col = await self._col()
        full_name = repo_data.get("full_name") or f"{repo_data.get('owner', {}).get('login', '')}/{repo_data.get('name', '')}"
        owner_login = repo_data.get("owner", {}).get("login", "") if isinstance(repo_data.get("owner"), dict) else str(repo_data.get("owner") or "")
        is_private = bool(repo_data.get("private", False))

        existing = await col.find_one({
            "organization_id": organization_id,
            "full_name": full_name,
        })

        repo_dict = {
            "organization_id": organization_id,
            "github_repo_id": repo_data.get("id"),
            "github_installation_id": github_installation_id,
            "installation_id": github_installation_id,
            "name": repo_data.get("name", ""),
            "full_name": full_name,
            "owner": owner_login,
            "owner_login": owner_login,
            "default_branch": repo_data.get("default_branch") or "main",
            "clone_url": repo_data.get("clone_url") or f"https://github.com/{full_name}.git",
            "private": is_private,
            "is_private": is_private,
            "description": repo_data.get("description"),
            "language": repo_data.get("language"),
            "indexing_status": existing.get("indexing_status", "NOT_INDEXED") if existing else "NOT_INDEXED",
            "last_indexed_commit": existing.get("last_indexed_commit") if existing else None,
            "updated_at": utc_now(),
        }

        if existing:
            repo_id = existing.get("id") or str(existing.get("_id"))
            repo_dict["id"] = repo_id
            await col.update_one({"_id": existing["_id"]}, {"$set": repo_dict})
            doc = await col.find_one({"_id": existing["_id"]})
        else:
            new_id = str(uuid.uuid4())
            repo_dict["id"] = new_id
            repo_dict["_id"] = new_id
            repo_dict["created_at"] = utc_now()
            await col.insert_one(repo_dict)
            doc = repo_dict

        return self._to_model(doc)


class GitHubInstallationRepository(BaseRepository[GitHubInstallation]):
    def __init__(self):
        super().__init__(GitHubInstallation, "github_installations")

    async def list_by_org(self, organization_id: str) -> list[GitHubInstallation]:
        return await self.list(query={"organization_id": organization_id}, limit=100)

    async def get_by_installation_id(self, installation_id: int | str, organization_id: Optional[str] = None) -> Optional[GitHubInstallation]:
        col = await self._col()
        try:
            int_id = int(installation_id)
        except (ValueError, TypeError):
            int_id = None
        str_id = str(installation_id)
        candidates = [str_id]
        if int_id is not None:
            candidates.append(int_id)
        q: dict = {"installation_id": {"$in": candidates}}
        if organization_id:
            q["organization_id"] = organization_id
        doc = await col.find_one(q)
        if not doc and organization_id:
            doc = await col.find_one({"installation_id": {"$in": candidates}})
        return self._to_model(doc) if doc else None

    async def upsert(self, installation: GitHubInstallation) -> GitHubInstallation:
        col = await self._col()
        data = installation.model_dump()
        if "id" in data and "_id" not in data:
            data["_id"] = data["id"]
        data["updated_at"] = utc_now()
        await col.update_one(
            {"organization_id": installation.organization_id, "installation_id": installation.installation_id},
            {"$set": data},
            upsert=True
        )
        return installation

    async def delete_by_installation_and_org(self, installation_id: int | str, organization_id: str) -> bool:
        col = await self._col()
        try:
            int_id = int(installation_id)
        except (ValueError, TypeError):
            int_id = None
        str_id = str(installation_id)
        candidates = [str_id]
        if int_id is not None:
            candidates.append(int_id)
        res = await col.delete_many({"installation_id": {"$in": candidates}, "organization_id": organization_id})
        return res.deleted_count > 0

    async def delete_by_org(self, organization_id: str) -> bool:
        col = await self._col()
        res = await col.delete_many({"organization_id": organization_id})
        return res.deleted_count > 0
