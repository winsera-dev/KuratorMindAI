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
    Automatically triggers Gemini Vision OCR for scanned pages.

    Returns:
        List of dicts: {page_number, text}
    """
    pages: list[dict] = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    
    # TC-DOC-07: Guard against password protected files
    if doc.is_encrypted:
        doc.close()
        logger.error("Attempted to ingest encrypted PDF.")
        raise ValueError("Document is password protected. Please remove protection before uploading.")

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text").strip()
        
        # Heuristic: If less than 100 chars, it's likely a scan or image-only page
        if len(text) < 100:
            logger.info(f"Page {page_num} appears to be a scan (chars: {len(text)}). Triggering Vision OCR...")
            
            # Convert page to image
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # 2x zoom for better OCR
            img_bytes = pix.tobytes("png")
            
            try:
                # Prompt optimized for Indonesian legal context + quality scoring
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[
                        "Extract all text from this Indonesian legal document page. "
                        "Preserve table structures using markdown format if present. "
                        "Focus on names, dates, and currency amounts (IDR/USD). "
                        "Crucially, provide a 'quality_score' from 0.0 to 1.0 (1.0 = crystal clear, 0.0 = unreadable) "
                        "based on handwriting legibility or scan blurriness.",
                        genai.types.Part.from_bytes(data=img_bytes, mime_type="image/png")
                    ]
                )
                text = response.text or ""
                
                # Heuristic parsing of quality score if LLM provides it, else default 0.8
                # In a real scenario, we'd use response.candidates[0].content for structured output
                quality_guess = 0.8
                if "quality_score" in text.lower():
                    # Quick extraction of numeric score (rough fallback)
                    try:
                        import re
                        scores = re.findall(r"0\.\d+", text)
                        if scores:
                            quality_guess = float(scores[0])
                    except:
                        pass
                
                logger.info(f"Vision OCR successful for page {page_num} (Quality: {quality_guess})")
                
                # Tag page with metadata for low confidence
                page_meta = {"low_confidence": quality_guess < 0.7, "ocr_quality": quality_guess}
            except Exception as e:
                logger.error(f"Vision OCR failed for page {page_num}: {e}")
                page_meta = {"low_confidence": True, "error": str(e)}
        else:
            page_meta = {"low_confidence": False, "ocr_quality": 1.0}
        
        if text:
            pages.append({
                "page_number": page_num, 
                "text": text,
                "metadata": page_meta
            })
            
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
            model="gemini-2.0-flash",
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
    case_id: str,
    storage_path: str,
    file_name: str,
    file_type: str,
) -> dict:
    """
    Full ingestion pipeline for a single document.

    Args:
        document_id:  UUID of the case_documents record.
        case_id:     UUID of the parent case.
        storage_path: Path within case-files Storage bucket.
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
    sb.table("case_documents").update({"status": "processing"}).eq(
        "id", document_id
    ).execute()

    try:
        # 2. Download from Supabase Storage
        logger.info("Downloading %s from storage…", storage_path)
        raw = sb.storage.from_("case-files").download(storage_path)
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
        rows = []
        for chunk in chunks:
            # Find matching page metadata
            page_meta = next((p["metadata"] for p in pages if p["page_number"] == chunk["page_number"]), {})
            
            rows.append({
                "id": str(uuid.uuid4()),
                "document_id": document_id,
                "case_id": case_id,
                "content": chunk["content"],
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk["page_number"],
                "section_title": chunk["section_title"],
                "embedding": chunk["embedding"],
                "metadata": page_meta, # Attach OCR confidence to chunk metadata
            })

        # Upsert in batches to stay under Supabase payload limits
        BATCH = 50
        for i in range(0, len(rows), BATCH):
            sb.table("document_chunks").insert(
                cast(list[dict], rows[i: i + BATCH])
            ).execute()

        # 8. Generate summary
        summary = _generate_summary(full_text, file_name)

        # 9. Update status to processing for Audit phase
        # Gap 15: Flag document globally if any page is low confidence
        document_is_low_quality = any(p.get("metadata", {}).get("low_confidence") for p in pages)
        
        sb.table("case_documents").update(
            {
                "status": "processing",
                "summary": "Analysing document for forensic claims and audit flags...",
                "page_count": page_count,
                "metadata": {"low_confidence": document_is_low_quality}
            }
        ).eq("id", document_id).execute()

        logger.info("Starting forensic phase for %s", document_id)
        
        # 10. Trigger Claim Audit (Forensic review)
        try:
            _trigger_claim_audit(case_id, document_id, file_name)
        except Exception as e:
            logger.error("Claim audit failed: %s", e)
        
        # 11. Trigger Financial Audit (if applicable)
        is_financial = any(x in file_name.lower() for x in ["neraca", "laba rugi", "balance sheet", "p&l", "financial"])
        if is_financial:
            try:
                _trigger_financial_audit(case_id, document_id, file_name)
            except Exception as e:
                logger.error("Financial audit failed: %s", e)

        # 12. Finalize status to ready
        sb.table("case_documents").update(
            {
                "status": "ready",
                "summary": summary,
            }
        ).eq("id", document_id).execute()

        return {"success": True, "chunks_created": len(chunks)}

    except Exception as exc:
        logger.error("Ingestion failed for %s: %s", document_id, exc, exc_info=True)
        sb.table("case_documents").update(
            {"status": "error", "summary": str(exc)}
        ).eq("id", document_id).execute()
        return {"success": False, "chunks_created": 0, "error": str(exc)}


