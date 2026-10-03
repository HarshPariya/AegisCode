"""User, Organization, and Membership repositories."""
from typing import Optional
from database.models.user import User, Organization, Membership
from database.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User, "users")

    async def _get_collection(self):
        """Alias for _col() for backward compatibility."""
        return await self._col()

    async def get_by_email(self, email: str) -> Optional[User]:
        col = await self._col()
        doc = await col.find_one({"email": email})
        if doc:
            return self._to_model(doc)
        return None

    async def get_by_username(self, username: str) -> Optional[User]:
        col = await self._col()
        doc = await col.find_one({"username": username})
        if doc:
            return self._to_model(doc)
        return None

    async def get_by_google_id(self, google_id: str) -> Optional[User]:
        col = await self._col()
        doc = await col.find_one({"google_id": google_id})
        if doc:
            return self._to_model(doc)
        return None

    async def get_by_github_id(self, github_user_id: str) -> Optional[User]:
        col = await self._col()
        doc = await col.find_one({"github_user_id": github_user_id})
        if doc:
            return self._to_model(doc)
        return None


class OrganizationRepository(BaseRepository[Organization]):
    def __init__(self):
        super().__init__(Organization, "organizations")

    async def _get_collection(self):
        return await self._col()

    async def get_by_slug(self, slug: str) -> Optional[Organization]:
        col = await self._col()
        doc = await col.find_one({"slug": slug})
        if doc:
            doc.pop("_id", None)
            try:
                return Organization.model_validate(doc)
            except Exception:
                return Organization(**doc)
        return None


class MembershipRepository(BaseRepository[Membership]):
    def __init__(self):
        super().__init__(Membership, "memberships")

    async def _get_collection(self):
        return await self._col()

    async def get_membership(self, organization_id: str, user_id: str) -> Optional[Membership]:
        col = await self._col()
        doc = await col.find_one({"organization_id": organization_id, "user_id": user_id})
        if doc:
            doc.pop("_id", None)
            try:
                return Membership.model_validate(doc)
            except Exception:
                return Membership(**doc)
        return None
