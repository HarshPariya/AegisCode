"""GitHub webhook signature verification and event handling."""
import hashlib
import hmac
from packages.shared.logging import get_logger
from packages.shared.errors import SecurityBlockError

logger = get_logger("aegiscode.github.webhooks")


def verify_github_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook HMAC-SHA256 signature."""
    if not signature or not signature.startswith("sha256="):
        raise SecurityBlockError("Invalid or missing GitHub webhook signature format.")
    expected = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise SecurityBlockError("GitHub webhook signature verification failed (tampered payload or incorrect secret).")
    return True


async def handle_github_webhook_event(event_type: str, payload: dict) -> dict:
    """Dispatch incoming GitHub webhook event to the appropriate handler."""
    logger.info(f"Received GitHub webhook: {event_type}")
    return {"status": "received", "event": event_type}
