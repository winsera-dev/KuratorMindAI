import os
import logging
from typing import Optional, Annotated
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

def get_supabase_client() -> Client:
    """Returns an authenticated Supabase admin client."""
    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set")
    return create_client(url, service_key)

def get_current_user(auth: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> str:
    """
    FastAPI dependency to verify a Supabase JWT using the Supabase SDK.
    If AUTH_ENABLED=false, returns a default system UUID for local development.
    """
    # SECURITY: Default to TRUE — a missing env var must be SECURE, not open.
    # Explicitly set AUTH_ENABLED=false in your local .env for dev mode.
    auth_enabled = os.environ.get("AUTH_ENABLED", "true").lower() == "true"
    
    if not auth_enabled:
        # Return a valid user ID for local development to avoid FK violations
        dev_user_id = os.environ.get("DEV_USER_ID")
        if not dev_user_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="DEV_USER_ID must be set when AUTH_ENABLED is false",
            )
        return dev_user_id

    if not auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
        )

    token = auth.credentials

    try:
        supabase = get_supabase_client()
        # Supabase SDK handles all JWT formats and key rotations internally
        response = supabase.auth.get_user(token)

        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        return response.user.id

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Auth verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )
