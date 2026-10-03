"""Docker Container Sandbox implementation for isolated execution."""
import asyncio
import time
import shutil
from typing import Optional, List
from packages.contracts.models import DiffSummary
from packages.config.settings import get_settings
from packages.shared.errors import SecurityBlockError
from sandbox.interface.base import SandboxProvider, SandboxExecutionResult
from sandbox.local.process_sandbox import LocalProcessSandbox
from sandbox.policy import validate_sandbox_command
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.sandbox.docker")


class LocalDockerSandbox(SandboxProvider):
    """Executes commands inside ephemeral Docker containers with resource limits."""

    def __init__(self, image: str = "python:3.12-slim"):
        self.image = image
        self.fallback_sandbox = LocalProcessSandbox()
        self.has_docker_cli = shutil.which("docker") is not None
        self._daemon_ready: Optional[bool] = None

    async def is_docker_ready(self) -> bool:
        """Check if Docker CLI is installed and the Docker daemon is responding."""
        if not self.has_docker_cli:
            return False
        if self._daemon_ready is not None:
            return self._daemon_ready
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "info",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await asyncio.wait_for(proc.communicate(), timeout=3.0)
            self._daemon_ready = (proc.returncode == 0)
            return self._daemon_ready
        except Exception:
            self._daemon_ready = False
            return False

    async def create_workspace(self, workspace_id: str) -> str:
        return await self.fallback_sandbox.create_workspace(workspace_id)

    async def write_file(self, workspace_id: str, file_path: str, content: str) -> None:
        await self.fallback_sandbox.write_file(workspace_id, file_path, content)

    async def read_file(self, workspace_id: str, file_path: str) -> str:
        return await self.fallback_sandbox.read_file(workspace_id, file_path)

    async def list_files(self, workspace_id: str, sub_path: str = "") -> List[str]:
        return await self.fallback_sandbox.list_files(workspace_id, sub_path)

    async def execute_command(
        self,
        workspace_id: str,
        command: str,
        timeout: Optional[int] = None
    ) -> SandboxExecutionResult:
        """Execute command in isolated Docker container or fail closed in production."""
        validate_sandbox_command(command)
        docker_active = await self.is_docker_ready()
        settings = get_settings()

        if docker_active:
            ws_path = str(self.fallback_sandbox._get_workspace_path(workspace_id)).replace("\\", "/")
            timeout_sec = timeout or 60
            start_time = time.time()

            docker_args = [
                "run", "--rm",
                "-v", f"{ws_path}:/workspace",
                "-w", "/workspace",
                "--network", "none",
                "--memory=2g",
                "--cpus=2.0",
                "--security-opt", "no-new-privileges",
                self.image,
                "sh", "-c", command
            ]

            logger.info(f"Executing command in isolated Docker sandbox: '{command}'")
            try:
                process = await asyncio.create_subprocess_exec(
                    "docker",
                    *docker_args,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout_sec
                )
                duration = time.time() - start_time
                return SandboxExecutionResult(
                    exit_code=process.returncode or 0,
                    stdout=stdout_bytes.decode("utf-8", errors="replace")[:20000],
                    stderr=stderr_bytes.decode("utf-8", errors="replace")[:20000],
                    duration_seconds=round(duration, 2),
                    timed_out=False
                )
            except asyncio.TimeoutError:
                return SandboxExecutionResult(
                    exit_code=-1,
                    stdout="",
                    stderr=f"Docker sandbox execution timed out after {timeout_sec}s",
                    duration_seconds=timeout_sec,
                    timed_out=True
                )
            except Exception as exc:
                logger.error(f"Docker sandbox error: {exc}")
                return SandboxExecutionResult(exit_code=1, stdout="", stderr=str(exc))

        # In production, strict fail-closed: do not execute customer code on host!
        if settings.is_production:
            raise SecurityBlockError(
                "Isolated production sandbox is not configured or container runtime is unavailable."
            )

        # In development mode only: fallback with clear security log
        logger.warning(
            f"Docker daemon is not responding on host. Running command via development local process sandbox: '{command}'"
        )
        return await self.fallback_sandbox.execute_command(workspace_id, command, timeout=timeout)

    async def collect_diff(self, workspace_id: str) -> DiffSummary:
        return await self.fallback_sandbox.collect_diff(workspace_id)

    async def destroy_workspace(self, workspace_id: str) -> None:
        await self.fallback_sandbox.destroy_workspace(workspace_id)