def _trigger_claim_audit(case_id: str, document_id: str, file_name: str):
    """
    Triggers the forensic claim audit using direct GenAI client.
    """
    from kuratormind.agents.claim_auditor.agent import CLAIM_AUDITOR_INSTRUCTION
    from kuratormind.tools.supabase_tools import semantic_search, upsert_claim_record, create_audit_flag
    
    logger.info("Triggering forensic claim audit for: %s", file_name)
    
    # 1. Fetch context using semantic search
    context_res = semantic_search(case_id, f"creditor claims and debt details in {file_name}", top_k=15)
    chunks = context_res.get("results", [])
    context_text = "\n".join([f"SOURCE: {c.get('content')}" for c in chunks])

    # 2. Call Gemini
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    
    prompt = (
        f"You are a forensic auditor reviewing '{file_name}' in case '{case_id}'.\n"
        "DOCUMENT CONTENT:\n"
        f"{context_text}\n\n"
        "MANDATORY TASK:\n"
        "1. Extract EVERY creditor claim found in the content above.\n"
        "2. For EACH claim, call 'upsert_claim_record'.\n"
        "   - Map 'Separatis' to 'secured', 'Preferen' to 'preferential', 'Konkuren' to 'concurrent'.\n"
        "3. If you find discrepancies, call 'create_audit_flag'.\n"
        "   - severity MUST BE one of: 'critical', 'high', 'medium', 'low'.\n"
        "   - flag_type MUST BE one of: 'contradiction', 'actio_pauliana', 'entity_duplicate', 'non_compliance', 'anomaly', 'inflated_claim'.\n"
        "4. Respond ONLY with tool calls. Do not provide a text summary."
    )

    try:
        # Define tools for the model
        TOOLS_MAP = {
            "upsert_claim_record": upsert_claim_record,
            "create_audit_flag": create_audit_flag
        }
        
        gemini_tools = [{"function_declarations": [
            {
                "name": "upsert_claim_record",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "case_id": {"type": "STRING"},
                        "creditor_name": {"type": "STRING"},
                        "claim_amount": {"type": "NUMBER"},
                        "claim_type": {"type": "STRING", "enum": ["preferential", "secured", "concurrent"]},
                        "status": {"type": "STRING"},
                        "legal_basis": {"type": "STRING"},
                        "source_document_id": {"type": "STRING"}
                    },
                    "required": ["case_id", "creditor_name", "claim_amount", "claim_type"]
                }
            },
            {
                "name": "create_audit_flag",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "case_id": {"type": "STRING"},
                        "title": {"type": "STRING"},
                        "description": {"type": "STRING"},
                        "severity": {"type": "STRING", "enum": ["critical", "high", "medium", "low"]},
                        "flag_type": {"type": "STRING", "enum": ["contradiction", "actio_pauliana", "entity_duplicate", "non_compliance", "anomaly", "inflated_claim"]},
                        "source_document_id": {"type": "STRING"}
                    },
                    "required": ["case_id", "title", "severity"]
                }
            }
        ]}]
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config={
                "system_instruction": CLAIM_AUDITOR_INSTRUCTION,
                "tools": gemini_tools,
                "tool_config": {"function_calling_config": {"mode": "ANY"}}
            }
        )

        # Process tool calls
        found_calls = 0
        if response.candidates[0].content and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    found_calls += 1
                    name = part.function_call.name
                    args = part.function_call.args or {}
                    
                    # SYSTEMIC ENFORCEMENT: Force system IDs regardless of LLM output
                    args["case_id"] = case_id
                    args["source_document_id"] = document_id
                    
                    logger.info("Agent calling tool: %s with enforced IDs", name)
                    if name in TOOLS_MAP:
                        res = TOOLS_MAP[name](**args)
                        if res.get("error"):
                            logger.error("Tool execution failed: %s", res["error"])
        
        logger.info("Forensic audit completed for %s. Executed %d tool calls.", file_name, found_calls)
    except Exception as e:
        logger.error("Forensic audit failed for %s: %s", file_name, e)

def _trigger_financial_audit(case_id: str, document_id: str, file_name: str):
    """
    Triggers the forensic financial analysis using direct GenAI client.
    """
    # Note: Logic similar to _trigger_claim_audit but for financial ratios.
    # For now, we log the intent as the primary goal is claim population.
    logger.info("Triggering financial audit for: %s (placeholder)", file_name)

