"""Tenant-scoped repository management endpoints."""
from typing import List, Optional
import httpx
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from database.models.repository import Repository
from database.models.user import User, Organization
from database.repositories.repository_repository import RepositoryRepository, GitHubInstallationRepository
from services.api.dependencies import get_current_user, get_current_organization
from integrations.github.client import GitHubAppClient
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.routes.repositories")

router = APIRouter(prefix="/api/repositories", tags=["Repositories"])


class RepositoryResponse(BaseModel):
    id: str
    organization_id: str
    github_installation_id: int
    github_repo_id: int
    name: str
    full_name: str
    owner_login: str
    default_branch: str
    is_private: bool
    clone_url: str
    indexing_status: str
    last_indexed_commit: Optional[str] = None
    html_url: Optional[str] = None

    @classmethod
    def from_model(cls, repo: Repository) -> "RepositoryResponse":
        return cls(
            id=repo.id,
            organization_id=repo.organization_id,
            github_installation_id=repo.github_installation_id,
            github_repo_id=repo.github_repo_id,
            name=repo.name,
            full_name=repo.full_name,
            owner_login=repo.owner_login,
            default_branch=repo.default_branch,
            is_private=repo.is_private,
            clone_url=repo.clone_url,
            indexing_status=repo.indexing_status,
            last_indexed_commit=repo.last_indexed_commit,
            html_url=f"https://github.com/{repo.full_name}" if repo.full_name else None,
        )


@router.get("", response_model=List[RepositoryResponse])
async def list_repositories(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """List all tenant-scoped repositories for the authenticated organization."""
    repo_repo = RepositoryRepository()
    repos = await repo_repo.list_by_org(current_org.id)
    return [RepositoryResponse.from_model(r) for r in repos]


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(
    repo_id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Get a single tenant-scoped repository by ID."""
    repo_repo = RepositoryRepository()
    repo = await repo_repo.get_by_id(repo_id, organization_id=current_org.id)
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return RepositoryResponse.from_model(repo)


@router.post("/sync", response_model=List[RepositoryResponse])
async def sync_repositories(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Sync repositories from connected GitHub account (PAT or App) into MongoDB for this organization."""
    gh_install_repo = GitHubInstallationRepository()
    repo_repo = RepositoryRepository()
    client = GitHubAppClient()

    installations = await gh_install_repo.list_by_org(current_org.id)
    if not installations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub account connected for this workspace. Please connect your GitHub account first."
        )

    synced: List[RepositoryResponse] = []
    for installation in installations:
        gh_repos = []
        try:
            if getattr(installation, "auth_type", "app") == "pat" and installation.access_token:
                # Fetch repos via PAT
                page = 1
                async with httpx.AsyncClient() as http:
                    while page <= 3:
                        resp = await http.get(
                            "https://api.github.com/user/repos",
                            headers={
                                "Authorization": f"Bearer {installation.access_token}",
                                "Accept": "application/vnd.github.v3+json",
                                "User-Agent": "AegisCode-App",
                            },
                            params={
                                "per_page": 100,
                                "page": page,
                                "sort": "updated",
                                "affiliation": "owner,collaborator,organization_member"
                            },
                            timeout=15.0,
                        )
                        if resp.status_code != 200:
                            break
                        pdata = resp.json()
                        if not pdata or not isinstance(pdata, list):
                            break
                        gh_repos.extend(pdata)
                        if len(pdata) < 100:
                            break
                        page += 1
            elif client.is_configured:
                gh_repos = await client.list_repositories(installation.installation_id)

            for repo_data in gh_repos:
                repo = await repo_repo.upsert_from_github(
                    organization_id=current_org.id,
                    github_installation_id=installation.installation_id,
                    repo_data=repo_data,
                )
                synced.append(RepositoryResponse.from_model(repo))
        except Exception as exc:
            logger.error(f"Failed to sync repos for installation {installation.installation_id}: {exc}")

    return synced
