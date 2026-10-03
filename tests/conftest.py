"""Global pytest fixtures and configuration for AegisCode test suite."""
import asyncio
import pytest
from database.connection import init_database, close_database

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
def initialize_db_session(event_loop):
    """Initialize database connection once per test session."""
    try:
        event_loop.run_until_complete(init_database())
    except Exception as e:
        print(f"Warning: Database initialization in conftest failed: {e}")
    yield
    try:
        event_loop.run_until_complete(close_database())
    except Exception:
        pass
