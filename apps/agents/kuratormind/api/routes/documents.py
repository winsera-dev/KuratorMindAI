"""
KuratorMind AI — Documents API Route

Handles file upload to Supabase Storage and document record management.
Triggers background ingestion after a successful upload.
"""

import logging
import os
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from supabase import create_client, Client

from kuratormind.services.ingestion import ingest_document

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "image/png",
    "image/jpeg",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


@router.post("/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    case_id: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
):
    """
    Upload a document to a case.

    1. Validate file type + size
    2. Upload to Supabase Storage (case-files/{case_id}/{doc_id}/{filename})
    3. Insert a case_documents record (status: pending)
    4. Schedule background ingestion task
    5. Return the new document record immediately
    """
    # Validate content type
    content_type = file.content_type or ""
    file_name = file.filename or "unknown"

    # Read file into memory for size check
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit.")

    # Determine file_type for storage
    ext = file_name.rsplit(".", 1)[-1].lower()
    if content_type not in ALLOWED_TYPES and ext not in {"pdf", "xlsx", "xls", "csv", "png", "jpg", "jpeg"}:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF, Excel, CSV, images.",
        )

    # Infer correct MIME from extension when browser sends generic/empty type
    MIME_MAP = {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls": "application/vnd.ms-excel",
        "csv": "text/csv",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }
    if not content_type or content_type == "application/octet-stream":
        content_type = MIME_MAP.get(ext, "application/pdf")

    import re
    sb = _get_supabase()
    document_id = str(uuid.uuid4())
    # Supabase Storage rejects keys with spaces/special chars — keep only safe chars
    safe_name = re.sub(r"[^\w.\-]", "_", file_name, flags=re.ASCII)
    file_path = f"{case_id}/{document_id}/{safe_name}"

    try:
        # Upload to Supabase Storage
        sb.storage.from_("case-files").upload(
            path=file_path,
            file=file_bytes,
            file_options={"content-type": content_type},
        )
    except Exception as exc:
        logger.error("Storage upload failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {exc}")

    # Insert case_documents record
    doc_record = {
        "id": document_id,
        "case_id": case_id,
        "file_name": file_name,
        "file_type": content_type or ext,
        "file_path": file_path,
        "file_size": len(file_bytes),
        "status": "pending",
        "page_count": None,
        "summary": None,
        "metadata": {},
    }

    try:
        result = sb.table("case_documents").insert(doc_record).execute()
        inserted = result.data[0] if result.data else doc_record
    except Exception as exc:
        logger.error("DB insert failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database insert failed: {exc}")

    # Schedule background ingestion (non-blocking)
    background_tasks.add_task(
        ingest_document,
        document_id=document_id,
        case_id=case_id,
        storage_path=file_path,
        file_name=file_name,
        file_type=content_type or ext,
    )

    return {
        "message": "Upload successful. Ingestion started in background.",
        "document": inserted,
    }


@router.get("/documents/{case_id}")
async def list_documents(case_id: str):
    """
    List all documents in a case, ordered by upload date.
    
    Returns document metadata. Check 'status' for ingestion progress:
    - pending: Upload received, ingestion not yet started
    - processing: Chunking + embedding in progress
    - ready: Fully indexed, available for semantic search
    - error: Ingestion failed (see summary for reason)
    """
    sb = _get_supabase()
    try:
        result = (
            sb.table("case_documents")
            .select(
                "id, file_name, file_type, status, summary, page_count, "
                "file_path, file_size, metadata, created_at"
            )
            .eq("case_id", case_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"documents": result.data, "count": len(result.data)}
    except Exception as exc:
        logger.error("List documents failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document and all its chunks from the case."""
    sb = _get_supabase()
    try:
        # Fetch the document first for storage path
        doc = (
            sb.table("case_documents")
            .select("file_path, case_id")
            .eq("id", document_id)
            .single()
            .execute()
        )
        if not doc.data:
            raise HTTPException(status_code=404, detail="Document not found.")

        storage_path = doc.data.get("file_path")
        case_id = doc.data.get("case_id")

        # Delete chunks
        sb.table("document_chunks").delete().eq("document_id", document_id).execute()

        # Delete derived findings (Claims and Audit Flags)
        try:
            # 1. Robust Cleanup for Claims
            # We fetch IDs first to ensure we catch all matches in the JSONB metadata
            claims_to_del = sb.table("claims").select("id").eq("metadata->>source_document_id", document_id).execute()
            for c in claims_to_del.data:
                sb.table("claims").delete().eq("id", c["id"]).execute()
            
            # 2. Robust Cleanup for Audit Flags
            # We fetch all flags for the case and manually filter in Python to be 100% sure
            if case_id:
                flags_res = sb.table("audit_flags").select("id, evidence").eq("case_id", case_id).execute()
                for f in flags_res.data:
                    evidence = f.get("evidence") or []
                    # Check if any evidence item links to this document
                    is_linked = any(
                        isinstance(e, dict) and e.get("source_document_id") == document_id 
                        for e in evidence
                    )
                    if is_linked:
                        sb.table("audit_flags").delete().eq("id", f["id"]).execute()
            
            logger.info("Systemic cleanup complete for document %s", document_id)
        except Exception as cleanup_exc:
            logger.warning("Systemic cleanup failed: %s", cleanup_exc)

        # Delete from storage
        if storage_path:
            try:
                sb.storage.from_("case-files").remove([storage_path])
            except Exception as exc_storage:
                logger.warning("Storage deletion failed (continuing): %s", exc_storage)

        # Delete the document record
        sb.table("case_documents").delete().eq("id", document_id).execute()

        return {"success": True, "deleted_document_id": document_id}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete document failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
@router.get("/documents/{document_id}/signed-url")
async def get_document_signed_url(document_id: str, expires_in: int = 3600):
    """
    Generate a signed URL for a document.
    Defaults to 1 hour expiration.
    Used for viewing documents in the frontend side-drawer.
    """
    sb = _get_supabase()
    try:
        # Fetch the document record for the storage path
        doc = (
            sb.table("case_documents")
            .select("file_path, file_name, file_type")
            .eq("id", document_id)
            .single()
            .execute()
        )
        if not doc.data:
            raise HTTPException(status_code=404, detail="Document not found.")

        file_path = doc.data.get("file_path")
        if not file_path:
            raise HTTPException(status_code=400, detail="Document has no file path.")

        # Generate signed URL (public bucket)
        res = sb.storage.from_("case-files").create_signed_url(
            path=file_path,
            expires_in=expires_in
        )
        
        # Signed URL may be a dict or a string depending on client version
        signed_url = res.get("signedURL") if isinstance(res, dict) else res
        
        return {
            "signed_url": signed_url,
            "file_name": doc.data.get("file_name"),
            "file_type": doc.data.get("file_type"),
            "expires_in": expires_in
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Signed URL generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
