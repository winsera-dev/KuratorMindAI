"""
KuratorMind AI — Audit API Route

Handles forensic red flags, logical contradictions, and legal risk monitoring.
"""

import logging
import os
from typing import List, Optional, Dict, Any, Annotated
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from supabase import create_client, Client
from kuratormind.api.deps import get_current_user
from kuratormind.services.security import calculate_forensic_hash

logger = logging.getLogger(__name__)
router = APIRouter()

# ------------------------------------------------------------
# Models
# ------------------------------------------------------------

class AuditFlagBase(BaseModel):
    case_id: str
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

@router.get("/audit/flags/{case_id}", response_model=dict)
async def list_audit_flags(
    case_id: str, 
    current_user: Annotated[str, Depends(get_current_user)],
    severity: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None)
):
    """List forensic red flags for a specific case."""
    sb = _get_supabase()
    
    # System Case Bypass: Always allow the global case for registry visibility
    GLOBAL_ID = "00000000-0000-0000-0000-000000000000"
    
    if case_id == GLOBAL_ID:
        # Always allowed for all Kurators
        pass
    else:
        # Ownership check: verify case belongs to current_user
        case = sb.table("cases").select("user_id").eq("id", case_id).maybe_single().execute()
        if not case.data or case.data.get("user_id") != current_user:
            raise HTTPException(status_code=403, detail="Access denied to this case.")

    query = sb.table("audit_flags").select("*").eq("case_id", case_id).is_("deleted_at", "null")
    
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

@router.get("/audit/flags/{case_id}/summary", response_model=dict)
async def get_audit_flags_summary(
    case_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Return audit flag counts grouped by severity for a case."""
    sb = _get_supabase()

    GLOBAL_ID = "00000000-0000-0000-0000-000000000000"
    if case_id != GLOBAL_ID:
        case = sb.table("cases").select("user_id").eq("id", case_id).maybe_single().execute()
        if not case.data or case.data.get("user_id") != current_user:
            raise HTTPException(status_code=403, detail="Access denied to this case.")

    try:
        result = sb.table("audit_flags").select("severity, flag_type, resolved").eq("case_id", case_id).is_("deleted_at", "null").execute()
        flags = result.data or []

        by_severity: Dict[str, int] = {}
        by_type: Dict[str, int] = {}
        unresolved = 0
        for f in flags:
            sev = f.get("severity") or "unknown"
            ftype = f.get("flag_type") or "unknown"
            by_severity[sev] = by_severity.get(sev, 0) + 1
            by_type[ftype] = by_type.get(ftype, 0) + 1
            if not f.get("resolved"):
                unresolved += 1

        return {
            "case_id": case_id,
            "total_flags": len(flags),
            "unresolved_flags": unresolved,
            "by_severity": by_severity,
            "by_type": by_type,
        }
    except Exception as exc:
        logger.error("Audit flags summary failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/audit/flags/{flag_id}", response_model=dict)
async def delete_audit_flag(
    flag_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Soft-delete an audit flag with forensic audit logging."""
    sb = _get_supabase()
    try:
        existing = sb.table("audit_flags").select("id, case_id, cases(user_id)").eq("id", flag_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Audit flag not found.")

        case_owner = (existing.data[0].get("cases") or {}).get("user_id")
        if case_owner and case_owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied.")

        now_str = datetime.now().isoformat()
        sb.table("audit_flags").update({"deleted_at": now_str}).eq("id", flag_id).execute()

        try:
            h = calculate_forensic_hash(flag_id, current_user, "deleted", new_value={"deleted_at": now_str})
            sb.table("forensic_audit_log").insert({
                "entity_type": "audit_flag", "entity_id": flag_id,
                "action": "deleted", "actor_type": "user", "actor_id": current_user,
                "new_value": {"deleted_at": now_str}, "evidence_hash": h,
            }).execute()
        except Exception as log_exc:
            logger.warning("Forensic logging failed: %s", log_exc)

        return {"success": True, "flag_id": flag_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete audit flag failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/audit/flags/{flag_id}", response_model=AuditFlagResponse)
async def update_audit_flag(
    flag_id: str, 
    updates: AuditFlagUpdate,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Update flag resolution status or notes."""
    sb = _get_supabase()
    update_data = updates.dict(exclude_unset=True)
    update_data["created_by"] = current_user
    
    try:
        # Verify flag exists and belongs to user's case
        existing = sb.table("audit_flags").select("id, case_id, cases(user_id)").eq("id", flag_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Audit flag not found.")
        
        case_owner = (existing.data[0].get("cases") or {}).get("user_id")
        if case_owner and case_owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied.")
            
        result = sb.table("audit_flags")\
            .update(update_data)\
            .eq("id", flag_id)\
            .execute()
            
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update flag.")

        # T-19: Log the forensic update with an integrity hash
        try:
            old_val = {k: existing.data[k] for k in update_data.keys() if k in existing.data}
            flag_hash = calculate_forensic_hash(flag_id, current_user, "updated", old_value=old_val, new_value=update_data)
            sb.table("forensic_audit_log").insert({
                "entity_type": "audit_flag", "entity_id": flag_id, 
                "action": "updated", "actor_type": "user", "actor_id": current_user,
                "old_value": old_val, "new_value": update_data,
                "evidence_hash": flag_hash
            }).execute()
        except Exception as log_exc:
            logger.warning("Forensic logging failed: %s", log_exc)
            
        return result.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update audit flag failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
