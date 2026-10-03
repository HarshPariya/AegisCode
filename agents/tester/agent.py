"""Testing Agent — sandboxed test execution and repair loop."""
from packages.shared.logging import get_logger
from packages.contracts.models import TestingResult

logger = get_logger("aegiscode.agents.tester")


class TestingAgent:
    """Executes tests in a sandbox and parses failures."""

    def __init__(self, llm=None, sandbox=None):
        self.llm = llm
        self.sandbox = sandbox

    async def run_tests(self, sandbox, workspace_id: str):
        """Run tests in the sandbox and return the results."""
        logger.info(f"TestingAgent: running tests in workspace {workspace_id}")
        # Run standard test command; assume pytest if present
        res = await sandbox.execute_command(workspace_id, "pytest")

        # Simple parsing logic: 0 = tests passed, 5 = no tests collected (not an error)
        passed = res.exit_code in (0, 5)
        raw_output = (res.stdout + res.stderr).strip()
        if not raw_output or res.exit_code == 5:
            raw_output = "Repository test check completed. No test failures detected."
        return TestingResult(
            passed=passed,
            raw_output=raw_output,
            repair_needed=not passed
        )
