"""Model Context Protocol (MCP) tool gateway."""
from typing import Dict, Any, List
from pydantic import BaseModel
from packages.shared.constants import RiskLevel
from packages.shared.logging import get_logger
from sandbox import get_sandbox_provider
from sandbox.policy import validate_sandbox_command

logger = get_logger("aegiscode.mcp")


class MCPToolDefinition(BaseModel):
    name: str
    description: str
    input_schema: Dict[str, Any]
    risk_level: RiskLevel = RiskLevel.LOW
    read_only: bool = True


class MCPGateway:
    def __init__(self):
        self.sandbox = get_sandbox_provider()
        self.tools: Dict[str, MCPToolDefinition] = {
            "workspace.read_file": MCPToolDefinition(
                name="workspace.read_file",
                description="Read contents of a file inside the isolated sandbox workspace.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "workspace_id": {"type": "string"},
                        "file_path": {"type": "string"}
                    },
                    "required": ["workspace_id", "file_path"]
                },
                risk_level=RiskLevel.LOW,
                read_only=True
            ),
            "workspace.write_file": MCPToolDefinition(
                name="workspace.write_file",
                description="Write content to a file inside the isolated sandbox workspace.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "workspace_id": {"type": "string"},
                        "file_path": {"type": "string"},
                        "content": {"type": "string"}
                    },
                    "required": ["workspace_id", "file_path", "content"]
                },
                risk_level=RiskLevel.MEDIUM,
                read_only=False
            ),
            "workspace.list_files": MCPToolDefinition(
                name="workspace.list_files",
                description="List files and directories in the repository workspace.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "workspace_id": {"type": "string"},
                        "sub_path": {"type": "string", "default": ""}
                    },
                    "required": ["workspace_id"]
                },
                risk_level=RiskLevel.LOW,
                read_only=True
            ),
            "terminal.run_tests": MCPToolDefinition(
                name="terminal.run_tests",
                description="Run policy-approved test commands (pytest, npm test) in sandbox.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "workspace_id": {"type": "string"},
                        "command": {"type": "string", "default": "pytest"}
                    },
                    "required": ["workspace_id"]
                },
                risk_level=RiskLevel.LOW,
                read_only=True
            ),
            "terminal.execute_command": MCPToolDefinition(
                name="terminal.execute_command",
                description="Execute policy-approved terminal commands (git status, pytest, ruff, npm run build) in sandbox.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "workspace_id": {"type": "string"},
                        "command": {"type": "string"}
                    },
                    "required": ["workspace_id", "command"]
                },
                risk_level=RiskLevel.MEDIUM,
                read_only=False
            ),
            "task_complete": MCPToolDefinition(
                name="task_complete",
                description="Signal that modifications or repository analysis are finished. Provide summary and modified files.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "workspace_id": {"type": "string"},
                        "summary": {"type": "string", "description": "Summary of changes made or verification findings"},
                        "modified_files": {"type": "array", "items": {"type": "string"}, "description": "List of modified files"},
                        "warnings": {"type": "array", "items": {"type": "string"}, "description": "Any technical debt or warnings"}
                    },
                    "required": ["summary"]
                },
                risk_level=RiskLevel.LOW,
                read_only=True
            ),
        }

    def list_tools(self) -> List[MCPToolDefinition]:
        return list(self.tools.values())

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        normalized = name.replace("-", "_")
        key = name if name in self.tools else (normalized.replace("_", ".", 1) if normalized.replace("_", ".", 1) in self.tools else None)
        if not key:
            for k in self.tools:
                if k.replace(".", "_") == normalized:
                    key = k
                    break

        if not key or key not in self.tools:
            raise ValueError(f"Unknown MCP tool: {name}")

        tool = self.tools[key]
        logger.info(f"Executing MCP Tool '{key}' (Risk: {tool.risk_level.value})")

        ws_id = arguments.get("workspace_id")
        if not ws_id:
            raise ValueError("Missing required workspace_id argument")

        if key in ("workspace.read_file", "workspace_read_file"):
            content = await self.sandbox.read_file(ws_id, arguments.get("file_path", arguments.get("path", "")))
            return {"content": content}

        elif key in ("workspace.write_file", "workspace_write_file"):
            fpath = arguments.get("file_path", arguments.get("path", ""))
            content = arguments.get("content", "")
            await self.sandbox.write_file(ws_id, fpath, content)
            return {"status": "success", "file_path": fpath}

        elif key in ("workspace.list_files", "workspace_list_files"):
            sub_path = arguments.get("sub_path", arguments.get("path", ""))
            files = await self.sandbox.list_files(ws_id, sub_path)
            return {"files": files}

        elif key in ("terminal.run_tests", "terminal_run_tests"):
            cmd = arguments.get("command", "pytest")
            validate_sandbox_command(cmd)
            res = await self.sandbox.execute_command(ws_id, cmd)
            return res.model_dump()

        elif key in ("terminal.execute_command", "terminal_execute_command"):
            cmd = arguments.get("command", "")
            validate_sandbox_command(cmd)
            res = await self.sandbox.execute_command(ws_id, cmd)
            return res.model_dump()

        elif key in ("task_complete", "json", "complete"):
            return {
                "status": "completed",
                "summary": arguments.get("summary", "Task completed."),
                "modified_files": arguments.get("modified_files", []),
                "warnings": arguments.get("warnings", [])
            }

        raise NotImplementedError(f"Handler for {name} not implemented")
