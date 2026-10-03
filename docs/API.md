# AegisCode — REST & Streaming API Documentation

## Base URLs

- Local: `http://localhost:8000`
- Production: Configured via `BACKEND_URL` environment variable.

---

## 1. Health & Probes

- `GET /health`: Liveness probe. Returns `{"status": "healthy", "service": "aegiscode-api"}`.
- `GET /ready`: Readiness probe. Verifies MongoDB connectivity.

---

## 2. Authentication (`/api/auth`)

- `POST /api/auth/register`: Register user and auto-provision organization.

  ```json
  {
    "email": "user@domain.com",
    "username": "lead_engineer",
    "password": "StrongPassword123!",
    "full_name": "Lead Engineer"
  }
  ```

- `POST /api/auth/login`: Exchange credentials for JWT bearer token.
- `GET /api/auth/me`: Current user details and organization bindings.

---

## 3. Organizations (`/api/organizations`)

- `POST /api/organizations`: Create new organization.
- `GET /api/organizations`: List organizations owned or joined by user.
- `GET /api/organizations/{id}`: Organization details.

---

## 4. Engineering Tasks (`/api/tasks`)

- `POST /api/tasks`: Create an engineering task with constraints.

  ```json
  {
    "repository_id": "ecommerce-api",
    "title": "Fix JWT refresh-token expiration bug",
    "description": "Ensure tokens are checked for expiration before issuing new access tokens.",
    "constraints": ["Do not modify database schema"],
    "execution_policy": "standard"
  }
  ```

- `GET /api/tasks`: List tasks for the organization (supports `?status=COMPLETED` filter).
- `GET /api/tasks/{id}`: Full task record, including plan, diff, test results, security audit, review, and PR link.
- `POST /api/tasks/{id}/execute`: Trigger background multi-agent execution.
- `POST /api/tasks/{id}/cancel`: Cancel active or paused task.
- `POST /api/tasks/{id}/resume`: Resume a paused or blocked task.
- `GET /api/tasks/{id}/events`: Retrieve all historical execution events.
- `GET /api/tasks/{id}/diff`: Retrieve generated file patches and line additions/deletions.
- `GET /api/tasks/{id}/events/stream`: Realtime Server-Sent Events (SSE) event stream.

---

## 5. Human Approvals (`/api`)

- `GET /api/approvals`: List all pending human approval requests for the organization.
- `GET /api/tasks/{id}/approvals`: List approvals associated with a specific task.
- `POST /api/tasks/{id}/approve`: Authorize a paused action and resume execution.
- `POST /api/tasks/{id}/reject`: Reject the requested action and mark task as blocked.

---

## 6. Model Context Protocol (`/api/mcp`)

- `GET /api/mcp/tools`: List discoverable tools with input/output schemas.
- `POST /api/mcp/tools/call`: Execute policy-approved MCP tool call.

---

## 7. Agent-to-Agent (`/api/a2a`)

- `GET /api/a2a/cards`: Discover registered Agent Cards and declared capabilities.
