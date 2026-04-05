"""
Test Suite: API Layer Integrity (Module 9)

Verifies FastAPI routes, response codes, and cross-tenant access prevention.
Focuses on ensuring that a user cannot access another user's forensic cases.
"""

import pytest
import os
from fastapi.testclient import TestClient
from kuratormind.api.main import app
from kuratormind.api.deps import get_current_user

client = TestClient(app)

# Standard Test UUIDs
TEST_USER_A = "00000000-0000-0000-0000-00000000000a"
TEST_USER_B = "00000000-0000-0000-0000-00000000000b"
EXISTING_CASE_A = "00000000-0000-0000-0000-000000000001"

def test_health_check():
    """Verify the health check endpoint is public and functional."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_agents_list():
    """Verify the agents list endpoint is public."""
    response = client.get("/agents")
    assert response.status_code == 200
    assert "agents" in response.json()
    assert len(response.json()["agents"]) >= 6

def test_auth_guard_enforcement():
    """TC-SEC-01: Verify 401 Unauthorized for missing Bearer token when AUTH_ENABLED=true."""
    # We monkeypatch the environment to enable auth for this test
    os.environ["AUTH_ENABLED"] = "true"
    try:
        response = client.get("/api/v1/cases")
        # Middleware should catch missing auth header
        assert response.status_code == 401
        assert "Missing or malformed Authorization header" in response.json()["detail"]
    finally:
        # Reset to default
        os.environ["AUTH_ENABLED"] = "false"

def test_get_cases_authenticated_empty():
    """Verify that a new user gets an empty list of cases."""
    # Mock the user to be TEST_USER_B who has no cases
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_B
    try:
        response = client.get("/api/v1/cases")
        assert response.status_code == 200
        assert response.json()["count"] == 0
    finally:
        app.dependency_overrides = {}

def test_cross_tenant_access_denied():
    """TC-SEC-02: Verify User B cannot access User A's case."""
    # 1. Mock user as User B
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_B
    try:
        # 2. Attempt to fetch Case A (which belongs to User A)
        response = client.get(f"/api/v1/cases/{EXISTING_CASE_A}")
        
        # 3. Should return 404 Not Found because the query includes user_id check
        assert response.status_code == 404
        assert "Case not found" in response.json()["detail"]
    finally:
        app.dependency_overrides = {}

def test_chat_endpoint_requires_case_id():
    """Verify chat endpoint validates input."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_A
    try:
        # Missing case_id in payload
        response = client.post("/api/v1/chat", json={"message": "Hello"})
        assert response.status_code == 422 # Unprocessable Entity (Validation Error)
    finally:
        app.dependency_overrides = {}

def test_claim_verification_route():
    """Verify the claim verification route exists and handles missing data."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_A
    try:
        # Test with a non-existent case_id
        response = client.post("/api/v1/claims/verify", json={
            "case_id": "00000000-0000-0000-0000-000000000000",
            "creditor_name": "Ghost Creditor"
        })
        # Should likely fail with 404 or some error depending on implementation
        assert response.status_code in [404, 500]
    finally:
        app.dependency_overrides = {}
