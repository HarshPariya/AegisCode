"""Unit tests for authentication, password hashing, JWT, and multi-tenant authorization."""
import pytest
from packages.shared.auth import hash_password, verify_password, create_access_token, decode_access_token
from packages.shared.errors import AuthError
from database.models.user import User, Organization, Membership
from database.repositories.user_repository import UserRepository, OrganizationRepository, MembershipRepository
from packages.shared.constants import OrganizationRole


def test_password_hashing():
    pw = "SuperSecretDevPass123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_lifecycle():
    payload = {"sub": "user-456", "email": "test@aegiscode.internal"}
    token = create_access_token(payload)
    assert isinstance(token, str)

    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-456"
    assert decoded["email"] == "test@aegiscode.internal"

    with pytest.raises(AuthError):
        decode_access_token("corrupted.jwt.token")


@pytest.mark.asyncio
async def test_user_org_membership_isolation():
    user_repo = UserRepository()
    org_repo = OrganizationRepository()
    membership_repo = MembershipRepository()

    import uuid
    uid = uuid.uuid4().hex[:6]
    # Create two distinct users
    user_a = await user_repo.create(User(email=f"alice_{uid}@acme.com", username=f"alice_{uid}", hashed_password=hash_password("pwA")))
    user_b = await user_repo.create(User(email=f"bob_{uid}@cyber.io", username=f"bob_{uid}", hashed_password=hash_password("pwB")))

    # Create Org A owned by Alice
    org_a = await org_repo.create(Organization(name="Acme Corp", slug=f"acme-corp-{uid}", owner_id=user_a.id))
    await membership_repo.create(Membership(organization_id=org_a.id, user_id=user_a.id, role=OrganizationRole.OWNER))

    # Create Org B owned by Bob
    org_b = await org_repo.create(Organization(name="Cyber Security", slug=f"cyber-sec-{uid}", owner_id=user_b.id))
    await membership_repo.create(Membership(organization_id=org_b.id, user_id=user_b.id, role=OrganizationRole.OWNER))

    # Verify Alice is member of Org A, but NOT Org B
    mem_a = await membership_repo.get_membership(org_a.id, user_a.id)
    assert mem_a is not None
    assert mem_a.role == OrganizationRole.OWNER

    mem_b = await membership_repo.get_membership(org_b.id, user_a.id)
    assert mem_b is None
