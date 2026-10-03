"""Sandbox execution engine package."""
import shutil
from packages.config.settings import get_settings
from sandbox.interface.base import SandboxProvider, SandboxExecutionResult
from sandbox.local.process_sandbox import LocalProcessSandbox
from sandbox.local.docker_sandbox import LocalDockerSandbox
from sandbox.remote.remote_sandbox import RemoteSandboxProvider
from sandbox.remote.e2b_sandbox import E2BSandboxProvider
from sandbox.policy import validate_sandbox_command


def get_sandbox_provider() -> SandboxProvider:
    """Factory returning the configured SandboxProvider.

    Provider resolution order:
    1. SANDBOX_PROVIDER=e2b         → E2BSandboxProvider (production cloud sandbox)
    2. SANDBOX_PROVIDER=remote      → RemoteSandboxProvider (generic remote stub)
    3. SANDBOX_PROVIDER=local_docker → LocalDockerSandbox (containerized local)
    4. SANDBOX_PROVIDER=local_process → LocalProcessSandbox (dev only)

    Production enforcement:
    - In production mode (ENVIRONMENT=production), ONLY e2b or remote are allowed.
    - local_process is NEVER used in production.
    - If production sandbox is unavailable, fail CLOSED (raise SecurityBlockError).
    """
    settings = get_settings()

    # --- E2B cloud sandbox (production-preferred) ---
    if settings.SANDBOX_PROVIDER == "e2b":
        return E2BSandboxProvider(
            template=settings.E2B_TEMPLATE,
            timeout_seconds=settings.SANDBOX_TIMEOUT_SECONDS,
            allow_internet=settings.SANDBOX_ALLOW_INTERNET,
        )

    # --- Generic remote provider stub ---
    if settings.SANDBOX_PROVIDER == "remote":
        return RemoteSandboxProvider()

    # --- Production enforcement: no local execution ---
    if settings.is_production:
        # Auto-select E2B if E2B_API_KEY is present in production
        if settings.E2B_API_KEY:
            return E2BSandboxProvider(
                template=settings.E2B_TEMPLATE,
                timeout_seconds=settings.SANDBOX_TIMEOUT_SECONDS,
                allow_internet=settings.SANDBOX_ALLOW_INTERNET,
            )
        # Enforce containerized sandbox (fails closed if Docker daemon unavailable)
        return LocalDockerSandbox(image=settings.SANDBOX_DOCKER_IMAGE)

    # --- Development mode: Docker if available, else process ---
    if settings.SANDBOX_PROVIDER in ("local_docker", "docker"):
        return LocalDockerSandbox(image=settings.SANDBOX_DOCKER_IMAGE)

    if settings.SANDBOX_PROVIDER in ("local_process", "process"):
        return LocalProcessSandbox()

    # Auto-detect in development: prefer Docker, fallback to process
    return (
        LocalDockerSandbox(image=settings.SANDBOX_DOCKER_IMAGE)
        if shutil.which("docker")
        else LocalProcessSandbox()
    )


__all__ = [
    "SandboxProvider",
    "SandboxExecutionResult",
    "LocalProcessSandbox",
    "LocalDockerSandbox",
    "RemoteSandboxProvider",
    "E2BSandboxProvider",
    "validate_sandbox_command",
    "get_sandbox_provider",
]
