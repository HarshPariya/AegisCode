"""Supervisor Agent: Task planning, step routing, and completion evaluation."""
from packages.contracts.models import TaskPlan
from integrations.llm.gateway import get_model_gateway
from packages.shared.logging import get_logger

logger = get_logger("aegiscode.agent.supervisor")

SYSTEM_PROMPT = """You are the Lead Supervisor Agent for AegisCode, an autonomous AI software engineering platform.
Your objective is to analyze a software engineering task description, understand the constraints, and generate a structured, deterministic execution plan.
Your plan must coordinate specialized agents:
- Researcher: explore repository, find relevant files, form root cause hypothesis.
- Coder: apply minimal, clean patches and add regression tests.
- Tester: run tests in the isolated sandbox and verify bug fixes.
- Security: audit diffs for credentials, injections, and SSRF.
- Reviewer: perform automated peer review.

Respond strictly with valid JSON conforming to the TaskPlan schema."""


class SupervisorAgent:
    def __init__(self):
        self.gateway = get_model_gateway()

    async def plan_task(self, title: str, description: str, constraints: list[str]) -> TaskPlan:
        logger.info(f"Supervisor generating plan for: '{title}'")
        constraints_str = "\n".join(f"- {c}" for c in constraints) if constraints else "None specified"
        prompt = (
            f"Engineering Task Title: {title}\n"
            f"Description: {description}\n"
            f"Constraints:\n{constraints_str}\n\n"
            "Formulate a structured execution plan."
        )
        plan = await self.gateway.generate_structured(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            response_schema=TaskPlan
        )
        return plan
