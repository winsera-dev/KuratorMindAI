"""
KuratorMind AI — Cases API Route

Handles forensic case (case) lifecycle management.
All routes are protected by Supabase JWT authentication.
"""

import logging
import os
import uuid
import re
from datetime import date
from typing import List, Optional, Any, Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import create_client, Client
from kuratormind.api.deps import get_current_user
from kuratormind.services.security import encrypt_pii, decrypt_pii

logger = logging.getLogger(__name__)
router = APIRouter()

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def _validate_case_number(case_number: str):
    """
    Standard Indonesian Commercial Court format: [No]/Pdt.Sus-[Type]/[Year]/PN [Court]
    Example: 15/Pdt.Sus-PKPU/2024/PN Niaga Jkt.Pst
    """
    if not case_number:
        return

    pattern = r"^[0-9]+/Pdt\.Sus-(PKPU|Pailit)/[0-9]{4}/PN .+$"
    if not re.match(pattern, case_number):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid case number format: '{case_number}'. "
                "Must follow court standards, e.g., '15/Pdt.Sus-PKPU/2024/PN Niaga Jkt.Pst'."
            )
        )

class CaseBase(BaseModel):
    name: str
    description: Optional[str] = None
    debtor_entity: Optional[str] = None
    case_number: Optional[str] = None
    court_name: Optional[str] = None
    stage_started_at: Optional[Any] = None
    stage: Optional[str] = "pkpu_temp"

class CaseCreate(CaseBase):
    user_id: str

