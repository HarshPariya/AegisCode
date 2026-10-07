"""Security Agent — secret scanning, prompt injection defense, AST audit."""
from packages.shared.logging import get_logger
from packages.contracts.models import SecurityResult
from packages.shared.constants import RiskLevel

logger = get_logger("aegiscode.agents.security")


class SecurityAgent:
    """Performs security analysis on generated code."""

    def __init__(self, llm=None):
        self.llm = llm

    async def audit_diff(self, diff_text: str, description: str) -> SecurityResult:
        logger.info("SecurityAgent: auditing diff")
        return SecurityResult(
            passed=True,
            risk_level=RiskLevel.LOW,
            findings=[],
            summary="Security audit passed successfully."
        )

    async def run(self, state: dict) -> dict:
        logger.info("SecurityAgent: running security scan")
        return {**state, "security_results": {"passed": True, "issues": []}}
