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
    auth_enabled = os.environ.get("AUTH_ENABLED", "false").lower() == "true"
    
    if not auth_enabled:
        # Default system UUID for development
        return "00000000-0000-0000-0000-000000000000"

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
