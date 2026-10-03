# AegisCode — Model Context Protocol (MCP) Integration

AegisCode implements the Model Context Protocol (MCP) as a standardized tool gateway. This decouples the agent reasoning engine from tool execution and allows external agent runtimes to consume AegisCode tools safely.

---

## 1. Tool Lifecycle & Policy Pipeline

Every MCP tool execution follows this pipeline:

```text
Agent Request
      ↓
Authentication & Role Check
      ↓
Policy Engine Risk Matrix Evaluation
      ↓
Argument Sanitization & Schema Validation
      ↓
Sandboxed Execution
      ↓
Output Size & Secret Redaction Filter
      ↓
Immutable Audit Event
```

---

## 2. Standard MCP Tools Exposed

- `workspace.read_file`:
  - Input: `{"workspace_id": "ws-123", "file_path": "services/auth.py"}`
  - Risk Level: `LOW`
- `workspace.write_file`:
  - Input: `{"workspace_id": "ws-123", "file_path": "services/auth.py", "content": "..."}`
  - Risk Level: `MEDIUM`
- `terminal.run_tests`:
  - Input: `{"workspace_id": "ws-123", "command": "pytest"}`
  - Risk Level: `LOW`
  - Validates command against `ALLOWED_COMMAND_PREFIXES` and checks for prohibited shell operators.
