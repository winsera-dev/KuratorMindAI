import os
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client

logger = logging.getLogger(__name__)
security = HTTPBearer()

def get_supabase_client() -> Client:
    """Returns an authenticated Supabase admin client."""
    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        raise RuntimeError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set")
    return create_client(url, service_key)

def get_current_user(auth: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    FastAPI dependency to verify a Supabase JWT using the Supabase SDK.
    Works with all key types (HS256, ECC P-256) and is rotation-safe.
    Returns the user's UUID (sub claim) if valid.
    """
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
