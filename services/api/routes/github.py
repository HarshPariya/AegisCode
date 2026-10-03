"""GitHub App management, OAuth connect flow, and webhook endpoints."""
import hashlib
import hmac as hmac_lib
import time
from typing import Optional
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, Header, Request, Query, status
from fastapi.responses import RedirectResponse
from integrations.github.client import GitHubAppClient
from integrations.github.webhooks import verify_github_signature, handle_github_webhook_event
from services.api.dependencies import get_current_user, get_current_organization
from database.models.user import User, Organization
from database.models.repository import GitHubInstallation
from database.repositories.repository_repository import RepositoryRepository, GitHubInstallationRepository
from packages.config.settings import get_settings
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.routes.github")

router = APIRouter(prefix="/api/github", tags=["GitHub Integration"])

_STATE_COOKIE = "aegis_gh_state"
_STATE_TTL = 600  # 10 minutes


def _sign_state(secret: str, org_id: str, user_id: str, ts: int) -> str:
    """Generate HMAC-SHA256 state token for GitHub OAuth CSRF protection."""
    msg = f"{org_id}:{user_id}:{ts}".encode()
    return hmac_lib.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def _make_state_token(settings, org_id: str, user_id: str) -> str:
    ts = int(time.time())
    sig = _sign_state(settings.SECRET_KEY, org_id, user_id, ts)
    return f"{org_id}:{user_id}:{ts}:{sig}"


def _verify_state_token(settings, token: str) -> bool:
    try:
        parts = token.split(":")
        if len(parts) != 4:
            return False
        org_id, user_id, ts_str, provided_sig = parts
        ts = int(ts_str)
        if time.time() - ts > _STATE_TTL:
            return False
        expected = _sign_state(settings.SECRET_KEY, org_id, user_id, ts)
        return hmac_lib.compare_digest(expected, provided_sig)
    except Exception:
        return False


