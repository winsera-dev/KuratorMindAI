import pytest
import os
from fastapi.testclient import TestClient
from kuratormind.api.main import app

client = TestClient(app)

def test_auth_disabled_without_dev_user_id():
    """Verify that the API returns a 500 error when AUTH_ENABLED is false and DEV_USER_ID is not set."""
    # Set AUTH_ENABLED to false and ensure DEV_USER_ID is unset
    os.environ["AUTH_ENABLED"] = "false"
    if "DEV_USER_ID" in os.environ:
        del os.environ["DEV_USER_ID"]

    try:
        # Calling an endpoint that depends on get_current_user
        response = client.get("/api/v1/cases")

        # Should return 500 Internal Server Error as defined in deps.py
        assert response.status_code == 500
        assert "DEV_USER_ID must be set when AUTH_ENABLED is false" in response.json()["detail"]
    finally:
        # Restore environment (though ideally tests should handle this)
        os.environ["AUTH_ENABLED"] = "true"

def test_auth_disabled_with_dev_user_id():
    """Verify that the API works when AUTH_ENABLED is false and DEV_USER_ID is set."""
    os.environ["AUTH_ENABLED"] = "false"
    os.environ["DEV_USER_ID"] = "d1122f85-142f-411b-879f-7d15998f3304"

    try:
        response = client.get("/api/v1/cases")
        # Should NOT be 500. Might be 200 or 404 depending on DB state, but not the config error.
        assert response.status_code != 500
    finally:
        os.environ["AUTH_ENABLED"] = "true"
        if "DEV_USER_ID" in os.environ:
            del os.environ["DEV_USER_ID"]
