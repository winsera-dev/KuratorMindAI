"""
KuratorMind AI — FastAPI Server

Main entry point for the agent backend API. Exposes endpoints for:
- Chat (SSE streaming)
- Document ingestion
- Claim verification
- Health check
"""

import logging
import os
from dotenv import load_dotenv  # type: ignore
import jwt  # PyJWT

# Configure logging to show INFO-level messages from our services
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
from fastapi import FastAPI, Request  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.responses import JSONResponse  # type: ignore
from slowapi.errors import RateLimitExceeded
from kuratormind.api.limiter import limiter

# Load environment variables
# Look for .env in apps/agents/
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(base_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    # Fallback for standard deployment
    load_dotenv()

# Rate limiter — keyed by client IP. Protects Gemini endpoints from abuse.
# limiter initialization is shared in kuratormind.api.limiter

app = FastAPI(
    title="KuratorMind AI — Agent API",
    description="Multi-agent forensic backend for Indonesian Kurators",
    version="0.1.0",
)

# Attach limiter to app state so decorators can resolve it
from slowapi import _rate_limit_exceeded_handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://kuratormind-web-198564174902.asia-southeast1.run.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Auth Middleware (Feature-Flagged)
# Set AUTH_ENABLED=true in .env to enforce JWT validation on all API routes.
# Set AUTH_ENABLED=false (default) to allow all requests through (demo / dev mode).
# ---------------------------------------------------------------------------

# Public routes that never require authentication
_AUTH_SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/agents"}

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Optional JWT gate. Enforced only when AUTH_ENABLED=true in .env."""
    auth_enabled = os.getenv("AUTH_ENABLED", "false").lower() == "true"

    # If the flag is off, let everything through — no performance cost
    if not auth_enabled or request.url.path in _AUTH_SKIP_PATHS:
        return await call_next(request)

    # Extract Bearer token
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or malformed Authorization header."},
        )

    token = authorization.removeprefix("Bearer ").strip()
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        # Attach user_id to request state for downstream use
        request.state.user_id = payload.get("sub")
    except jwt.ExpiredSignatureError:
        return JSONResponse(status_code=401, content={"detail": "Token has expired."})
    except jwt.InvalidTokenError as exc:
        return JSONResponse(status_code=401, content={"detail": f"Invalid token: {exc}"})

    return await call_next(request)


@app.middleware("http")
async def log_requests(request, call_next):
    import time
    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logging.info(
            f"{request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.2f}ms"
        )
        return response
    except Exception as exc:
        logging.error(f"CRASH on {request.url.path}: {exc}", exc_info=True)
        from fastapi.responses import JSONResponse  # type: ignore
        return JSONResponse(status_code=500, content={"detail": "Fatal Backend Crash", "error": str(exc)})



@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "kuratormind-agents",
        "version": "0.1.0",
    }


@app.get("/agents")
async def list_agents():
    """List available agents and their capabilities."""
    return {
        "agents": [
            {
                "name": "lead_orchestrator",
                "description": "Coordinates forensic sub-agents for the Kurator",
                "status": "active",
            },
            {
                "name": "claim_auditor",
                "description": "Verifies creditor claims and detects contradictions",
                "status": "active",
            },
            {
                "name": "forensic_ingestor",
                "description": "Processes and structures uploaded documents",
                "status": "active",
            },
            {
                "name": "forensic_accountant",
                "description": "Analyzes financial reports for PSAK compliance",
                "status": "active",
            },
            {
                "name": "regulatory_scholar",
                "description": "Monitors Indonesian legal and accounting updates",
                "status": "active",
            },
            {
                "name": "output_architect",
                "description": "Generates court-ready presentations and spreadsheets",
                "status": "active",
            },
        ]
    }


# Import route modules
from kuratormind.api.routes.chat import router as chat_router  # type: ignore
from kuratormind.api.routes.documents import router as documents_router  # type: ignore
from kuratormind.api.routes.cases import router as cases_router  # type: ignore
from kuratormind.api.routes.claims import router as claims_router  # type: ignore
from kuratormind.api.routes.audit import router as audit_router  # type: ignore
from kuratormind.api.routes.search import router as search_router  # type: ignore

app.include_router(chat_router, prefix="/api/v1", tags=["chat"])
app.include_router(documents_router, prefix="/api/v1", tags=["documents"])
app.include_router(cases_router, prefix="/api/v1", tags=["cases"])
app.include_router(claims_router, prefix="/api/v1", tags=["claims"])
app.include_router(audit_router, prefix="/api/v1", tags=["audit"])
app.include_router(search_router, prefix="/api/v1", tags=["search"])


if __name__ == "__main__":
    import uvicorn  # type: ignore

    uvicorn.run(
        "kuratormind.api.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
        reload_excludes=["*.pyc", ".venv/*", "*.egg-info/*", "__pycache__/*"],
    )
