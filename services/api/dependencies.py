"""FastAPI dependency injection helpers."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from packages.shared.auth import decode_access_token
from database.models.user import User, Organization
from database.repositories.user_repository import UserRepository, OrganizationRepository

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    repo = UserRepository()
    user = await repo.get_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Optional[User]:
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


async def get_current_organization(
    current_user: User = Depends(get_current_user),
) -> Organization:
    repo = OrganizationRepository()
    orgs = await repo.list({"owner_id": current_user.id}, limit=1)
    if not orgs:
        # Check by _id if different
        alt_id = getattr(current_user, "_id", None)
        if alt_id:
            orgs = await repo.list({"owner_id": str(alt_id)}, limit=1)
    if not orgs:
        from database.repositories.user_repository import MembershipRepository
        from database.models.user import Membership
        from packages.shared.constants import OrganizationRole
        mem_repo = MembershipRepository()
        memberships = await mem_repo.list({"user_id": current_user.id}, limit=1)
        if memberships:
            found_org = await repo.get_by_id(memberships[0].organization_id)
            if found_org:
                return found_org

        # Auto-provision default organization for this user so they are never blocked
        new_org = Organization(
            name=f"{current_user.full_name or current_user.username}'s Team",
            slug=f"{current_user.username}-team",
            owner_id=current_user.id,
        )
        saved_org = await repo.create(new_org)
        await mem_repo.create(
            Membership(organization_id=saved_org.id, user_id=current_user.id, role=OrganizationRole.OWNER)
        )
        return saved_org
    return orgs[0]
