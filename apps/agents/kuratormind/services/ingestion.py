"""
KuratorMind AI — Document Ingestion Service

Orchestrates the full pipeline:
1. Download file from Supabase Storage
2. Parse PDF (PyMuPDF) or Excel (openpyxl)
3. Split text into overlapping chunks
4. Embed each chunk via Gemini text-embedding-004
5. Store chunks + embeddings in document_chunks table
6. Mark document as 'ready' with a generated summary
"""

from __future__ import annotations

import io
import logging
import os
import uuid
from typing import Any, Optional, cast

import fitz  # type: ignore  # PyMuPDF
import openpyxl  # type: ignore
from google import genai  # type: ignore
from supabase import create_client, Client  # type: ignore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CHUNK_SIZE = 1500        # characters per chunk
CHUNK_OVERLAP = 200      # characters of overlap between consecutive chunks
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_BATCH_SIZE = 20  # embed this many chunks per API call

# ---------------------------------------------------------------------------
# Supabase singleton (service role — bypasses RLS for background jobs)
# ---------------------------------------------------------------------------

_supabase: Optional[Client] = None


def _get_supabase() -> Client:
    """Return cached Supabase service-role client."""
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _supabase = create_client(url, key)
    return _supabase


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------


def _extract_pdf(file_bytes: bytes) -> list[dict]:
    """
    Extract text from a PDF, page by page.

    Returns:
        List of dicts: {page_number, text}
    """
    pages: list[dict] = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text").strip()
        if text:
            pages.append({"page_number": page_num, "text": text})
    doc.close()
    return pages


def _extract_excel(file_bytes: bytes) -> list[dict]:
    """
    Extract text from an Excel file, sheet by sheet.

    Returns:
        List of dicts: {page_number (sheet index), text}
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    sheets: list[dict] = []
    for sheet_idx, ws in enumerate(wb.worksheets, start=1):
        rows: list[str] = []
        for row in ws.iter_rows(values_only=True):
            row_str = "\t".join(
                str(cell) if cell is not None else "" for cell in row
            )
            if row_str.strip():
                rows.append(row_str)
        if rows:
            sheets.append(
                {
                    "page_number": sheet_idx,
                    "text": f"[Sheet: {ws.title}]\n" + "\n".join(rows),
                }
            )
    wb.close()
    return sheets


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------


def _substr(s: str, start: int, end: int) -> str:
    """Return s[start:end] — uses slice() to satisfy Pyre2's slice type checks."""
    return s.__getitem__(slice(start, end))  # type: ignore[arg-type]


def _chunk_pages(pages: list[dict]) -> list[dict]:
    """
    Split each page's text into overlapping chunks.

    Returns:
        List of dicts: {page_number, chunk_index, section_title, content}
    """
    chunks: list[dict] = []

    for page in pages:
        text: str = str(page["text"])
        start: int = 0
        while start < len(text):
            end: int = min(start + CHUNK_SIZE, len(text))
            content: str = _substr(text, start, end).strip()
            if content:
                chunks.append(
                    {
                        "page_number": page["page_number"],
                        "chunk_index": len(chunks),  # use list length as global index
                        "section_title": None,
                        "content": content,
                    }
                )
            start = end - CHUNK_OVERLAP
            if start <= 0 or end >= len(text):
                break

    return chunks


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------


