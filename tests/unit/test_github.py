"""Unit tests for GitHub App client and Webhook HMAC verification."""
import hashlib
import hmac
import pytest
from integrations.github.client import GitHubAppClient
from integrations.github.webhooks import verify_github_signature
from packages.shared.errors import SecurityBlockError


@pytest.mark.asyncio
async def test_github_client_unconfigured_fallback():
    client = GitHubAppClient(app_id="", private_key="")
    # When unconfigured, list_installations returns empty list (no demo data in production)
    installations = await client.list_installations()
    assert isinstance(installations, list)
    assert len(installations) == 0, "Unconfigured GitHub App must return empty installations, not mock data"

    repos = await client.list_repositories(10001)
    assert isinstance(repos, list)
    assert len(repos) == 0, "Unconfigured GitHub App must return empty repos, not mock data"


def test_github_webhook_hmac_verification():
    secret = "my-super-secret-webhook-key-999"
    payload = b'{"action": "opened", "pull_request": {"number": 42}}'

    # Compute genuine signature
    genuine_sig = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    # Verify genuine signature passes
    assert verify_github_signature(payload, genuine_sig, secret=secret) is True

    # Tampered payload should be rejected with SecurityBlockError
    tampered_payload = b'{"action": "opened", "pull_request": {"number": 999}}'
    with pytest.raises(SecurityBlockError):
        verify_github_signature(tampered_payload, genuine_sig, secret=secret)

    # Forged signature should be rejected
    with pytest.raises(SecurityBlockError):
        verify_github_signature(payload, "sha256=invalidhash123", secret=secret)
