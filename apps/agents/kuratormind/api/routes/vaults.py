"""
KuratorMind AI — Vaults API Route

Handles forensic case (vault) lifecycle management.
"""

import logging
import os
import uuid
from datetime import date
from typing import List, Optional, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import create_client, Client

logger = logging.getLogger(__name__)
router = APIRouter()

# ------------------------------------------------------------
# Models
# ------------------------------------------------------------

class VaultBase(BaseModel):
    name: str
    description: Optional[str] = None
    debtor_entity: Optional[str] = None
    case_number: Optional[str] = None
    court_name: Optional[str] = None
    bankruptcy_date: Optional[Any] = None
    stage_started_at: Optional[Any] = None
    stage: Optional[str] = "pkpu_temp"

class VaultCreate(VaultBase):
    user_id: str

class VaultResponse(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    debtor_entity: Optional[str] = None
    case_number: Optional[str] = None
    court_name: Optional[str] = None
    bankruptcy_date: Optional[Any] = None
    stage_started_at: Optional[Any] = None
    stage: Optional[str] = None
    user_id: Optional[str] = None
    status: Optional[str] = "active"
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

class VaultStats(BaseModel):
    document_count: int = 0
    total_claims_idr: float = 0.0
    flag_count: int = 0

class SyncRequest(BaseModel):
    keywords: List[str] = ["kepailitan", "PKPU", "PSAK 71", "PSAK 73"]
    force: bool = False

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def _get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)

# ------------------------------------------------------------
# Routes
# ------------------------------------------------------------

@router.get("/vaults", response_model=dict)
async def list_vaults(user_id: Optional[str] = Query(None)):
    """List all vaults for a specific user."""
    sb = _get_supabase()
    query = sb.table("vaults").select("*")
    
    if user_id:
        query = query.eq("user_id", user_id)
    
    try:
        result = query.order("updated_at", desc=True).execute()
        return {"vaults": result.data, "count": len(result.data)}
    except Exception as exc:
        logger.error("List vaults failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/vaults", response_model=VaultResponse)
async def create_vault(vault: VaultCreate):
    """Create a new forensic vault."""
    sb = _get_supabase()
    
    vault_data = vault.dict()
    # Pydantic date to string for JSON serialization
    if vault_data.get("bankruptcy_date"):
        vault_data["bankruptcy_date"] = vault_data["bankruptcy_date"].isoformat()
    if vault_data.get("stage_started_at"):
        vault_data["stage_started_at"] = vault_data["stage_started_at"].isoformat()
        
    try:
        result = sb.table("vaults").insert(vault_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create vault record.")
        return result.data[0]
    except Exception as exc:
        logger.error("Create vault failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/vaults/{vault_id}/stats", response_model=VaultStats)
async def get_vault_stats(vault_id: str):
    """Get aggregated metrics for a specific vault."""
    sb = _get_supabase()
    try:
        # 1. Document Count
        docs = sb.table("vault_documents").select("id", count="exact").eq("vault_id", vault_id).execute()
        doc_count = docs.count if docs.count is not None else 0

        # 2. Total Claims Sum
        claims = sb.table("claims").select("claim_amount").eq("vault_id", vault_id).execute()
        total_claims = sum(float(c["claim_amount"] or 0) for c in claims.data)

        # 3. Flag Count (Unresolved)
        flags = sb.table("audit_flags").select("id", count="exact").eq("vault_id", vault_id).eq("resolved", False).execute()
        flag_count = flags.count if flags.count is not None else 0

        return VaultStats(
            document_count=doc_count,
            total_claims_idr=total_claims,
            flag_count=flag_count
        )
    except Exception as exc:
        logger.error("Get vault stats failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
@router.patch("/vaults/{vault_id}", response_model=VaultResponse)
async def update_vault(vault_id: str, updates: dict):
    """Update vault metadata (e.g. stage transition)."""
    sb = _get_supabase()
    
    # Handle date serialization if present in updates
    # Ensure they are valid ISO strings for Postgres
    for key in ["bankruptcy_date", "stage_started_at"]:
        if key in updates and updates[key]:
            val = updates[key]
            # Convert simple date 'YYYY-MM-DD' to 'YYYY-MM-DD 00:00:00' for timestamp compatibility
            if isinstance(val, str) and len(val) == 10:
                updates[key] = f"{val} 00:00:00"

    try:
        logger.info(f"Updating vault {vault_id} with: {updates}")
        result = sb.table("vaults").update(updates).eq("id", vault_id).execute()
        
        if not result.data or len(result.data) == 0:
            logger.error(f"Vault {vault_id} not found during update")
            raise HTTPException(status_code=404, detail="Vault not found")
            
        return result.data[0]
    except Exception as exc:
        logger.error("Update vault failed: %s", exc, exc_info=True)
        # Check for specific DB errors in the exception string
        err_msg = str(exc)
        if "invalid input syntax" in err_msg.lower():
            raise HTTPException(status_code=400, detail=f"Invalid data format: {err_msg}")
        raise HTTPException(status_code=500, detail=err_msg)

@router.post("/vaults/sync-regulations", response_model=dict)
async def trigger_regulation_sync(request: SyncRequest):
    """Trigger the Regulatory Scholar's grounding sync process."""
    from kuratormind.tools.supabase_tools import sync_legal_knowledge
    
    try:
        result = sync_legal_knowledge(keywords=request.keywords, force=request.force)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Sync regulations failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/vaults/{vault_id}", response_model=VaultResponse)
async def get_vault(vault_id: str):
    """Fetch a single forensic vault by ID."""
    sb = _get_supabase()
    try:
        # Use simple select and check data length to avoid maybe_single() version issues
        result = sb.table("vaults").select("*").eq("id", vault_id).execute()
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Vault not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get vault failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
