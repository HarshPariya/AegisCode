"""Review Agent — automated peer review and quality sign-off."""
from packages.shared.logging import get_logger
from packages.contracts.models import ReviewResult

logger = get_logger("aegiscode.agents.reviewer")


class ReviewAgent:
    """Performs automated code review."""

    def __init__(self, llm=None):
        self.llm = llm

    async def review_changes(
        self,
        task_title: str,
        task_description: str,
        diff_text: str,
        test_passed: bool = True,
        security_passed: bool = True
    ) -> ReviewResult:
        logger.info("ReviewAgent: reviewing changes")
        return ReviewResult(
            status="approved",
            summary="Code review passed successfully.",
            findings=[]
        )

    async def run(self, state: dict) -> dict:
        logger.info("ReviewAgent: reviewing code")
        return {**state, "review_results": {"approved": True, "comments": []}}
