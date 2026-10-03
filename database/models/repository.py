"""Repository and GitHubInstallation models."""
from typing import Optional
from database.models.base import MongoBaseModel


class Repository(MongoBaseModel):
    organization_id: str
    github_repo_id: Optional[int] = None
    github_installation_id: Optional[int] = None
    full_name: str          # e.g. "owner/repo"
    name: str
    owner: Optional[str] = None
    owner_login: Optional[str] = None
    default_branch: str = "main"
    clone_url: Optional[str] = None
    private: bool = False
    is_private: bool = False
    description: Optional[str] = None
    language: Optional[str] = None
    installation_id: Optional[int] = None
    indexing_status: str = "NOT_INDEXED"
    last_indexed_commit: Optional[str] = None


class GitHubInstallation(MongoBaseModel):
    organization_id: str
    installation_id: int
    account_login: str
    account_type: str = "Organization"   # Organization | User
    permissions: dict = {}
    events: list[str] = []
    auth_type: str = "app"               # app | pat
    access_token: Optional[str] = None
    target_id: Optional[int] = None
