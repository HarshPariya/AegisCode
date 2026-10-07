"""Sandbox command security policies and allowlists."""
import re
from typing import List, Tuple
from packages.shared.errors import SecurityBlockError

# Permitted command categories
ALLOWED_COMMAND_PREFIXES: List[str] = [
    "pytest",
    "python",
    "python3",
    "node",
    "npm",
    "pnpm",
    "yarn",
    "pip",
    "poetry",
    "ruff",
    "flake8",
    "mypy",
    "tsc",
    "git",
    "ls",
    "find",
    "cat",
    "head",
    "tail",
    "grep",
    "echo",
    "mkdir",
    "pwd",
]

# Prohibited shell operators and dangerous patterns
DISALLOWED_PATTERNS = [
    re.compile(r"(\||&|;|`|\$\(|\$\{)"),         # Shell chaining, subshells
    re.compile(r"(>|>>|<)"),                     # Shell file redirection
    re.compile(r"\b(curl|wget|nc|ncat|netcat|ssh|scp|ftp)\b", re.IGNORECASE), # Outbound network tools
    re.compile(r"\b(sudo|su|chmod|chown)\b", re.IGNORECASE),                  # Privilege escalation
    re.compile(r"\b(rm\s+-rf\s+/|mkfs|dd)\b", re.IGNORECASE),                 # Destruction
    re.compile(r"\b(env|printenv|export)\b", re.IGNORECASE),                  # Secret exfiltration
]


def validate_sandbox_command(command: str) -> Tuple[bool, str]:
    """Validate that a command complies with sandbox security policies."""
    clean_cmd = command.strip()

    # Check against prohibited patterns
    for pattern in DISALLOWED_PATTERNS:
        if pattern.search(clean_cmd):
            raise SecurityBlockError(
                f"Command contains prohibited shell metacharacters or dangerous binaries: '{command}'"
            )

    # Check prefix allowlist
    is_allowed = any(
        clean_cmd == prefix or clean_cmd.startswith(prefix + " ") or clean_cmd.startswith(prefix + "-") or clean_cmd.startswith(prefix)
        for prefix in ALLOWED_COMMAND_PREFIXES
    )
    if not is_allowed:
        raise SecurityBlockError(
            f"Command '{command}' is not in the sandbox security allowlist. "
            f"Permitted command categories: {[p.split()[0] for p in ALLOWED_COMMAND_PREFIXES]}"
        )

    return True, clean_cmd