class CaseResponse(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    debtor_entity: Optional[str] = None
    case_number: Optional[str] = None
    court_name: Optional[str] = None
    stage_started_at: Optional[Any] = None
    stage: Optional[str] = None
    user_id: Optional[str] = None
    status: Optional[str] = "active"
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

class CaseStats(BaseModel):
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

@router.get("/cases", response_model=dict)
async def list_cases(
    current_user: Annotated[str, Depends(get_current_user)],
):
    """List all cases for the authenticated user."""
    auth_enabled = os.environ.get("AUTH_ENABLED", "false").lower() == "true"
    
    try:
        sb = _get_supabase()
        query = sb.table("cases").select("*")
        
        if not auth_enabled:
            # In dev mode, show cases owned by dev_user OR orphaned cases (NULL user_id)
            query = query.or_(f"user_id.eq.{current_user},user_id.is.null")
        else:
            query = query.eq("user_id", current_user)
            
        result = query.order("updated_at", desc=True).execute()
        cases = result.data or []
        for c in cases:
            c["debtor_entity"] = decrypt_pii(c.get("debtor_entity"))
            
        return {"cases": cases, "count": len(cases)}
    except Exception as exc:
        logger.error("List cases failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/cases", response_model=CaseResponse)
async def create_case(
    case: CaseCreate,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Create a new forensic case. user_id is always derived from the verified JWT."""
    sb = _get_supabase()

    case_data = case.dict()
    # Always override user_id with the authenticated user — never trust client-supplied value
    case_data["user_id"] = current_user

    # TC-CASE-12: Enforce Regex for court case number
    if case_data.get("case_number"):
        _validate_case_number(case_data["case_number"])

    # 2. Encrypt PII
    if case_data.get("debtor_entity"):
        case_data["debtor_entity"] = encrypt_pii(case_data["debtor_entity"])

    # Pydantic date to string for JSON serialization
    if case_data.get("stage_started_at"):
        val = case_data["stage_started_at"]
        if hasattr(val, "isoformat"):
            case_data["stage_started_at"] = val.isoformat()

    # TC-CASE-10: Duplicate case_number guard — only if case_number is provided
    if case_data.get("case_number"):
        dup_check = (
            sb.table("cases")
            .select("id")
            .eq("user_id", current_user)
            .eq("case_number", case_data["case_number"])
            .limit(1)
            .execute()
        )
        if dup_check.data:
            raise HTTPException(
                status_code=409,
                detail=f"A case with number '{case_data['case_number']}' already exists in your vault.",
            )

    try:
        result = sb.table("cases").insert(case_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create case record.")
        
        created_case = result.data[0]
        created_case["debtor_entity"] = decrypt_pii(created_case.get("debtor_entity"))
        return created_case
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Create case failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/cases/{case_id}/stats", response_model=CaseStats)
async def get_case_stats(
    case_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Get aggregated metrics for a specific case."""
    sb = _get_supabase()
    try:
        # System Case Bypass: Always allow the global case stats
        GLOBAL_ID = "00000000-0000-0000-0000-000000000000"
        
        # 1. Document Count
        docs = sb.table("case_documents").select("id", count="exact").eq("case_id", case_id).execute()
        doc_count = docs.count if docs.count is not None else 0

        # 2. Total Claims Sum
        claims = sb.table("claims").select("claim_amount").eq("case_id", case_id).execute()
        total_claims = sum(float(c["claim_amount"] or 0) for c in claims.data)

        # 3. Flag Count (Unresolved)
        flags = sb.table("audit_flags").select("id", count="exact").eq("case_id", case_id).eq("resolved", False).execute()
        flag_count = flags.count if flags.count is not None else 0

        return CaseStats(
            document_count=doc_count,
            total_claims_idr=total_claims,
            flag_count=flag_count
        )
    except Exception as exc:
        logger.error("Get case stats failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
@router.patch("/cases/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: str,
    updates: dict,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Update case metadata (e.g. stage transition)."""
    sb = _get_supabase()
    
    from datetime import datetime
    
    # TC-CASE-12: Enforce Regex for court case number if provided
    if updates.get("case_number"):
        _validate_case_number(updates["case_number"])

    # 1. Encrypt PII if provided
    if "debtor_entity" in updates:
        updates["debtor_entity"] = encrypt_pii(updates["debtor_entity"])

    # Auto-enforcement: if stage is being changed, update stage_started_at
    if "stage" in updates and "stage_started_at" not in updates:
        updates["stage_started_at"] = datetime.utcnow().isoformat()
    
    # Handle date serialization if present in updates
    # Ensure they are valid ISO strings for Postgres
    for key in ["stage_started_at"]:
        if key in updates and updates[key]:
            val = updates[key]
            # Convert simple date 'YYYY-MM-DD' to 'YYYY-MM-DD 00:00:00' for timestamp compatibility
            if isinstance(val, str) and len(val) == 10:
                updates[key] = f"{val} 00:00:00"

    # Gap 14: Optimistic Locking (Strict Forensic Concurrency)
    if "expected_updated_at" not in updates:
        logger.warning(f"Metadata update without token for case {case_id}")
        raise HTTPException(
            status_code=428, # Precondition Required
            detail="Forensic Token Missing: A version token (expected_updated_at) is required to ensure data integrity."
        )

    expected = updates.pop("expected_updated_at")
    
    # Fetch current record to verify timestamp
    current = sb.table("cases").select("updated_at").eq("id", case_id).maybe_single().execute()
    if current.data:
        actual = current.data.get("updated_at")
        # Simple string comparison for ISO timestamps (standardized by Supabase)
        if actual and expected and actual != expected:
            logger.warning(f"Concurrency conflict for case {case_id}: Actual {actual} != Expected {expected}")
            raise HTTPException(
                status_code=412, 
                detail="Forensic Conflict: This case has been modified by another Kurator. Please refresh your workspace to avoid data overlapping."
            )

    try:
        logger.info(f"Updating case {case_id} with: {updates}")
        result = sb.table("cases").update(updates).eq("id", case_id).execute()
        
        if not result.data or len(result.data) == 0:
            logger.error(f"Case {case_id} not found during update")
            raise HTTPException(status_code=404, detail="Case not found")
            
        updated_case = result.data[0]
        updated_case["debtor_entity"] = decrypt_pii(updated_case.get("debtor_entity"))
        return updated_case
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update case failed: %s", exc, exc_info=True)
        # Check for specific DB errors in the exception string
        err_msg = str(exc)
        if "invalid input syntax" in err_msg.lower():
            raise HTTPException(status_code=400, detail=f"Invalid data format: {err_msg}")
        raise HTTPException(status_code=500, detail=err_msg)

@router.post("/cases/sync-regulations", response_model=dict)
async def trigger_regulation_sync(
    request: SyncRequest,
    current_user: Annotated[str, Depends(get_current_user)],
):
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

@router.get("/cases/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Fetch a single forensic case — only if it belongs to the authenticated user."""
    auth_enabled = os.environ.get("AUTH_ENABLED", "false").lower() == "true"
    sb = _get_supabase()
    
    try:
        # System Case Bypass: Allow access to the Global Legal Case ID for everyone
        GLOBAL_ID = "00000000-0000-0000-0000-000000000000"
        
        query = sb.table("cases").select("*").eq("id", case_id)
        
        if case_id == GLOBAL_ID:
            # Always allow the global case
            pass
        elif not auth_enabled:
            # In dev mode, allow access if owned by dev_user OR orphaned
            query = query.or_(f"user_id.eq.{current_user},user_id.is.null")
        else:
            query = query.eq("user_id", current_user)
            
        result = query.execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Case not found")
        
        found_case = result.data[0]
        found_case["debtor_entity"] = decrypt_pii(found_case.get("debtor_entity"))
        return found_case
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get case failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

@router.delete("/cases/{case_id}")
async def delete_case(
    case_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """Delete a forensic case — only if it belongs to the authenticated user."""
    sb = _get_supabase()
    try:
        # Ownership check
        case = sb.table("cases").select("user_id").eq("id", case_id).maybe_single().execute()
        if not case.data or case.data.get("user_id") != current_user:
            raise HTTPException(status_code=404, detail="Case not found")
            
        result = sb.table("cases").delete().eq("id", case_id).execute()
        return {"success": True, "message": "Case deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete case failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
