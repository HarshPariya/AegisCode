"""Pull request management endpoints (tenant-scoped)."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from database.models.pull_request import PullRequest
from database.models.user import User, Organization
from database.repositories.base import BaseRepository
from services.api.dependencies import get_current_user, get_current_organization

router = APIRouter(prefix="/api/pull-requests", tags=["Pull Requests"])


class PullRequestResponse(BaseModel):
    id: str
    organization_id: str
    task_id: Optional[str] = None
    repository_id: Optional[str] = None
    repository_full_name: Optional[str] = None
    branch: Optional[str] = None
    pr_number: Optional[int] = None
    title: Optional[str] = None
    html_url: Optional[str] = None
    state: str = "open"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@router.get("", response_model=List[PullRequestResponse])
async def list_pull_requests(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """List all tenant-scoped pull requests for the authenticated organization."""
    pr_repo = BaseRepository(PullRequest, "pull_requests")
    prs = await pr_repo.list(query={}, organization_id=current_org.id, limit=100)
    return [
        PullRequestResponse(
            id=pr.id,
            organization_id=pr.organization_id,
            task_id=getattr(pr, "task_id", None),
            repository_id=getattr(pr, "repository_id", None),
            repository_full_name=getattr(pr, "repository_full_name", None),
            branch=getattr(pr, "branch", None),
            pr_number=getattr(pr, "pr_number", None),
            title=getattr(pr, "title", None),
            html_url=getattr(pr, "html_url", None),
            state=getattr(pr, "state", "open"),
            created_at=getattr(pr, "created_at", None),
            updated_at=getattr(pr, "updated_at", None),
        )
        for pr in prs
    ]


@router.get("/{pr_id}", response_model=PullRequestResponse)
async def get_pull_request(
    pr_id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Get a single tenant-scoped pull request."""
    pr_repo = BaseRepository(PullRequest, "pull_requests")
    pr = await pr_repo.get_by_id(pr_id, organization_id=current_org.id)
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pull request not found")
    return PullRequestResponse(
        id=pr.id,
        organization_id=pr.organization_id,
        task_id=getattr(pr, "task_id", None),
        repository_id=getattr(pr, "repository_id", None),
        repository_full_name=getattr(pr, "repository_full_name", None),
        branch=getattr(pr, "branch", None),
        pr_number=getattr(pr, "pr_number", None),
        title=getattr(pr, "title", None),
        html_url=getattr(pr, "html_url", None),
        state=getattr(pr, "state", "open"),
        created_at=getattr(pr, "created_at", None),
        updated_at=getattr(pr, "updated_at", None),
    )
