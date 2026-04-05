import os
import jwt
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)
security = HTTPBearer()

def get_current_user(auth: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    FastAPI dependency to verify a Supabase JWT.
    Returns the user's UUID (sub claim) if valid.
    """
    token = auth.credentials
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    
    if not secret:
        logger.error("SUPABASE_JWT_SECRET is not set in environment variables")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication configuration error",
        )

    try:
        # Decode and validate the JWT locally using the shared secret
        # Supabase uses HS256 by default for its API tokens
        payload = jwt.decode(
            token, 
            secret, 
            algorithms=["HS256"], 
            options={"verify_aud": False} # Supabase tokens often have 'authenticated' as aud
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject claim",
            )
            
        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token attempt: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    except Exception as e:
        logger.error(f"Unexpected auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )
