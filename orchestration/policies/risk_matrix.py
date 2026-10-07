"""Risk matrix policy engine determining human approval requirements."""
from typing import Tuple
from packages.shared.constants import RiskLevel
from packages.shared.errors import SecurityBlockError

ACTION_RISK_MAP = {
    "read_file": RiskLevel.LOW,
    "search_code": RiskLevel.LOW,
    "run_unit_tests": RiskLevel.LOW,
    "run_linter": RiskLevel.LOW,
    "create_branch": RiskLevel.MEDIUM,
    "modify_source": RiskLevel.MEDIUM,
    "create_commit": RiskLevel.MEDIUM,
    "create_pull_request": RiskLevel.MEDIUM,
    "merge_pull_request": RiskLevel.HIGH,
    "deploy_staging": RiskLevel.HIGH,
    "deploy_production": RiskLevel.CRITICAL,
    "delete_production_data": RiskLevel.CRITICAL,
    "change_production_secrets": RiskLevel.CRITICAL,
}


def evaluate_action_risk(action: str) -> RiskLevel:
    """Determine risk level of an action."""
    return ACTION_RISK_MAP.get(action.lower(), RiskLevel.HIGH)


class PolicyEngine:
    def __init__(self, allow_production_deploy: bool = False):
        self.allow_production_deploy = allow_production_deploy

    def evaluate_execution(self, action: str, execution_policy: str = "standard") -> Tuple[bool, RiskLevel, str]:
        """
        Evaluate whether an action is allowed, requires human approval, or is blocked.
        Returns: (needs_approval, risk_level, reason)
        """
        risk = evaluate_action_risk(action)

        # Critical actions fail-closed
        if risk == RiskLevel.CRITICAL and not self.allow_production_deploy:
            raise SecurityBlockError(f"Action '{action}' is classified as CRITICAL and is disabled by policy.")

        if execution_policy == "strict":
            # Strict mode requires approval for MEDIUM and above
            if risk in (RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL):
                return True, risk, f"Action '{action}' requires approval under strict policy."
            return False, risk, "Auto-approved under strict policy"

        if execution_policy == "auto_approve_low_risk":
            if risk in (RiskLevel.HIGH, RiskLevel.CRITICAL):
                return True, risk, f"Action '{action}' requires approval due to {risk.value} risk."
            return False, risk, "Auto-approved"

        # Standard policy: requires human authorization for MEDIUM, HIGH, and CRITICAL actions (e.g. modify_source, create_pull_request)
        if risk in (RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL):
            return True, risk, f"Action '{action}' requires human sign-off ({risk.value} risk)."

        return False, risk, "Auto-approved under standard policy"
