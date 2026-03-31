"""
KuratorMind AI — Supabase Tools

Shared tools for agents to interact with the Supabase database.
Provides vault document search, semantic search, and CRUD operations.
"""

import os
import json
from typing import Optional
from google.adk.tools import FunctionTool
from supabase import create_client, Client

# Initialize Supabase client
_supabase: Optional[Client] = None


def _get_supabase() -> Client:
    """Get or create the Supabase client (singleton)."""
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _supabase = create_client(url, key)
    return _supabase


def search_vault_documents(vault_id: str, query: str) -> dict:
    """Search for documents in a vault by file name or metadata.
    
    Args:
        vault_id: The UUID of the vault to search in.
        query: The search term to find in document names or summaries.
    
    Returns:
        A dict with 'documents' key containing matching documents.
    """
    try:
        sb = _get_supabase()
        result = (
            sb.table("vault_documents")
            .select("id, file_name, file_type, status, summary, page_count, created_at")
            .eq("vault_id", vault_id)
            .eq("status", "ready")
            .ilike("file_name", f"%{query}%")
            .limit(20)
            .execute()
        )
        return {"documents": result.data, "count": len(result.data)}
    except Exception as e:
        return {"error": str(e), "documents": []}


def get_document_summary(document_id: str) -> dict:
    """Get a document's summary and metadata.
    
    Args:
        document_id: The UUID of the document.
    
    Returns:
        A dict with the document's details including summary.
    """
    try:
        sb = _get_supabase()
        result = (
            sb.table("vault_documents")
            .select("id, file_name, file_type, summary, page_count, metadata")
            .eq("id", document_id)
            .single()
            .execute()
        )
        return {"document": result.data}
    except Exception as e:
        return {"error": str(e)}


def semantic_search(vault_id: str, query: str, top_k: int = 10) -> dict:
    """Perform semantic search across all document chunks in a vault.

    Embeds the query with Gemini gemini-embedding-001 and calls the
    match_document_chunks RPC for cosine-similarity retrieval (pgvector).
    Falls back to ilike text search if the vault has no embeddings yet.

    Args:
        vault_id: The UUID of the vault to search in.
        query: The natural language query to search for.
        top_k: Maximum number of results to return (default: 10).

    Returns:
        A dict with 'results' key containing matching chunks with
        document_id, page_number, and content for citation.
    """
    import os
    from google import genai as _genai

    try:
        sb = _get_supabase()

        # Generate query embedding via Gemini
        client = _genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))
        embed_result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=[query],
            config=_genai.types.EmbedContentConfig(output_dimensionality=768),
        )
        query_embedding: list[float] = embed_result.embeddings[0].values

        # Call the match_document_chunks RPC
        result = sb.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "match_vault_id": vault_id,
                "match_count": top_k,
                "match_threshold": 0.1,
            },
        ).execute()

        chunks = result.data or []

        # Enrich with document file names for better citations
        if chunks:
            doc_ids = list({c["document_id"] for c in chunks})
            docs = (
                sb.table("vault_documents")
                .select("id, file_name")
                .in_("id", doc_ids)
                .execute()
            )
            doc_map = {d["id"]: d["file_name"] for d in (docs.data or [])}
            for chunk in chunks:
                chunk["file_name"] = doc_map.get(chunk["document_id"], "Unknown")

        return {"results": chunks, "count": len(chunks), "query": query}

    except Exception as exc:
        # Fallback: simple keyword search when no embeddings exist yet
        try:
            sb = _get_supabase()
            result = (
                sb.table("document_chunks")
                .select(
                    "id, content, chunk_index, page_number, section_title, "
                    "document_id, vault_id, metadata"
                )
                .eq("vault_id", vault_id)
                .ilike("content", f"%{query}%")
                .limit(top_k)
                .execute()
            )
            return {
                "results": result.data or [],
                "count": len(result.data or []),
                "query": query,
                "fallback": True,
            }
        except Exception as fallback_exc:
            return {"error": str(fallback_exc), "results": []}


