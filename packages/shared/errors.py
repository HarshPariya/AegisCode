"""Custom exception hierarchy for AegisCode."""


class AegisError(Exception):
    """Base exception for all AegisCode errors."""
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class AuthError(AegisError):
    """Raised when authentication fails (invalid/missing token)."""


class AuthorizationError(AegisError):
    """Raised when a user lacks permission to perform an action."""


class SecurityBlockError(AegisError):
    """Raised when the security policy blocks an action."""


class WorkflowTransitionError(AegisError):
    """Raised on invalid workflow state transitions."""


class ModelExecutionError(AegisError):
    """Raised when the LLM gateway call fails."""


class GitHubIntegrationError(AegisError):
    """Raised on GitHub API errors."""


class SandboxError(AegisError):
    """Raised when sandbox execution fails."""
