"""Organizations API route."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from database.models.user import Organization, Membership
from database.repositories.user_repository import OrganizationRepository, MembershipRepository
from services.api.dependencies import get_current_user
from database.models.user import User
from packages.shared.constants import OrganizationRole

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


class CreateOrgRequest(BaseModel):
    name: str
    slug: str


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_organization(body: CreateOrgRequest, current_user: User = Depends(get_current_user)):
    repo = OrganizationRepository()
    existing = await repo.list({"slug": body.slug}, limit=1)
    if existing:
        raise HTTPException(status_code=409, detail="Organization slug already taken")
    org = Organization(name=body.name, slug=body.slug, owner_id=current_user.id)
    await repo.create(org)
    # Auto-add owner membership
    mem_repo = MembershipRepository()
    mem = Membership(organization_id=org.id, user_id=current_user.id, role=OrganizationRole.OWNER)
    await mem_repo.create(mem)
    return org.model_dump()


@router.get("/me")
async def get_my_organization(current_user: User = Depends(get_current_user)):
    repo = OrganizationRepository()
    orgs = await repo.list({"owner_id": current_user.id}, limit=1)
    if not orgs:
        return None
    return orgs[0].model_dump()


@router.get("/{org_id}")
async def get_organization(org_id: str, current_user: User = Depends(get_current_user)):
    repo = OrganizationRepository()
    org = await repo.get_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org.model_dump()
