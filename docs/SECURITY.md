# AegisCode — Security Architecture & Guidelines

## 1. Security Overview

Security is a foundational pillar of AegisCode. Because the platform autonomously inspects third-party repositories and executes code, defensive controls are implemented at every layer.

---

## 2. Authentication & Authorization (RBAC)

### 2.1 Multi-Tenant Organization Isolation

- Every core entity (`Task`, `Repository`, `Project`, `AuditLog`, `AgentRun`) is partitioned by `organization_id`.
- Database queries enforce mandatory tenant scoping:

  ```python
  # Safe scoped query
  db.tasks.find_one({"_id": task_id, "organization_id": current_org_id})
  ```

- Cross-organization queries are rejected at the repository/middleware layer.

### 2.2 Roles and Permissions

- `OWNER`: Full administrative control, billing, organization deletion, policy editing.
- `ADMIN`: Repository connections, team management, policy configuration.
- `MEMBER`: Task creation, task approval within policy limits, PR trigger.
- `VIEWER`: Read-only access to task execution logs, diffs, and metrics.

---

## 3. Sandboxed Code Execution & Command Security

1. **Isolation**: Untrusted code runs in ephemeral Docker containers with:
   - Resource quotas: CPU (max 2 cores), Memory (max 2048 MB), PIDs (max 100).
   - Network isolation: Disabled during test execution unless explicitly required for package fetching.
   - Non-root user: Executes as UID 1000.
   - Read-only root filesystem with ephemeral `/workspace` mount.
2. **Command Allowlisting**:
   Only explicitly approved commands are permitted:
   - Tests: `pytest`, `python -m pytest`, `npm test`, `pnpm test`, `cargo test`, `go test`.
   - Linters/Typecheck: `ruff`, `flake8`, `mypy`, `tsc`, `npm run lint`.
   - Build: `npm run build`, `pnpm build`.
   - Prohibited: Shell redirection (`>`, `|`), `curl`, `wget`, `rm -rf /`, `sudo`, `chmod +s`, environment variable dumps (`env`, `printenv`).

---

## 4. Prompt Injection Defenses

1. **Untrusted Context Framing**:
   Repository files and web searches are wrapped in security delimiters:

   ```text
   <UNTRUSTED_REPOSITORY_DATA source="{filename}">
   ... file contents ...
   </UNTRUSTED_REPOSITORY_DATA>
   ```

2. **Instruction Isolation**:
   System prompts enforce that instructions inside `<UNTRUSTED_REPOSITORY_DATA>` cannot supersede core platform guidelines or trigger privileged tool invocations.
3. **Static Heuristic Scanner**:
   Input and retrieved chunks are scanned for known jailbreak tokens, base64 payload strings, and instructions attempting to override system directives.

---

## 5. Secret Management & Redaction

- Real secrets (GitHub App private keys, MongoDB credentials, LLM keys) are loaded strictly via environment variables.
- Structured loggers and SSE event broadcasters implement an automatic redaction filter for:
  - AWS Access Keys / Secret Keys
  - GitHub Personal Access Tokens & App Tokens (`ghp_`, `ghs_`)
  - OpenAI / Anthropic API keys (`sk-...`)
  - Private RSA / Ed25519 PEM blocks
  - Database URI credentials
