"""Remote sandbox stub (cloud execution — not yet implemented locally)."""
from typing import Optional, List
from sandbox.interface.base import SandboxProvider, SandboxExecutionResult


class RemoteSandboxProvider(SandboxProvider):
    """Placeholder for remote cloud-based sandbox execution."""

    async def create_workspace(self, workspace_id: str) -> str:
        raise NotImplementedError("Remote sandbox not configured.")

    async def write_file(self, workspace_id: str, file_path: str, content: str) -> None:
        raise NotImplementedError("Remote sandbox not configured.")

    async def read_file(self, workspace_id: str, file_path: str) -> str:
        raise NotImplementedError("Remote sandbox not configured.")

    async def list_files(self, workspace_id: str, sub_path: str = "") -> List[str]:
        raise NotImplementedError("Remote sandbox not configured.")

    async def execute_command(self, workspace_id: str, command: str, timeout: Optional[int] = None) -> SandboxExecutionResult:
        raise NotImplementedError("Remote sandbox not configured.")

    async def destroy_workspace(self, workspace_id: str) -> None:
        raise NotImplementedError("Remote sandbox not configured.")
