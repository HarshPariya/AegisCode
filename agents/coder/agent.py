"""Coding Agent: Code modification, regression test implementation, and patch generation."""
import json
import httpx
from packages.contracts.models import CodingResult, ResearchResult, DiffSummary
from integrations.llm.gateway import get_model_gateway
from packages.config.settings import get_settings
from sandbox.interface.base import SandboxProvider
from mcp.gateway.server import MCPGateway
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.agent.coder")

SYSTEM_PROMPT = """You are the Senior Coding Agent for AegisCode.
Your objective is to modify source code to implement the requested task or fix the reported bug cleanly.

You have access to tools via Model Context Protocol (MCP).
Use `workspace.read_file` to investigate the code.
Use `workspace.write_file` to apply changes.
Use `terminal.run_tests` to verify your changes.

Rules:
1. Preserve existing project architecture and conventions.
2. Minimize unnecessary diff footprint.
3. Include regression tests if applicable.
4. When you have finished writing the code and verifying it, you MUST output your final summary as a valid JSON object matching this schema:
{
  "summary": "String summarizing your changes",
  "modified_files": ["list of strings of files you changed"],
  "warnings": ["list of strings of any warnings or technical debt"]
}
DO NOT output any extra markdown or text alongside the final JSON object. Just the JSON object.
"""


class CodingAgent:
    def __init__(self):
        self.gateway = get_model_gateway()
        self.settings = get_settings()
        self.mcp = MCPGateway()

    async def execute_code_changes(
        self,
        task_title: str,
        task_description: str,
        research: ResearchResult,
        sandbox: SandboxProvider,
        workspace_id: str,
        repair_context: str = None
    ) -> CodingResult:
        logger.info(f"Coding Agent applying changes in workspace {workspace_id}")

        prompt = (
            f"Task: {task_title}\n"
            f"Description: {task_description}\n"
            f"Research Root Cause: {research.suspected_root_cause}\n"
            f"Relevant Files: {', '.join(research.relevant_files)}\n"
        )
        if repair_context:
            prompt += f"\nRepair Guidance from Failed Tests:\n{repair_context}\n"

        if not self.settings.MODEL_API_KEY or self.settings.MODEL_API_KEY in ("your-groq-or-openai-api-key-here", "mock-api-key", ""):
            logger.warning("No real API key provided. Falling back to mocked code execution.")
            result = await self.gateway.generate_structured(
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT,
                response_schema=CodingResult
            )
            # fallback mock behaviour
            target_files = list(result.modified_files) if result.modified_files else []
            if not target_files:
                target_files = ["src/health.py" if "health" in task_title.lower() else "README.md"]
                result.modified_files = target_files
            for f in target_files:
                existing = ""
                try:
                    existing = await sandbox.read_file(workspace_id, f)
                except Exception:
                    pass
                updated = existing + f"\n# [AegisCode] {task_title}\n"
                await sandbox.write_file(workspace_id, f, updated)
                
            diff = await sandbox.collect_diff(workspace_id)
            if diff.files_changed > 0:
                result.diff_summary = diff
            return result

        logger.info("Using real ReAct loop for CodingAgent via MCP.")
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        tools = [
            {
                "type": "function",
                "function": {
                    "name": tool.name.replace(".", "_"),
                    "description": tool.description,
                    "parameters": tool.input_schema
                }
            } for tool in self.mcp.list_tools()
        ]

        base_url = "https://api.groq.com/openai/v1" if self.settings.MODEL_PROVIDER == "groq" else "https://api.openai.com/v1"
        if self.settings.MODEL_PROVIDER == "gemini":
            # Very basic fallback for gemini to standard gateway since Gemini tools JSON is different
            logger.warning("Gemini tools not implemented in native loop. Falling back to structured schema.")
            return await self.gateway.generate_structured(prompt=prompt, system_prompt=SYSTEM_PROMPT, response_schema=CodingResult)

        headers = {
            "Authorization": f"Bearer {self.settings.MODEL_API_KEY}",
            "Content-Type": "application/json"
        }
        
        model_to_use = self.settings.MODEL_NAME

        max_steps = 10
        async with httpx.AsyncClient() as client:
            for step in range(max_steps):
                payload = {
                    "model": model_to_use,
                    "messages": messages,
                    "temperature": self.settings.MODEL_TEMPERATURE,
                    "tools": tools,
                    "tool_choice": "auto"
                }

                resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=60.0)
                if resp.status_code != 200:
                    logger.error(f"API Error {resp.status_code}: {resp.text}")
                    break

                data = resp.json()
                message = data["choices"][0]["message"]
                messages.append(message)

                if message.get("tool_calls"):
                    for tc in message["tool_calls"]:
                        try:
                            args = json.loads(tc["function"]["arguments"])
                            # Force inject workspace ID securely
                            args["workspace_id"] = workspace_id
                            logger.info(f"LLM executing MCP Tool: {tc['function']['name']}")
                            tool_res = await self.mcp.call_tool(tc["function"]["name"], args)
                            tool_content = json.dumps(tool_res)
                        except Exception as e:
                            logger.error(f"MCP Tool error: {e}")
                            tool_content = f"Error executing tool: {str(e)}"

                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "name": tc["function"]["name"],
                            "content": tool_content
                        })
                else:
                    # No tool calls = final JSON
                    content = message.get("content", "")
                    try:
                        # Extract json block if they wrap it in ```json
                        if "```json" in content:
                            content = content.split("```json")[1].split("```")[0].strip()
                        elif "```" in content:
                            content = content.split("```")[1].split("```")[0].strip()
                            
                        parsed = json.loads(content)
                        if isinstance(parsed, dict) and not parsed.get("diff_summary"):
                            parsed["diff_summary"] = DiffSummary().model_dump()
                        result = CodingResult.model_validate(parsed)
                    except Exception as e:
                        logger.error(f"Failed to parse final coding result: {e}\nContent was: {content}")
                        result = CodingResult(
                            summary=content[:300] if content else "Code modifications applied.",
                            modified_files=[],
                            diff_summary=DiffSummary(),
                            warnings=[str(e)]
                        )

                    diff = await sandbox.collect_diff(workspace_id)
                    if diff and diff.files_changed > 0:
                        result.diff_summary = diff
                        result.modified_files = [f.file_path for f in diff.files]
                    elif not result.diff_summary:
                        result.diff_summary = DiffSummary()
                    return result

        # Max steps reached fallback
        diff = await sandbox.collect_diff(workspace_id)
        files = [f.file_path for f in diff.files] if (diff and diff.files_changed) else []
        return CodingResult(
            summary="Agent completed targeted code analysis and modifications.",
            modified_files=files,
            diff_summary=diff or DiffSummary(),
            warnings=["Max steps reached"] if not files else []
        )
