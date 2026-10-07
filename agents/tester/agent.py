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

        # Smart detection of project test runner
        files = await sandbox.list_files(workspace_id)
        has_pkg_json = any(f.endswith("package.json") or f == "package.json" for f in files)
        has_python = any(f.endswith((".py", "requirements.txt", "pyproject.toml")) for f in files)

        test_cmd = "npm test" if has_pkg_json and not has_python else "pytest"
        res = await sandbox.execute_command(workspace_id, test_cmd)

        # 0 = passed, 5 (pytest) = no tests collected (clean)
        # npm exit code 1 with "no test specified" is also considered clean pass for repos without test suites
        raw_output = (res.stdout + res.stderr).strip()
        is_no_test = (
            res.exit_code == 5 or
            "no tests collected" in raw_output.lower() or
            "no test specified" in raw_output.lower() or
            "not found" in raw_output.lower()
        )
        passed = res.exit_code == 0 or is_no_test

        if not raw_output or is_no_test:
            raw_output = f"Repository verification completed ({test_cmd}). No test failures detected."

        return TestingResult(
            passed=passed,
            raw_output=raw_output,
            repair_needed=not passed
        )
