import os
import pytest
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def supabase_admin() -> Client:
    """Provides a Supabase client with service role key (bypasses RLS)."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        pytest.skip("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    return create_client(url, key)

@pytest.fixture(scope="session")
def supabase_anon() -> Client:
    """Provides a Supabase client with anon key (respects RLS)."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        pytest.skip("SUPABASE_URL or SUPABASE_ANON_KEY not set")
    return create_client(url, key)

@pytest.fixture(autouse=True)
def test_env_vars(monkeypatch):
    """Ensure test environment variables are set."""
    monkeypatch.setenv("ENV", "test")
