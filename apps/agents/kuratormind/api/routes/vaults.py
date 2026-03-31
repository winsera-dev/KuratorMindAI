"""
KuratorMind AI — Vaults API Route

Handles forensic case (vault) lifecycle management.
"""

import logging
import os
import uuid
from typing import List, Optional
from datetime import date

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
    bankruptcy_date: Optional[date] = None
    stage: Optional[str] = "pkpu_temp"

class VaultCreate(VaultBase):
    user_id: str

class VaultResponse(VaultBase):
    id: str
    user_id: str
    status: str
    created_at: str
    updated_at: str

class VaultStats(BaseModel):
    document_count: int = 0
    total_claims_idr: float = 0.0
    flag_count: int = 0

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
