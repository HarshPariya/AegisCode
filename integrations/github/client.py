"""GitHub App API client for repository operations and PR creation."""
import time
from typing import Any, Dict, List, Optional
import httpx
import jwt
from packages.config.settings import get_settings
from packages.shared.errors import GitHubIntegrationError
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.github")


class GitHubAppClient:
    def __init__(
        self,
        app_id: Optional[str] = None,
        private_key: Optional[str] = None,
        base_url: str = "https://api.github.com"
    ):
        settings = get_settings()
        self.app_id = app_id if app_id is not None else settings.GITHUB_APP_ID
        self.private_key = private_key if private_key is not None else settings.GITHUB_PRIVATE_KEY
        self.base_url = base_url.rstrip("/")

    @property
    def is_configured(self) -> bool:
        return bool(self.app_id and self.private_key)

    def generate_app_jwt(self) -> str:
        """Generate RS256 JWT for GitHub App authentication."""
        if not self.is_configured:
            raise GitHubIntegrationError("GitHub App credentials (GITHUB_APP_ID / GITHUB_PRIVATE_KEY) are not configured.")

        now = int(time.time())
        payload = {
            "iat": now - 30,         # 30 seconds in the past for clock drift
            "exp": now + (8 * 60),   # 8 minutes in the future (well within GitHub's 10m maximum)
            "iss": self.app_id,
        }
        try:
            return jwt.encode(payload, self.private_key, algorithm="RS256")
        except Exception as exc:
            raise GitHubIntegrationError(f"Failed to generate GitHub App JWT: {exc}")

    def _create_http_client(self, timeout: float = 20.0) -> httpx.AsyncClient:
        transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
        return httpx.AsyncClient(transport=transport, timeout=timeout)

    async def get_installation_token(self, installation_id: int) -> str:
        """Exchange App JWT for an installation access token."""
        app_jwt = self.generate_app_jwt()
        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AegisCode-App",
        }
        async with self._create_http_client(timeout=15.0) as client:
            resp = await client.post(
                f"{self.base_url}/app/installations/{installation_id}/access_tokens",
                headers=headers,
            )
            if resp.status_code != 201:
                raise GitHubIntegrationError(f"Failed to acquire installation token: {resp.text}")
            data = resp.json()
            return data["token"]

    async def list_installations(self) -> List[Dict[str, Any]]:
        """List all GitHub App installations."""
        if not self.is_configured:
            logger.warning("GitHub App unconfigured (GITHUB_APP_ID / GITHUB_PRIVATE_KEY not set). Returning empty installations.")
            return []

        app_jwt = self.generate_app_jwt()
        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AegisCode-App",
        }
        async with self._create_http_client(timeout=15.0) as client:
            resp = await client.get(f"{self.base_url}/app/installations", headers=headers)
            if resp.status_code != 200:
                raise GitHubIntegrationError(f"Failed to list installations: {resp.text}")
            return resp.json()

    async def list_repositories(self, installation_id: int) -> List[Dict[str, Any]]:
        """List accessible repositories for an installation with complete pagination."""
        if not self.is_configured:
            logger.warning("GitHub App unconfigured. Returning empty repository list.")
            return []

        token = await self.get_installation_token(installation_id)
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AegisCode-App",
        }
        all_repositories: List[Dict[str, Any]] = []
        page = 1
        async with self._create_http_client(timeout=20.0) as client:
            while True:
                resp = await client.get(
                    f"{self.base_url}/installation/repositories",
                    headers=headers,
                    params={"per_page": 100, "page": page},
                )
                if resp.status_code != 200:
                    raise GitHubIntegrationError(f"Failed to list repositories: {resp.text}")
                data = resp.json()
                page_repos = data.get("repositories", [])
                if not page_repos:
                    break
                all_repositories.extend(page_repos)
                total_count = data.get("total_count", 0)
                if len(all_repositories) >= total_count or len(page_repos) < 100:
                    break
                page += 1
        return all_repositories

    async def create_pull_request(
        self,
        installation_id: int,
        repo_owner: str,
        repo_name: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main"
    ) -> Dict[str, Any]:
        """Create a pull request on GitHub."""
        if not self.is_configured:
            raise GitHubIntegrationError(
                "GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY to enable PR creation."
            )

        token = await self.get_installation_token(installation_id)
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AegisCode-App",
        }
        payload = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch,
        }
        async with self._create_http_client(timeout=20.0) as client:
            resp = await client.post(
                f"{self.base_url}/repos/{repo_owner}/{repo_name}/pulls",
                headers=headers,
                json=payload,
            )
            if resp.status_code == 422:
                # Check if PR already exists
                check_resp = await client.get(
                    f"{self.base_url}/repos/{repo_owner}/{repo_name}/pulls",
                    headers=headers,
                    params={"head": f"{repo_owner}:{head_branch}", "state": "all"},
                )
                if check_resp.status_code == 200 and check_resp.json():
                    return check_resp.json()[0]
            if resp.status_code not in (200, 201):
                raise GitHubIntegrationError(f"Failed to create pull request: {resp.text}")
            return resp.json()
