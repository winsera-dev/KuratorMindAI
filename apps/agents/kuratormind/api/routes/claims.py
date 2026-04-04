"""
KuratorMind AI — Claims API Route

Handles creditor claim management, verification, and forensic audit status.
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

class ClaimBase(BaseModel):
    creditor_name: str
    creditor_aliases: Optional[List[str]] = None
    claim_amount: Optional[float] = None
    adjusted_amount: Optional[float] = None
    currency: Optional[str] = "IDR"
    claim_type: Optional[str] = None  # preferential, secured, concurrent
    collateral_description: Optional[str] = None
    priority_rank: Optional[int] = None
    status: Optional[str] = "pending"         # pending, verified, disputed, rejected
    confidence_score: Optional[float] = None
    legal_basis: Optional[str] = None
    rejection_reason: Optional[str] = None
    flags: Optional[List[str]] = None
    notes: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[str] = None

class ClaimUpdate(BaseModel):
    status: Optional[str] = None
    adjusted_amount: Optional[float] = None
    claim_type: Optional[str] = None
    notes: Optional[str] = None
    verified_by: Optional[str] = None
    collateral_description: Optional[str] = None

class ClaimResponse(ClaimBase):
    id: str
    case_id: str
    supporting_documents: Optional[List[str]] = []
    contradicting_evidence: Optional[List[Dict[str, Any]]] = []
    metadata: Optional[Dict[str, Any]] = {}
    created_at: str
    updated_at: str

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

@router.get("/claims/{case_id}", response_model=dict)
async def list_claims(case_id: str):
    """List all extracted creditor claims for a specific case."""
    try:
        # Validate UUID format to prevent Supabase 22P02 errors
        import uuid
        uuid.UUID(case_id)
        
        sb = _get_supabase()
        result = sb.table("claims")\
            .select("*")\
            .eq("case_id", case_id)\
            .order("creditor_name")\
            .execute()
        
        # Ensure numeric values are float-serializable
        claims = []
        data = result.data if result.data is not None else []
        for row in data:
            # Handle potential Decimal objects from NUMERIC columns
            if row.get("claim_amount") is not None:
                row["claim_amount"] = float(row["claim_amount"])
            if row.get("adjusted_amount") is not None:
                row["adjusted_amount"] = float(row["adjusted_amount"])
            if row.get("confidence_score") is not None:
                row["confidence_score"] = float(row["confidence_score"])
            claims.append(row)
            
        return {"claims": claims, "count": len(claims)}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Case ID format.")
    except Exception as exc:
        logger.error("List claims failed: %s", exc, exc_info=True)
        # Check for specific supabase/postgrest errors
        detail = str(exc)
        if "P02" in detail:
            raise HTTPException(status_code=400, detail="Invalid data format provided to database.")
        raise HTTPException(status_code=500, detail=detail)

@router.patch("/claims/{claim_id}", response_model=ClaimResponse)
async def update_claim(claim_id: str, updates: ClaimUpdate):
    """Update a claim's status or details (Kurator manual override)."""
    sb = _get_supabase()
    
    update_data = updates.dict(exclude_unset=True)
    if update_data.get("status") == "verified":
        update_data["verified_at"] = datetime.now().isoformat()
    
    try:
        # Verify claim exists
        existing = sb.table("claims").select("id").eq("id", claim_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Claim not found.")
            
        result = sb.table("claims")\
            .update(update_data)\
            .eq("id", claim_id)\
            .execute()
            
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update claim.")
            
        return result.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update claim failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
