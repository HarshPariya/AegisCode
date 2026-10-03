# AegisCode — Agent Workforce Specifications

AegisCode operates under the core principle that **no single agent has unconstrained power**. Responsibilities, tools, and execution environments are strictly partitioned.

---

## 1. Supervisor Agent

- **Role**: Architectural decomposition and lifecycle orchestration.
- **Responsibilities**:
  - Analyzes natural language instructions and constraints.
  - Generates a structured, phased `TaskPlan`.
  - Routes execution across specialized agents.
  - Enforces bounded retry limits.
- **Tool Access**: Read-only metadata and planning primitives. Cannot write code or execute shell commands.

---

## 2. Research Agent

- **Role**: Codebase exploration and context discovery.
- **Responsibilities**:
  - Scans repository tree and discovers relevant source files.
  - Analyzes test runner setups and dependencies.
  - Formulates root-cause hypotheses and risk assessments.
- **Tool Access**: `list_files`, `read_file`, `search_code`. Read-only access to workspace.

---

## 3. Coding Agent

- **Role**: Targeted patch generation and regression test creation.
- **Responsibilities**:
  - Applies minimal, clean edits to target source files.
  - Implements regression test assertions.
  - Respects project conventions and architecture.
- **Tool Access**: `read_file`, `write_file`, `collect_diff`. Sandboxed workspace filesystem only. No host network access.

---

## 4. Testing Agent

- **Role**: Automated validation and failure diagnostics.
- **Responsibilities**:
  - Executes approved test commands inside the container sandbox.
  - Classifies test failures and parses stack traces.
  - Coordinates bounded repair cycles (max 3 attempts).
- **Tool Access**: `terminal.run_tests`, `terminal.run_linter`. Subject to strict command allowlist.

---

## 5. Security Agent

- **Role**: Static and semantic vulnerability auditing.
- **Responsibilities**:
  - Scans diffs for credentials (AWS, GitHub, JWT, private keys).
  - Flags indirect prompt injections in repository files or issues.
  - Blocks path traversal, shell injection, and SSRF patterns.
- **Tool Access**: AST and diff security scanner. Has veto power to block unsafe workflows.

---

## 6. Review Agent

- **Role**: Objective peer review and quality evaluation.
- **Responsibilities**:
  - Verifies that modifications satisfy the original task prompt.
  - Checks for regressions, scope creep, and architectural drift.
  - Generates a structured peer review report (`approved | changes_requested | blocked`).
- **Tool Access**: Read-only review evaluator. Cannot write code or trigger PR creation.
