"""A2A Agent Cards module."""
from pydantic import BaseModel


class AgentCard(BaseModel):
    name: str
    description: str
    role: str
    capabilities: list[str] = []
    version: str = "0.1.0"


def get_all_agent_cards() -> list[AgentCard]:
    return [
        AgentCard(
            name="Supervisor Agent",
            description="Goal decomposition, plan generation, and team routing.",
            role="supervisor",
            capabilities=["plan", "route", "decompose"],
        ),
        AgentCard(
            name="Research Agent",
            description="Repository exploration, call graph analysis, and dependency discovery.",
            role="researcher",
            capabilities=["explore", "analyze", "graph"],
        ),
        AgentCard(
            name="Coding Agent",
            description="Targeted patch generation, architectural preservation, and regression tests.",
            role="coder",
            capabilities=["patch", "generate", "preserve"],
        ),
        AgentCard(
            name="Testing Agent",
            description="Sandboxed test execution, diagnostic failure parsing, and repair loop.",
            role="tester",
            capabilities=["execute", "diagnose", "repair"],
        ),
        AgentCard(
            name="Security Agent",
            description="Hardcoded secret scanning, prompt injection defense, and AST security audit.",
            role="security",
            capabilities=["scan", "audit", "defend"],
        ),
        AgentCard(
            name="Review Agent",
            description="Automated peer review, scope verification, and quality sign-off.",
            role="reviewer",
            capabilities=["review", "verify", "signoff"],
        ),
    ]
