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

# Configure logging to show INFO-level messages from our services
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore

# Load environment variables
# Look for .env in apps/agents/
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(base_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    # Fallback for standard deployment
    load_dotenv()

app = FastAPI(
    title="KuratorMind AI — Agent API",
    description="Multi-agent forensic backend for Indonesian Kurators",
    version="0.1.0",
)

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
from kuratormind.api.routes.vaults import router as vaults_router  # type: ignore
from kuratormind.api.routes.claims import router as claims_router  # type: ignore
from kuratormind.api.routes.audit import router as audit_router  # type: ignore
from kuratormind.api.routes.search import router as search_router  # type: ignore

app.include_router(chat_router, prefix="/api/v1", tags=["chat"])
app.include_router(documents_router, prefix="/api/v1", tags=["documents"])
app.include_router(vaults_router, prefix="/api/v1", tags=["vaults"])
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
