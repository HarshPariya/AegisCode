# AegisCode — Agent-to-Agent (A2A) Interoperability

AegisCode adopts the A2A 1.0 specification for cross-platform agent discovery, capability negotiation, and task delegation.

---

## 1. Discovered Agent Cards (`GET /api/a2a/cards`)

### 1.1 Supervisor Card (`aegiscode.supervisor`)

- **Capabilities**: `task_planning`, `agent_delegation`, `lifecycle_management`.
- **Input Modes**: `json`, `text`.
- **Output Modes**: `json`.

### 1.2 Security Card (`aegiscode.security`)

- **Capabilities**: `secret_detection`, `prompt_injection_defense`, `ast_security_audit`.
- **Description**: Independent security audit specialist.

### 1.3 Reviewer Card (`aegiscode.reviewer`)

- **Capabilities**: `code_review`, `regression_analysis`.
- **Description**: Automated peer code reviewer.

---

## 2. Security Boundaries in Delegation

- External agents communicating via A2A cannot access internal database credentials or host terminals.
- Only explicitly authorized task specifications and verified diff outputs cross the A2A boundary.