def _embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Generate Gemini embeddings for each chunk in batches.

    Mutates each chunk dict by adding an 'embedding' key (list[float]).
    Returns the same list for chaining.
    """
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

    for batch_start in range(0, len(chunks), EMBEDDING_BATCH_SIZE):
        batch: list[dict] = cast(list[dict], chunks[batch_start: batch_start + EMBEDDING_BATCH_SIZE])
        texts = [c["content"] for c in batch]

        result = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=texts,
            config=genai.types.EmbedContentConfig(output_dimensionality=768),
        )

        for chunk, embedding_obj in zip(batch, result.embeddings):
            chunk["embedding"] = embedding_obj.values

    return chunks


# ---------------------------------------------------------------------------
# Summary generation
# ---------------------------------------------------------------------------


def _generate_summary(full_text: str, file_name: str) -> str:
    """Generate a 2-3 sentence summary of the document for display."""
    try:
        client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
        snippet: str = full_text[:4000]  # type: ignore[index]  # Pyre2 slice stub bug
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                f"Summarize this document excerpt in 2-3 sentences "
                                f"for an Indonesian insolvency Kurator. "
                                f"Document: {file_name}\n\n{snippet}"
                            )
                        }
                    ],
                }
            ],
        )
        return response.text or "Document processed successfully."
    except Exception as exc:
        logger.warning("Summary generation failed: %s", exc)
        return f"Processed {file_name}."


# ---------------------------------------------------------------------------
# Main ingest function
# ---------------------------------------------------------------------------


def ingest_document(
    document_id: str,
    vault_id: str,
    storage_path: str,
    file_name: str,
    file_type: str,
) -> dict:
    """
    Full ingestion pipeline for a single document.

    Args:
        document_id:  UUID of the vault_documents record.
        vault_id:     UUID of the parent vault.
        storage_path: Path within vault-files Storage bucket.
        file_name:    Original filename (for display + summary).
        file_type:    MIME type string, e.g. 'application/pdf'.

    Returns:
        {success: bool, chunks_created: int, error?: str}
    """
    sb = _get_supabase()
    logger.info("=" * 60)
    logger.info("INGESTION STARTED: %s (%s)", file_name, document_id)
    logger.info("=" * 60)

    # 1. Mark as processing
    sb.table("vault_documents").update({"status": "processing"}).eq(
        "id", document_id
    ).execute()

    try:
        # 2. Download from Supabase Storage
        logger.info("Downloading %s from storage…", storage_path)
        raw = sb.storage.from_("vault-files").download(storage_path)
        file_bytes: bytes = raw if isinstance(raw, bytes) else bytes(raw)

        # 3. Extract text
        is_pdf = "pdf" in file_type.lower() or file_name.lower().endswith(".pdf")
        is_excel = any(
            x in file_type.lower() or file_name.lower().endswith(x)
            for x in ["xlsx", "xls", "spreadsheet", "excel"]
        )

        if is_pdf:
            pages = _extract_pdf(file_bytes)
        elif is_excel:
            pages = _extract_excel(file_bytes)
        else:
            # Fallback: treat as plain text
            pages = [{"page_number": 1, "text": file_bytes.decode("utf-8", errors="replace")}]

        if not pages:
            raise ValueError("No readable text found in document.")

        # 4. Chunk
        chunks = _chunk_pages(pages)
        logger.info("Created %d chunks for document %s", len(chunks), document_id)

        # 5. Embed
        chunks = _embed_chunks(chunks)

        # 6. Collect full text for summary
        full_text: str = "\n\n".join(str(p["text"]) for p in pages)
        page_count = max(p["page_number"] for p in pages)

        # 7. Insert chunks into DB
        rows = [
            {
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "vault_id": vault_id,
                "content": chunk["content"],
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk["page_number"],
                "section_title": chunk["section_title"],
                "embedding": chunk["embedding"],
                "metadata": {},
            }
            for chunk in chunks
        ]

        # Upsert in batches to stay under Supabase payload limits
        BATCH = 50
        for i in range(0, len(rows), BATCH):
            sb.table("document_chunks").insert(
                cast(list[dict], rows[i: i + BATCH])
            ).execute()

        # 8. Generate summary
        summary = _generate_summary(full_text, file_name)

        # 9. Mark document as ready
        sb.table("vault_documents").update(
            {
                "status": "ready",
                "summary": summary,
                "page_count": page_count,
            }
        ).eq("id", document_id).execute()

        logger.info("Ingestion complete for %s (%d chunks)", document_id, len(chunks))
        
        # 10. Trigger Claim Audit (Forensic review)
        _trigger_claim_audit(vault_id, document_id, file_name)
        
        # 11. Trigger Financial Audit (if applicable)
        is_financial = any(x in file_name.lower() for x in ["neraca", "laba rugi", "balance sheet", "p&l", "financial"])
        if is_financial:
            _trigger_financial_audit(vault_id, document_id, file_name)

        return {"success": True, "chunks_created": len(chunks)}

    except Exception as exc:
        logger.error("Ingestion failed for %s: %s", document_id, exc, exc_info=True)
        sb.table("vault_documents").update(
            {"status": "error", "summary": str(exc)}
        ).eq("id", document_id).execute()
        return {"success": False, "chunks_created": 0, "error": str(exc)}


def _trigger_claim_audit(vault_id: str, document_id: str, file_name: str):
    """
    Submits a background task for the Claim Auditor to review the new document.
    """
    from kuratormind.agents.claim_auditor.agent import claim_auditor # type: ignore
    
    logger.info("Triggering automatic claim audit for: %s", file_name)
    
    # We use a summarized prompt to keep it efficient.
    # The auditor will use its tools (semantic_search, upsert_claim, etc.)
    prompt = (
        f"A new document '{file_name}' (ID: {document_id}) was just indexed in vault '{vault_id}'. "
        "Review this document immediately. If it contains creditor names, claim amounts, or bank transactions, "
        "cross-reference them with existing data and update the 'claims' and 'audit_flags' tables. "
        "Focus on finding any contradictions or discrepancies."
    )
    
    try:
        # In a real production environment, this should be offloaded to a task queue (Celery/Cloud Tasks).
        # For this implementation, we run it synchronously but catching errors to not block the ingestion return.
        # Note: claim_auditor will autonomously use semantic_search to find context.
        # We pass vault_id in the prompt so the agent knows which context to search.
        result = claim_auditor.run(prompt)
        logger.info("Automatic audit completed for %s: %s", file_name, result.text[:100] + "...")
    except Exception as e:
        logger.error("Automatic audit failed for %s: %s", file_name, e)

def _trigger_financial_audit(vault_id: str, document_id: str, file_name: str):
    """
    Submits a background task for the Forensic Accountant to analyze the new financial document.
    """
    from kuratormind.agents.forensic_accountant.agent import forensic_accountant # type: ignore
    
    logger.info("Triggering automatic financial audit for: %s", file_name)
    
    prompt = (
        f"A new financial document '{file_name}' (ID: {document_id}) was just indexed in vault '{vault_id}'. "
        "Perform a full forensic accounting analysis. Extract key line items, calculate ratios, "
        "and check for Double-Entry balance or any PSAK non-compliance. "
        "Log any red flags found."
    )
    
    try:
        # Running synchronously for the demo, but catching errors.
        result = forensic_accountant.run(prompt)
        logger.info("Automatic financial audit completed for %s: %s", file_name, result.text[:100] + "...")
    except Exception as e:
        logger.error("Automatic financial audit failed for %s: %s", file_name, e)
