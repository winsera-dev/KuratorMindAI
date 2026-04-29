"""
KuratorMind AI — Claims API Route

Handles creditor claim management, verification, and forensic audit status.
"""

import logging
import os
from typing import List, Optional, Dict, Any, Annotated
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from supabase import create_client, Client
from kuratormind.api.deps import get_current_user
from kuratormind.services.security import decrypt_pii, calculate_forensic_hash

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
async def list_claims(
    case_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """List all extracted creditor claims for a specific case."""
    try:
        # Validate UUID format to prevent Supabase 22P02 errors
        import uuid
        uuid.UUID(case_id)
        
        sb = _get_supabase()
        
        # Ownership check: verify case belongs to current_user
        case = sb.table("cases").select("user_id").eq("id", case_id).maybe_single().execute()
        if not case.data or case.data.get("user_id") != current_user:
            raise HTTPException(status_code=403, detail="Access denied to this case.")

        result = sb.table("claims")\
            .select("*")\
            .eq("case_id", case_id)\
            .is_("deleted_at", "null")\
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
            
            # Decrypt PII
            row["creditor_name"] = decrypt_pii(row.get("creditor_name"))
            row["creditor_aliases"] = [decrypt_pii(a) for a in row.get("creditor_aliases", [])]
            
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
async def update_claim(
    claim_id: str, 
    updates: ClaimUpdate,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Update a claim's status or details (Kurator manual override)."""
    sb = _get_supabase()
    
    update_data = updates.dict(exclude_unset=True)
    
    # T-17: Track human provenance for auditability
    update_data["created_by"] = current_user
    update_data["verified_by"] = current_user
    
    if update_data.get("status") == "verified":
        update_data["verified_at"] = datetime.now(timezone.utc).isoformat()
    
    try:
        # Verify claim exists and belongs to a case owned by current_user
        existing = sb.table("claims").select("id, case_id, cases(user_id)").eq("id", claim_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Claim not found.")
            
        case_owner = (existing.data.get("cases") or {}).get("user_id")
        if case_owner and case_owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied.")

        result = sb.table("claims")\
            .update(update_data)\
            .eq("id", claim_id)\
            .execute()
            
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update claim.")

        # T-19: Log the forensic update with an integrity hash
        try:
            old_val = {k: existing.data[k] for k in update_data.keys() if k in existing.data}
            claim_hash = calculate_forensic_hash(claim_id, current_user, "updated", old_value=old_val, new_value=update_data)
            sb.table("forensic_audit_log").insert({
                "entity_type": "claim", "entity_id": claim_id, 
                "action": "updated", "actor_type": "user", "actor_id": current_user,
                "old_value": old_val, "new_value": update_data,
                "evidence_hash": claim_hash
            }).execute()
        except Exception as log_exc:
            logger.warning("Forensic logging failed: %s", log_exc)
            
        updated_claim = result.data[0]
        updated_claim["creditor_name"] = decrypt_pii(updated_claim.get("creditor_name"))
        updated_claim["creditor_aliases"] = [decrypt_pii(a) for a in updated_claim.get("creditor_aliases", [])]
        return updated_claim
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update claim failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/claims/verify", response_model=dict)
async def verify_claims_eligibility(
    request: dict,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """
    Run UU 37/2004 bankruptcy eligibility check against all claims in a case.
    Evaluates Article 2 (creditor plurality) and Article 8 (debt maturity/proof).
    """
    from kuratormind.services.compliance import check_bankruptcy_eligibility

    case_id = request.get("case_id")
    if not case_id:
        raise HTTPException(status_code=400, detail="case_id is required.")

    try:
        import uuid as _uuid
        _uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case_id format.")

    sb = _get_supabase()

    GLOBAL_ID = "00000000-0000-0000-0000-000000000000"
    if case_id == GLOBAL_ID:
        raise HTTPException(status_code=400, detail="Cannot verify the global system case.")

    case = sb.table("cases").select("user_id").eq("id", case_id).maybe_single().execute()
    if not case.data or case.data.get("user_id") != current_user:
        raise HTTPException(status_code=403, detail="Access denied to this case.")

    claims_res = sb.table("claims").select("*").eq("case_id", case_id).is_("deleted_at", "null").execute()
    claims = claims_res.data or []

    for c in claims:
        c["creditor_name"] = decrypt_pii(c.get("creditor_name"))

    result = check_bankruptcy_eligibility(claims)
    return {"case_id": case_id, "claim_count": len(claims), **result}


@router.get("/claims/{case_id}/summary", response_model=dict)
async def get_claims_summary(
    case_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Return aggregate claim statistics for a case: totals by type and overall IDR sum."""
    try:
        import uuid as _uuid
        _uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Case ID format.")

    sb = _get_supabase()

    case = sb.table("cases").select("user_id").eq("id", case_id).maybe_single().execute()
    if not case.data or case.data.get("user_id") != current_user:
        raise HTTPException(status_code=403, detail="Access denied to this case.")

    try:
        claims_res = sb.table("claims").select("claim_type, claim_amount, status").eq("case_id", case_id).is_("deleted_at", "null").execute()
        claims = claims_res.data or []

        from decimal import Decimal
        by_type: Dict[str, Dict[str, Any]] = {}
        total_amount = Decimal("0.0")
        for c in claims:
            ctype = c.get("claim_type") or "unknown"
            amount = Decimal(str(c.get("claim_amount") or 0))
            total_amount += amount
            if ctype not in by_type:
                by_type[ctype] = {"count": 0, "total_amount": Decimal("0.0")}
            by_type[ctype]["count"] += 1
            by_type[ctype]["total_amount"] += amount

        by_status: Dict[str, int] = {}
        for c in claims:
            s = c.get("status") or "unknown"
            by_status[s] = by_status.get(s, 0) + 1

        return {
            "case_id": case_id,
            "total_claims": len(claims),
            "total_amount_idr": float(total_amount),
            "by_type": {k: {"count": v["count"], "total_amount": float(v["total_amount"])} for k, v in by_type.items()},
            "by_status": by_status,
        }
    except Exception as exc:
        logger.error("Claims summary failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/claims/{claim_id}", response_model=dict)
async def delete_claim(
    claim_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Soft-delete a claim with forensic audit logging (evidence spoliation prevention)."""
    sb = _get_supabase()
    try:
        existing = sb.table("claims").select("id, case_id, cases(user_id)").eq("id", claim_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Claim not found.")

        case_owner = (existing.data.get("cases") or {}).get("user_id")
        if case_owner and case_owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied.")

        now_str = datetime.now(timezone.utc).isoformat()
        sb.table("claims").update({"deleted_at": now_str}).eq("id", claim_id).execute()

        try:
            h = calculate_forensic_hash(claim_id, current_user, "deleted", new_value={"deleted_at": now_str})
            sb.table("forensic_audit_log").insert({
                "entity_type": "claim", "entity_id": claim_id,
                "action": "deleted", "actor_type": "user", "actor_id": current_user,
                "new_value": {"deleted_at": now_str}, "evidence_hash": h,
            }).execute()
        except Exception as log_exc:
            logger.warning("Forensic logging failed: %s", log_exc)

        return {"success": True, "claim_id": claim_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete claim failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
