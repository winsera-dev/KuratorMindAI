"""
KuratorMind AI — Audit API Route

Handles forensic red flags, logical contradictions, and legal risk monitoring.
"""

import logging
import os
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import create_client, Client

logger = logging.getLogger(__name__)
router = APIRouter()

# ------------------------------------------------------------
# Models
# ------------------------------------------------------------

class AuditFlagBase(BaseModel):
    vault_id: str
    severity: str    # critical, high, medium, low
    flag_type: str   # contradiction, actio_pauliana, entity_duplicate, etc.
    title: str
    description: str
    evidence: Optional[List[Dict[str, Any]]] = []
    legal_reference: Optional[str] = None
    resolution: Optional[str] = None
    resolved: Optional[bool] = False

class AuditFlagUpdate(BaseModel):
    resolved: Optional[bool] = None
    resolution: Optional[str] = None

class AuditFlagResponse(AuditFlagBase):
    id: str
    created_at: str

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

@router.get("/audit/flags/{vault_id}", response_model=dict)
async def list_audit_flags(
    vault_id: str, 
    severity: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None)
):
    """List forensic red flags for a specific vault."""
    sb = _get_supabase()
    query = sb.table("audit_flags").select("*").eq("vault_id", vault_id)
    
    if severity:
        query = query.eq("severity", severity)
    if resolved is not None:
        query = query.eq("resolved", resolved)
        
    try:
        result = query.order("created_at", desc=True).execute()
        flags = result.data if result.data is not None else []
        return {"flags": flags, "count": len(flags)}
    except Exception as exc:
        logger.error("List audit flags failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch("/audit/flags/{flag_id}", response_model=AuditFlagResponse)
async def update_audit_flag(flag_id: str, updates: AuditFlagUpdate):
    """Update flag resolution status or notes."""
    sb = _get_supabase()
    update_data = updates.dict(exclude_unset=True)
    
    try:
        # Verify flag exists
        existing = sb.table("audit_flags").select("id").eq("id", flag_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Audit flag not found.")
            
        result = sb.table("audit_flags")\
            .update(update_data)\
            .eq("id", flag_id)\
            .execute()
            
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update audit flag.")
            
        return result.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update audit flag failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
