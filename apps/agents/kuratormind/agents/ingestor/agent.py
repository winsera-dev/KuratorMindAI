"""
KuratorMind AI — Forensic Ingestor Agent

Specialized ADK agent responsible for processing uploaded documents.
Handles PDF and Excel file ingestion, chunking, and vector embedding.
Called by the Lead Orchestrator when new documents need to be indexed.
"""

from google.adk.agents import Agent  # type: ignore

INGESTOR_INSTRUCTION = """You are the Forensic Ingestor for KuratorMind AI.

## Your Specialization
You process uploaded legal and financial documents for Indonesian insolvency cases.
Your job is to extract, structure, and index all content so other agents can reference it.

## Documents You Handle
- **PDF**: Court filings, creditor claims (tagihan), invoices, notarial deeds, financial statements, annual reports, etc
- **Excel**: Balance sheets (neraca), income statements, debt schedules, creditor lists, etc
- **Images**: Scanned documents, WhatsApp screenshots (OCR extraction), etc

## Your Process
1. Receive a document_id from the orchestrator
2. Check the document's current status in case_documents
3. If status is 'pending' or 'error', trigger ingestion via ingest_document tool
4. Monitor progress and report back with chunk count and summary

## Quality Standards
- Every chunk must preserve its page/sheet reference for citation
- Financial data in Excel must be extracted with column headers intact
- Creditor names and amounts must be correctly identified

## Language
Respond in the same language as your instructions. When reporting to the orchestrator,
include the number of chunks indexed and a brief summary of the document content.
"""


def check_ingestion_status(document_id: str) -> dict:
    """
    Check the current ingestion status of a document.

    Args:
        document_id: UUID of the case_documents record to check.

    Returns:
        Dict with status, summary, page_count, and chunk_count.
    """
    import os
    from supabase import create_client  # type: ignore

    try:
        sb = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )

        # Get document status
        doc_result = (
            sb.table("case_documents")
            .select("id, file_name, status, summary, page_count")
            .eq("id", document_id)
            .single()
            .execute()
        )

        if not doc_result.data:
            return {"error": f"Document {document_id} not found."}

        doc = doc_result.data

        # Count chunks
        chunk_result = (
            sb.table("document_chunks")
            .select("id", count="exact")
            .eq("document_id", document_id)
            .execute()
        )

        chunk_count = chunk_result.count or 0

        return {
            "document_id": document_id,
            "file_name": doc.get("file_name"),
            "status": doc.get("status"),
            "summary": doc.get("summary"),
            "page_count": doc.get("page_count"),
            "chunks_indexed": chunk_count,
        }

    except Exception as exc:
        return {"error": str(exc)}


forensic_ingestor = Agent(
    name="forensic_ingestor",
    model="gemini-2.5-flash",
    description=(
        "Processes uploaded documents (PDF, Excel) into searchable chunks "
        "with vector embeddings for semantic retrieval. Handles Indonesian "
        "legal documents, creditor claims, and financial statements."
    ),
    instruction=INGESTOR_INSTRUCTION,
    tools=[check_ingestion_status],
)
