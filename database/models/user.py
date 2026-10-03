"""User, Organization, and Membership models."""
from typing import Optional, List
from pydantic import EmailStr, Field
from database.models.base import MongoBaseModel
from packages.shared.constants import OrganizationRole


class User(MongoBaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    hashed_password: Optional[str] = None
    google_id: Optional[str] = None
    github_user_id: Optional[str] = None
    github_username: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False


class Organization(MongoBaseModel):
    name: str
    slug: str
    owner_id: str
    description: Optional[str] = None
    allowed_repositories: List[str] = Field(default_factory=list)


class Membership(MongoBaseModel):
    organization_id: str
    user_id: str
    role: OrganizationRole = OrganizationRole.MEMBER
