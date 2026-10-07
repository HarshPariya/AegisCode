"""Unit tests for MongoDB models, connection, and repositories."""
import pytest
from database.models import User, Task
from database.repositories import TaskRepository, UserRepository, AuditRepository
from packages.shared.constants import TaskStatus
from packages.shared.errors import AuthorizationError


@pytest.mark.asyncio
async def test_database_models_and_repository_crud():
    import uuid
    uid = uuid.uuid4().hex[:6]
    user_repo = UserRepository()
    user = User(
        email=f"developer_{uid}@aegiscode.internal",
        username=f"lead_dev_{uid}",
        hashed_password="secure_hashed_password"
    )
    saved_user = await user_repo.create(user)
    assert saved_user.id is not None
    assert saved_user.email == f"developer_{uid}@aegiscode.internal"

    fetched_user = await user_repo.get_by_id(saved_user.id)
    assert fetched_user is not None
    assert fetched_user.username == f"lead_dev_{uid}"

    # 2. Test Task creation, scoping, and status update
    task_repo = TaskRepository()
    task = Task(
        organization_id="org-123",
        user_id=saved_user.id,
        repository_id="repo-abc",
        title="Fix JWT expiration flaw",
        description="Add proper expiration handling to token refresh route."
    )
    saved_task = await task_repo.create(task)
    assert saved_task.status == TaskStatus.CREATED

    # Verify tenant scoping
    scoped_task = await task_repo.get_by_id(saved_task.id, organization_id="org-123")
    assert scoped_task is not None
    assert scoped_task.title == "Fix JWT expiration flaw"

    # Verify cross-tenant isolation enforcement raises AuthorizationError
    with pytest.raises(AuthorizationError):
        await task_repo.get_by_id(saved_task.id, organization_id="other-org-999")

    # Update task status
    updated_task = await task_repo.update_status(saved_task.id, TaskStatus.PLANNING, organization_id="org-123")
    assert updated_task is not None
    assert updated_task.status == TaskStatus.PLANNING

    # 3. Test Audit Log
    audit_repo = AuditRepository()
    audit_entry = await audit_repo.log_action(
        organization_id="org-123",
        user_id=saved_user.id,
        task_id=saved_task.id,
        actor_type="user",
        actor_id=saved_user.id,
        action="TASK_CREATED",
        resource=f"task:{saved_task.id}",
        result="SUCCESS"
    )
    assert audit_entry.id is not None
    assert audit_entry.action == "TASK_CREATED"
