"""Restricted Local Process Sandbox implementation with path containment and policy enforcement."""
import asyncio
import os
import shutil
import stat
import time
from pathlib import Path
from typing import List, Optional
from packages.contracts.models import DiffSummary, FileDiff
from packages.shared.errors import SandboxError, SecurityBlockError
from packages.shared.logging import get_logger
from sandbox.interface.base import SandboxProvider, SandboxExecutionResult
from sandbox.policy import validate_sandbox_command

logger = get_logger("aegiscode.sandbox.process")


def _force_remove_readonly(func, path, excinfo):
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def safe_rmtree(path: Path):
    if not path.exists():
        return
    try:
        shutil.rmtree(path, onerror=_force_remove_readonly)
    except Exception:
        try:
            shutil.rmtree(path, ignore_errors=True)
        except Exception:
            pass


class LocalProcessSandbox(SandboxProvider):
    def __init__(self, base_workspaces_dir: Optional[str] = None):
        self.base_dir = Path(base_workspaces_dir or os.path.join(os.getcwd(), "workspaces")).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_workspace_path(self, workspace_id: str) -> Path:
        ws_path = (self.base_dir / workspace_id).resolve()
        # Security: Prevent path traversal outside base_dir
        if not str(ws_path).startswith(str(self.base_dir)):
            raise SecurityBlockError(f"Directory traversal detected for workspace: {workspace_id}")
        return ws_path

    def _get_safe_file_path(self, workspace_id: str, file_path: str) -> Path:
        ws_path = self._get_workspace_path(workspace_id)
        target = (ws_path / file_path.lstrip("/\\")).resolve()
        if not str(target).startswith(str(ws_path)):
            raise SecurityBlockError(f"Filesystem escape detected for path: {file_path}")
        return target

    async def create_workspace(self, workspace_id: str) -> str:
        ws_path = self._get_workspace_path(workspace_id)
        safe_rmtree(ws_path)
        ws_path.mkdir(parents=True, exist_ok=True)
        return str(ws_path)

    async def write_file(self, workspace_id: str, file_path: str, content: str) -> None:
        target = self._get_safe_file_path(workspace_id, file_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    async def read_file(self, workspace_id: str, file_path: str) -> str:
        target = self._get_safe_file_path(workspace_id, file_path)
        if not target.exists():
            raise SandboxError(f"File not found: {file_path}")
        if target.is_dir():
            files = await self.list_files(workspace_id, file_path)
            return "Directory listing:\n" + "\n".join(files if files else ["(empty directory)"])
        try:
            return target.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return target.read_text(encoding="latin-1", errors="replace")

    async def list_files(self, workspace_id: str, sub_path: str = "") -> List[str]:
        target = self._get_safe_file_path(workspace_id, sub_path)
        if not target.exists():
            return []
        files = []
        for root, dirs, filenames in os.walk(target):
            # Exclude internal and cache directories
            dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__", ".venv", "venv")]
            for f in filenames:
                if f.endswith((".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".pyc", ".pack", ".idx")):
                    continue
                full = Path(root) / f
                rel = full.relative_to(self._get_workspace_path(workspace_id))
                files.append(str(rel).replace("\\", "/"))
        return files

    async def execute_command(
        self,
        workspace_id: str,
        command: str,
        timeout: Optional[int] = None
    ) -> SandboxExecutionResult:
        # Validate against strict security allowlist
        validate_sandbox_command(command)
        ws_path = self._get_workspace_path(workspace_id)
        if not ws_path.exists():
            raise SandboxError(f"Workspace {workspace_id} does not exist.")

        timeout_sec = timeout or 60
        start_time = time.time()

        import shlex
        try:
            parts = shlex.split(command)
        except Exception:
            parts = command.strip().split()
        cmd = parts[0]
        args = parts[1:]

        # Security: Strip application secrets and pass only sanitized OS runtime variables
        safe_env = {
            k: v for k, v in os.environ.items()
            if k in ("PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOME", "LANG", "NODE_PATH")
        }
        safe_env["GIT_TERMINAL_PROMPT"] = "0"
        safe_env["GCM_INTERACTIVE"] = "never"
        safe_env["GIT_ASKPASS"] = "echo"

        try:
            process = await asyncio.create_subprocess_exec(
                cmd,
                *args,
                cwd=str(ws_path),
                env=safe_env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout_sec
                )
                duration = time.time() - start_time
                stdout = stdout_bytes.decode("utf-8", errors="replace")[:20000]
                stderr = stderr_bytes.decode("utf-8", errors="replace")[:20000]
                return SandboxExecutionResult(
                    exit_code=process.returncode or 0,
                    stdout=stdout,
                    stderr=stderr,
                    duration_seconds=round(duration, 2),
                    timed_out=False
                )
            except asyncio.TimeoutError:
                process.kill()
                return SandboxExecutionResult(
                    exit_code=-1,
                    stdout="",
                    stderr=f"Command timed out after {timeout_sec} seconds",
                    duration_seconds=timeout_sec,
                    timed_out=True
                )
        except Exception as exc:
            return SandboxExecutionResult(
                exit_code=1,
                stdout="",
                stderr=str(exc),
                duration_seconds=round(time.time() - start_time, 2)
            )

    async def collect_diff(self, workspace_id: str) -> DiffSummary:
        """Inspect modified files in workspace and return DiffSummary."""
        diff_res = await self.execute_command(workspace_id, "git status --porcelain")
        diff_files = []
        total_add = 0

        if diff_res.exit_code == 0 and diff_res.stdout.strip():
            raw_diff = await self.execute_command(workspace_id, "git diff")
            patch_text = raw_diff.stdout or ""
            for line in diff_res.stdout.strip().splitlines():
                parts = line.strip().split(maxsplit=1)
                if len(parts) == 2:
                    status_code, fpath = parts[0], parts[1].strip()
                    if fpath.startswith(".git"):
                        continue
                    status_str = "modified" if "M" in status_code else "added" if ("A" in status_code or "?" in status_code) else "deleted"
                    diff_files.append(
                        FileDiff(
                            file_path=fpath,
                            status=status_str,
                            additions=1,
                            deletions=0,
                            patch=patch_text[:2000] if patch_text else f"+ [AegisCode] {status_str} {fpath}"
                        )
                    )
                    total_add += 1

        return DiffSummary(
            files_changed=len(diff_files),
            total_additions=total_add,
            total_deletions=0,
            files=diff_files
        )

    async def destroy_workspace(self, workspace_id: str) -> None:
        ws_path = self._get_workspace_path(workspace_id)
        safe_rmtree(ws_path)
