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
        }

    def list_tools(self) -> List[MCPToolDefinition]:
        return list(self.tools.values())

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        normalized = name.replace("-", "_")
        key = name if name in self.tools else (normalized.replace("_", ".", 1) if normalized.replace("_", ".", 1) in self.tools else None)
        if not key:
            # Check direct fallback
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
            content = await self.sandbox.read_file(ws_id, arguments["file_path"])
            return {"content": content}

        elif key in ("workspace.write_file", "workspace_write_file"):
            await self.sandbox.write_file(ws_id, arguments["file_path"], arguments["content"])
            return {"status": "success", "file_path": arguments["file_path"]}

        elif key in ("terminal.run_tests", "terminal_run_tests"):
            cmd = arguments.get("command", "pytest")
            validate_sandbox_command(cmd)
            res = await self.sandbox.execute_command(ws_id, cmd)
            return res.model_dump()

        raise NotImplementedError(f"Handler for {name} not implemented")
