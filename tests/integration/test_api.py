import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_api_health_and_probes(client: AsyncClient):
    # 1. Test /health
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"
    assert "X-Request-ID" in resp.headers

    # 2. Test /ready
    resp_ready = await client.get("/ready")
    assert resp_ready.status_code == 200
    assert resp_ready.json()["status"] == "ready"

@pytest.mark.asyncio
async def test_auth_and_protected_task_flow(client: AsyncClient):
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    # Register user with unique credentials
    reg_payload = {
        "email": f"engineer_{unique_id}@aegiscode.internal",
        "username": f"eng_{unique_id}",
        "password": "StrongPassword123!",
        "full_name": "Lead Engineer"
    }
    reg_resp = await client.post("/api/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify /me
    me_resp = await client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == reg_payload["username"]

    # Create Task
    task_payload = {
        "repository_id": "repo-alpha",
        "title": "Fix memory leak in websocket handler",
        "description": "Ensure sockets close on client disconnection.",
        "constraints": ["No new dependencies"],
        "execution_policy": "standard"
    }
    task_resp = await client.post("/api/tasks", json=task_payload, headers=headers)
    assert task_resp.status_code == 201
    task_data = task_resp.json()
    assert task_data["status"] == "CREATED"
    task_id = task_data["id"]

    # List tasks
    list_resp = await client.get("/api/tasks", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # Fetch Task by ID
    get_resp = await client.get(f"/api/tasks/{task_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == task_id

    # Cancel Task
    cancel_resp = await client.post(f"/api/tasks/{task_id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] in ("CANCELLED", "COMPLETED")

    # Test Agent Cards & MCP tools
    cards_resp = await client.get("/api/a2a/cards")
    assert cards_resp.status_code == 200
    assert len(cards_resp.json()) >= 3

    mcp_resp = await client.get("/api/mcp/tools", headers=headers)
    assert mcp_resp.status_code == 200
    assert len(mcp_resp.json()) >= 3