@router.get("/status")
async def github_status(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Return GitHub App connection status strictly for the authenticated organization."""
    client = GitHubAppClient()
    gh_install_repo = GitHubInstallationRepository()
    repo_repo = RepositoryRepository()
    settings = get_settings()

    app_slug = getattr(settings, "GITHUB_APP_SLUG", None) or getattr(settings, "GITHUB_APP_NAME", None) or "aegiscode"
    install_url = f"https://github.com/apps/{app_slug}/installations/new"

    installations = await gh_install_repo.list_by_org(current_org.id)
    repos = await repo_repo.list_by_org(current_org.id, limit=2000)

    first_inst = installations[0] if installations else None

    return {
        "app_configured": client.is_configured,
        "app_slug": app_slug,
        "install_url": install_url,
        "connected": len(installations) > 0,
        "auth_type": getattr(first_inst, "auth_type", "app") if first_inst else None,
        "account_login": first_inst.account_login if first_inst else None,
        "installations": [
            {
                "installation_id": inst.installation_id,
                "account_login": inst.account_login,
                "account_type": inst.account_type,
                "auth_type": getattr(inst, "auth_type", "app"),
            }
            for inst in installations
        ],
        "repository_count": len(repos),
    }



@router.delete("/installations/{installation_id}")
async def disconnect_installation(
    installation_id: str,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Disconnect a GitHub installation and remove associated repositories for this organization."""
    gh_install_repo = GitHubInstallationRepository()
    repo_repo = RepositoryRepository()

    deleted_repos = await repo_repo.delete_by_installation(current_org.id, installation_id)
    deleted_inst = await gh_install_repo.delete_by_installation_and_org(installation_id, current_org.id)

    logger.info(f"Disconnected installation {installation_id} from org {current_org.id}. Deleted repos: {deleted_repos}, deleted inst: {deleted_inst}")
    return {
        "status": "disconnected",
        "installation_id": installation_id,
        "repositories_removed": deleted_repos,
    }


@router.delete("/disconnect")
@router.post("/disconnect")
async def disconnect_all(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Disconnect all GitHub installations and remove all repositories for this organization."""
    gh_install_repo = GitHubInstallationRepository()
    repo_repo = RepositoryRepository()

    deleted_repos = await repo_repo.delete_by_org(current_org.id)
    deleted_inst = await gh_install_repo.delete_by_org(current_org.id)

    logger.info(f"Disconnected all GitHub access for org {current_org.id}. Deleted {deleted_repos} repos, {deleted_inst} installations.")
    return {
        "status": "disconnected",
        "repositories_removed": deleted_repos,
    }


@router.get("/connect-url")
async def get_connect_url(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Return the GitHub App installation URL with a signed CSRF state token.
    The frontend calls this as a normal API request (with Authorization header),
    then redirects to the returned URL. This avoids the broken pattern of
    redirecting through the backend which strips the Bearer token.
    """
    settings = get_settings()
    app_slug = getattr(settings, "GITHUB_APP_SLUG", None) or getattr(settings, "GITHUB_APP_NAME", None) or "aegiscode"

    state_token = _make_state_token(settings, str(current_org.id), str(current_user.id))
    install_url = f"https://github.com/apps/{app_slug}/installations/new?state={state_token}"

    return {
        "install_url": install_url,
        "state": state_token,
        "app_slug": app_slug,
    }


class ConnectPatRequest(BaseModel):
    token: str


@router.post("/connect-pat")
async def connect_pat(
    req: ConnectPatRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Connect a user's GitHub account and repositories via Personal Access Token (PAT).
    This provides an instant, foolproof connection scoped strictly to the authenticated organization.
    """
    token = req.token.strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Personal Access Token is required.")

    # 1. Verify token by requesting GitHub authenticated user profile
    async with httpx.AsyncClient() as http:
        try:
            user_resp = await http.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "AegisCode-App",
                },
                timeout=12.0,
            )
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to connect to GitHub API: {e}")

        if user_resp.status_code == 401:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid GitHub Personal Access Token. Please verify your token has 'repo' scope."
            )
        if user_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"GitHub API returned HTTP {user_resp.status_code}: {user_resp.text}"
            )

        user_data = user_resp.json()
        account_login = user_data.get("login", "")
        account_type = user_data.get("type", "User")
        target_id = user_data.get("id", 0)

        # 2. Fetch ALL user repositories using full pagination (no hardcoded limit)
        all_repos = []
        page = 1
        while True:
            repos_resp = await http.get(
                "https://api.github.com/user/repos",
                headers={
                    "Authorization": f"Bearer {token}",
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
            if repos_resp.status_code != 200:
                break
            page_data = repos_resp.json()
            if not page_data or not isinstance(page_data, list):
                break
            all_repos.extend(page_data)
            if len(page_data) < 100:
                # Last page — GitHub returns fewer than per_page when done
                break
            page += 1

    # 3. Store/upsert installation for this organization
    gh_install_repo = GitHubInstallationRepository()
    repo_repo = RepositoryRepository()

    # Disconnect previous installations for this org to keep a clean 1-to-1 link
    existing_insts = await gh_install_repo.list_by_org(current_org.id)
    for old_inst in existing_insts:
        await repo_repo.delete_by_installation(current_org.id, old_inst.installation_id)
        await gh_install_repo.delete_by_installation_and_org(old_inst.installation_id, current_org.id)

    installation = GitHubInstallation(
        organization_id=current_org.id,
        installation_id=target_id or int(time.time()),
        account_login=account_login,
        account_type=account_type,
        target_id=target_id,
        auth_type="pat",
        access_token=token,
    )
    await gh_install_repo.upsert(installation)

    # 4. Upsert repositories into MongoDB
    for repo_data in all_repos:
        await repo_repo.upsert_from_github(
            organization_id=current_org.id,
            github_installation_id=installation.installation_id,
            repo_data=repo_data,
        )

    logger.info(f"Connected PAT for @{account_login} in org {current_org.id}. Synced {len(all_repos)} repos.")
    return {
        "status": "connected",
        "installation_id": installation.installation_id,
        "account_login": account_login,
        "account_type": account_type,
        "auth_type": "pat",
        "repositories_synced": len(all_repos),
    }



class LinkExistingRequest(BaseModel):
    identifier: str


@router.post("/link-existing")
async def link_existing_installation(
    req: LinkExistingRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Link an already-installed GitHub App installation by username or installation ID.
    Allows users who have already installed the app to connect without getting stuck in GitHub sudo settings.
    """
    identifier = req.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GitHub username or installation ID is required.")

    client = GitHubAppClient()
    if not client.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub App is not configured on this server. Please use Personal Access Token (PAT) connection instead."
        )

    inst_data = None
    installation_id = None
    app_jwt = client.generate_app_jwt()

    async with httpx.AsyncClient() as http:
        if identifier.isdigit():
            inst_id_int = int(identifier)
            resp = await http.get(
                f"https://api.github.com/app/installations/{inst_id_int}",
                headers={"Authorization": f"Bearer {app_jwt}", "Accept": "application/vnd.github.v3+json"},
                timeout=10.0,
            )
            if resp.status_code == 200:
                inst_data = resp.json()
                installation_id = inst_id_int
        else:
            # First try looking up installation for user
            resp = await http.get(
                f"https://api.github.com/users/{identifier}/installation",
                headers={"Authorization": f"Bearer {app_jwt}", "Accept": "application/vnd.github.v3+json"},
                timeout=10.0,
            )
            if resp.status_code == 200:
                inst_data = resp.json()
                installation_id = inst_data.get("id")
            else:
                # Search list_installations
                all_insts = await client.list_installations()
                for item in all_insts:
                    if item.get("account", {}).get("login", "").lower() == identifier.lower():
                        inst_data = item
                        installation_id = item.get("id")
                        break

    if not inst_data or not installation_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No GitHub App installation found for '{identifier}'. If you haven't installed the AegisCode App, click 'Install GitHub App' first, or connect with a Personal Access Token."
        )

    account_login = inst_data.get("account", {}).get("login", "")
    account_type = inst_data.get("account", {}).get("type", "User")

    gh_install_repo = GitHubInstallationRepository()
    repo_repo = RepositoryRepository()

    # Clean old installations for org
    existing_insts = await gh_install_repo.list_by_org(current_org.id)
    for old_inst in existing_insts:
        await repo_repo.delete_by_installation(current_org.id, old_inst.installation_id)
        await gh_install_repo.delete_by_installation_and_org(old_inst.installation_id, current_org.id)

    installation = GitHubInstallation(
        organization_id=current_org.id,
        installation_id=installation_id,
        account_login=account_login,
        account_type=account_type,
        target_id=inst_data.get("target_id", 0),
        permissions=inst_data.get("permissions", {}),
        events=inst_data.get("events", []),
        auth_type="app",
    )
    await gh_install_repo.upsert(installation)

    # Sync repositories
    synced_count = 0
    try:
        gh_repos = await client.list_repositories(installation_id)
        for r_data in gh_repos:
            await repo_repo.upsert_from_github(
                organization_id=current_org.id,
                github_installation_id=installation_id,
                repo_data=r_data,
            )
        synced_count = len(gh_repos)
    except Exception as exc:
        logger.error(f"Error syncing repos during link_existing: {exc}")

    return {
        "status": "connected",
        "installation_id": installation_id,
        "account_login": account_login,
        "account_type": account_type,
        "auth_type": "app",
        "repositories_synced": synced_count,
    }


class RegisterInstallationRequest(BaseModel):
    installation_id: int
    state: Optional[str] = None


@router.post("/installations/register")
async def register_installation(
    req: RegisterInstallationRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Register a GitHub App installation for the authenticated user's organization.
    Called by the frontend after GitHub redirects back with installation_id.
    The user can only register installations that belong to their GitHub account.
    """
    client = GitHubAppClient()

    if not client.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub App is not configured on this server."
        )

    installation_id = req.installation_id
    if not installation_id or installation_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid installation_id.")

    # Fetch installation details from GitHub App API to confirm it exists and get account info
    try:
        app_jwt = client.generate_app_jwt()
        import httpx
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"https://api.github.com/app/installations/{installation_id}",
                headers={
                    "Authorization": f"Bearer {app_jwt}",
                    "Accept": "application/vnd.github.v3+json",
                },
                timeout=10.0,
            )
            if resp.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Installation {installation_id} not found. Make sure you installed the AegisCode GitHub App on your account."
                )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to verify installation with GitHub: HTTP {resp.status_code}"
                )
            inst_data = resp.json()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"GitHub API error: {exc}")

    account_login = inst_data.get("account", {}).get("login", "")
    account_type = inst_data.get("account", {}).get("type", "User")

    # Persist installation — strictly scoped to the authenticated user's organization
    gh_install_repo = GitHubInstallationRepository()
    repo_repo = RepositoryRepository()

    installation = GitHubInstallation(
        organization_id=current_org.id,
        installation_id=installation_id,
        account_login=account_login,
        account_type=account_type,
        target_id=inst_data.get("target_id", 0),
        permissions=inst_data.get("permissions", {}),
        events=inst_data.get("events", []),
    )
    await gh_install_repo.upsert(installation)

    # Sync all authorized repositories for this installation
    synced_count = 0
    try:
        gh_repos = await client.list_repositories(installation_id)
        for repo_data in gh_repos:
            await repo_repo.upsert_from_github(
                organization_id=current_org.id,
                github_installation_id=installation_id,
                repo_data=repo_data,
            )
        synced_count = len(gh_repos)
        logger.info(
            f"Registered installation {installation_id} (@{account_login}) "
            f"for org {current_org.id} (user {current_user.id}). Synced {synced_count} repos."
        )
    except Exception as exc:
        logger.error(f"Failed to sync repos after registration: {exc}")

    return {
        "status": "connected",
        "installation_id": installation_id,
        "account_login": account_login,
        "account_type": account_type,
        "repositories_synced": synced_count,
    }


@router.get("/callback")
async def github_callback_redirect(
    request: Request,
    installation_id: Optional[int] = Query(None),
    setup_action: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
):
    """GitHub App installation callback — no authentication required here.
    Forwards all params to the frontend which registers the installation using its JWT token.
    Configure your GitHub App's 'Setup URL' and 'Callback URL' to point to:
        http://localhost:8000/api/github/callback  (or your production backend URL)
    """
    settings = get_settings()
    frontend_url = settings.FRONTEND_URL or "http://localhost:3000"

    # Build frontend redirect URL preserving GitHub's params
    params = []
    if installation_id:
        params.append(f"installation_id={installation_id}")
    if setup_action:
        params.append(f"setup_action={setup_action}")
    if state:
        params.append(f"state={state}")
    if code:
        params.append(f"code={code}")

    qs = "&".join(params)
    target = f"{frontend_url}/repositories?{qs}" if qs else f"{frontend_url}/repositories"
    return RedirectResponse(url=target, status_code=302)


@router.get("/installations")
async def list_installations(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """List GitHub App installations for the authenticated organization (from MongoDB)."""
    gh_install_repo = GitHubInstallationRepository()
    installations = await gh_install_repo.list_by_org(current_org.id)
    return [
        {
            "installation_id": inst.installation_id,
            "account_login": inst.account_login,
            "account_type": inst.account_type,
        }
        for inst in installations
    ]


@router.get("/repositories")
async def list_repositories(
    installation_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """List GitHub repositories — returns tenant-scoped repos from MongoDB (not raw GitHub API)."""
    repo_repo = RepositoryRepository()
    repos = await repo_repo.list_by_org(current_org.id)
    # Return in GitHub API-compatible format for backward compat with existing frontend
    return [
        {
            "id": r.github_repo_id,
            "name": r.name,
            "full_name": r.full_name,
            "private": r.is_private,
            "default_branch": r.default_branch,
            "clone_url": r.clone_url,
            "html_url": f"https://github.com/{r.full_name}",
            "description": r.description or "",
            "language": getattr(r, "language", None),
            "indexing_status": r.indexing_status,
        }
        for r in repos
    ]


@router.post("/sync")
async def github_sync(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Sync repositories from GitHub App into MongoDB for this organization."""
    gh_install_repo = GitHubInstallationRepository()
    repo_repo = RepositoryRepository()
    client = GitHubAppClient()

    installations = await gh_install_repo.list_by_org(current_org.id)
    if not installations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub account connected for this workspace. Please connect your GitHub account first."
        )

    synced = []
    for inst in installations:
        gh_repos = []
        if getattr(inst, "auth_type", "app") == "pat" and inst.access_token:
            # Sync via PAT with full pagination (no hardcoded limit)
            page = 1
            async with httpx.AsyncClient() as http:
                while True:
                    resp = await http.get(
                        "https://api.github.com/user/repos",
                        headers={
                            "Authorization": f"Bearer {inst.access_token}",
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
                        # Last page
                        break
                    page += 1
        elif client.is_configured:
            gh_repos = await client.list_repositories(inst.installation_id)

        for repo_data in gh_repos:
            repo = await repo_repo.upsert_from_github(
                organization_id=current_org.id,
                github_installation_id=inst.installation_id,
                repo_data=repo_data,
            )
            synced.append(repo)

    return {"synced_count": len(synced), "installation_id": installations[0].installation_id if installations else None}


@router.post("/webhooks")
async def github_webhook(
    request: Request,
    x_github_event: str = Header("ping", alias="X-GitHub-Event"),
    x_hub_signature_256: str = Header("", alias="X-Hub-Signature-256")
):
    """Receive and securely process incoming GitHub App webhooks."""
    body_bytes = await request.body()
    try:
        verify_github_signature(body_bytes, x_hub_signature_256)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    payload = await request.json()
    result = await handle_github_webhook_event(x_github_event, payload)
    return result
