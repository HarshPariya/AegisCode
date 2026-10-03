"""Sandbox provider base interface — matches LocalProcessSandbox API."""
from abc import ABC, abstractmethod
from typing import Optional, List
from pydantic import BaseModel


class SandboxExecutionResult(BaseModel):
    success: bool = True
    exit_code: int = 0
    stdout: str = ""
    stderr: str = ""
    duration_seconds: float = 0.0
    files_changed: list = []
    timed_out: bool = False

    @property
    def succeeded(self) -> bool:
        return self.exit_code == 0 and not self.timed_out


class SandboxProvider(ABC):
    """Abstract base class for sandbox execution providers."""

    @abstractmethod
    async def create_workspace(self, workspace_id: str) -> str: ...

    @abstractmethod
    async def write_file(self, workspace_id: str, file_path: str, content: str) -> None: ...

    @abstractmethod
    async def read_file(self, workspace_id: str, file_path: str) -> str: ...

    @abstractmethod
    async def list_files(self, workspace_id: str, sub_path: str = "") -> List[str]: ...

    @abstractmethod
    async def execute_command(
        self,
        workspace_id: str,
        command: str,
        timeout: Optional[int] = None,
    ) -> SandboxExecutionResult: ...

    @abstractmethod
    async def destroy_workspace(self, workspace_id: str) -> None: ...