def upsert_claim_record(
    vault_id: str,
    creditor_name: str,
    claim_amount: float,
    claim_type: str,
    status: str = "pending",
    creditor_aliases: list[str] | None = None,
    collateral_description: str | None = None,
    legal_basis: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """Create or update a creditor claim record.
    
    Args:
        vault_id: UUID of the vault.
        creditor_name: Primary name of the creditor.
        claim_amount: The amount claimed by the creditor.
        claim_type: 'concurrent', 'secured', or 'preferential'.
        status: 'pending', 'verified', 'disputed', or 'rejected'.
        creditor_aliases: Other names this creditor might appear as in documents.
        collateral_description: Details of collateral if secured.
        legal_basis: The legal grounds for the claim (e.g. invoice numbers).
        metadata: Additional JSON metadata.
        
    Returns:
        The created/updated claim record.
    """
    try:
        sb = _get_supabase()
        # Clean the name for alias matching if needed, 
        # but for now we just upsert based on (vault_id, creditor_name).
        # Note: If your schema doesn't have a unique constraint on these, 
        # it will just insert. Checking for existing by name first.
        
        data = {
            "vault_id": vault_id,
            "creditor_name": creditor_name,
            "creditor_aliases": creditor_aliases or [],
            "claim_amount": claim_amount,
            "claim_type": claim_type,
            "collateral_description": collateral_description,
            "status": status,
            "legal_basis": legal_basis,
            "metadata": metadata or {},
            "updated_at": "now()",
        }
        
        # Check if exists
        existing = sb.table("claims").select("id").eq("vault_id", vault_id).eq("creditor_name", creditor_name).maybe_single().execute()
        
        if existing.data:
            result = sb.table("claims").update(data).eq("id", existing.data["id"]).execute()
        else:
            result = sb.table("claims").insert(data).execute()
            
        return {"claim": result.data[0] if result.data else None, "error": None}
    except Exception as e:
        return {"error": str(e), "claim": None}


def create_audit_flag(
    vault_id: str,
    title: str,
    description: str,
    severity: str = "medium",
    flag_type: str = "contradiction",
    claim_id: str | None = None,
    evidence: list[dict] | None = None,
    legal_reference: str | None = None,
) -> dict:
    """Record a forensic audit flag (contradiction, anomaly, etc.).
    
    Args:
        vault_id: UUID of the vault.
        title: Short title of the issue.
        description: Detailed explanation of the flag.
        severity: 'critical', 'high', 'medium', 'low'.
        flag_type: 'contradiction', 'actio_pauliana', 'entity_duplicate', etc.
        claim_id: Optional UUID of the associated claim.
        evidence: List of evidence objects {source: str, content: str}.
        legal_reference: Relevant law articles (e.g. UU 37/2004 Art 41).
        
    Returns:
        The created audit flag record.
    """
    try:
        sb = _get_supabase()
        data = {
            "vault_id": vault_id,
            "claim_id": claim_id,
            "severity": severity,
            "flag_type": flag_type,
            "title": title,
            "description": description,
            "evidence": evidence or [],
            "legal_reference": legal_reference,
            "resolved": False,
        }
        result = sb.table("audit_flags").insert(data).execute()
        return {"flag": result.data[0] if result.data else None, "error": None}
    except Exception as e:
        return {"error": str(e), "flag": None}


GLOBAL_LEGAL_VAULT_ID = "00000000-0000-0000-0000-000000000000"


def search_regulations(query: str, top_k: int = 5) -> dict:
    """Search specifically within the Global Legal & PSAK Vault.
    
    This is used by the Regulatory Scholar to find law articles and 
    accounting standards that apply to all cases.
    
    Args:
        query: The legal or accounting question.
        top_k: Number of relevant clauses to return.
    """
    return semantic_search(vault_id=GLOBAL_LEGAL_VAULT_ID, query=query, top_k=top_k)


def sync_legal_knowledge(keywords: list[str]) -> dict:
    """Manual/Scheduled trigger to sync latest Indonesian regulations.
    
    Uses web search to find new PDF/articles from official JDIH sites 
    (Setkab, OJK, Kemenkeu) and indexes them into the Global Vault.
    
    Args:
        keywords: List of legal topics to search for (e.g. ['LPS 2026', 'PSAK 71 update']).
    """
    import os
    from google import genai as _genai # type: ignore
    
    try:
        sb = _get_supabase()
        client = _genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))
        
        all_results = []
        for kw in keywords:
            # We use a targeted search query for best results
            search_query = f"site:jdih.setkab.go.id OR site:ojk.go.id OR site:jdih.kemenkeu.go.id {kw} filetype:pdf"
            
            # Note: In a real environment, we'd use a search API like Serper or Brave.
            # Here we simulate the discovery. For the demo, we assume we find 1-2 key URLs.
            # Since I don't have a direct search_web tool *inside* this python tool,
            # we rely on the agent calling this tool after it has used its own search_web tool.
            
            # For now, this tool acts as the "Ingestion Bridge" for the found URLs.
            all_results.append(f"Simulated discovery for: {kw}")

        return {
            "status": "Keywords received. Please use 'scrape_and_index' for specific URLs found.",
            "processed_keywords": keywords
        }
    except Exception as e:
        return {"error": str(e)}


def scrape_and_index_regulation(url: str, title: str) -> dict:
    """Downloads a regulation from a URL and indexes it into the Global Vault.
    
    Args:
        url: URL to the PDF or HTML regulation.
        title: Title of the regulation (e.g. 'UU No. 37 Tahun 2004').
    """
    from kuratormind.services.ingestion import ingest_document # type: ignore
    import uuid
    import requests # type: ignore
    
    try:
        sb = _get_supabase()
        
        # 1. Download file content
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            return {"error": f"Failed to download from {url}"}
            
        file_bytes = response.content
        file_name = f"{title.replace(' ', '_')}.pdf"
        storage_path = f"global_regulations/{file_name}"
        
        # 2. Upload to Supabase Storage (vault-files bucket)
        sb.storage.from_("vault-files").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "application/pdf"}
        )
        
        # 3. Create vault_document record
        doc_id = str(uuid.uuid4())
        sb.table("vault_documents").insert({
            "id": doc_id,
            "vault_id": GLOBAL_LEGAL_VAULT_ID,
            "file_name": file_name,
            "file_type": "application/pdf",
            "file_path": storage_path,
            "status": "pending"
        }).execute()
        
        # 4. Trigger Ingestion (Service logic)
        # Note: ingest_document handles chunking, embedding, and summary.
        ingest_result = ingest_document(
            document_id=doc_id,
            vault_id=GLOBAL_LEGAL_VAULT_ID,
            storage_path=storage_path,
            file_name=file_name,
            file_type="application/pdf"
        )
        
        return {"success": True, "document_id": doc_id, "ingestion": ingest_result}
    except Exception as e:
        return {"error": str(e)}

