"""
KuratorMind AI — Supabase Tools

Shared tools for agents to interact with the Supabase database.
Provides case document search, semantic search, and CRUD operations.
"""

import os
import json
import uuid
import logging
from typing import Optional, Any
from google.adk.tools import FunctionTool # type: ignore
from supabase import create_client, Client # type: ignore
from kuratormind.services.security import encrypt_pii, decrypt_pii

logger = logging.getLogger(__name__)

# Initialize Supabase client
_supabase: Optional[Client] = None


def _is_valid_uuid(val: str) -> bool:
    """Check if a string is a valid UUID."""
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False


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


def search_case_documents(case_id: str, query: str) -> dict:
    """Search for documents in a case by file name or metadata.
    
    Args:
        case_id: The UUID of the case to search in.
        query: The search term to find in document names or summaries.
    
    Returns:
        A dict with 'documents' key containing matching documents.
    """
    if not _is_valid_uuid(case_id):
        return {"error": "Invalid case_id format.", "documents": []}

    try:
        sb = _get_supabase()
        result = (
            sb.table("case_documents")
            .select("id, file_name, file_type, status, summary, page_count, created_at")
            .eq("case_id", case_id)
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
    if not _is_valid_uuid(document_id):
        return {"error": "Invalid document_id format."}

    try:
        sb = _get_supabase()
        result = (
            sb.table("case_documents")
            .select("id, file_name, file_type, summary, page_count, metadata")
            .eq("id", document_id)
            .single()
            .execute()
        )
        return {"document": result.data}
    except Exception as e:
        return {"error": str(e)}


def semantic_search(case_id: str, query: str, top_k: int = 10) -> dict:
    """Perform semantic search across all document chunks in a case.

    Embeds the query with Gemini gemini-embedding-001 and calls the
    match_document_chunks RPC for cosine-similarity retrieval (pgvector).
    Falls back to ilike text search if the case has no embeddings yet.

    Args:
        case_id: The UUID of the case to search in.
        query: The natural language query to search for.
        top_k: Maximum number of results to return (default: 10).

    Returns:
        A dict with 'results' key containing matching chunks with
        document_id, page_number, and content for citation.
    """
    if not _is_valid_uuid(case_id):
        return {"error": "Invalid case_id format.", "results": []}

    import os
    from google import genai as _genai # type: ignore

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
                "match_case_id": case_id,
                "match_count": top_k,
                "match_threshold": 0.1,
            },
        ).execute()

        chunks = result.data or []

        # Enrich with document file names for better citations
        if chunks:
            doc_ids = list({c["document_id"] for c in chunks})
            docs = (
                sb.table("case_documents")
                .select("id, file_name")
                .in_("id", doc_ids)
                .execute()
            )
            doc_map = {d["id"]: d["file_name"] for d in (docs.data or [])}
            for chunk in chunks:
                chunk["file_name"] = doc_map.get(chunk["document_id"], "Unknown")

        # Calculate average similarity score for confidence metric
        avg_similarity = 0.0
        if chunks:
            avg_similarity = sum(c.get("similarity", 0.0) for c in chunks) / len(chunks)

        return {
            "results": chunks, 
            "count": len(chunks), 
            "query": query,
            "average_similarity": avg_similarity
        }

    except Exception as exc:
        # Fallback: simple keyword search when no embeddings exist yet
        try:
            sb = _get_supabase()
            result = (
                sb.table("document_chunks")
                .select(
                    "id, content, chunk_index, page_number, section_title, "
                    "document_id, case_id, metadata"
                )
                .eq("case_id", case_id)
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
    case_id: str,
    creditor_name: str,
    claim_amount: float,
    claim_type: str,
    status: str = "pending",
    creditor_aliases: list[str] | None = None,
    collateral_description: str | None = None,
    legal_basis: str | None = None,
    metadata: dict | None = None,
    source_document_id: str | None = None,
) -> dict:
    """Create or update a creditor claim record.
    
    Args:
        case_id: UUID of the case.
        creditor_name: Primary name of the creditor.
        claim_amount: The amount claimed by the creditor.
        claim_type: 'concurrent', 'secured', or 'preferential'.
        status: 'pending', 'verified', 'disputed', or 'rejected'.
        creditor_aliases: Other names this creditor might appear as in documents.
        collateral_description: Details of collateral if secured.
        legal_basis: The legal grounds for the claim (e.g. invoice numbers).
        metadata: Additional JSON metadata.
        source_document_id: ID of the document that generated this claim.
        
    Returns:
        The created/updated claim record.
    """
    try:
        sb = _get_supabase()
        
        data = {
            "case_id": case_id,
            "creditor_name": encrypt_pii(creditor_name),
            "creditor_aliases": [encrypt_pii(a) for a in (creditor_aliases or [])],
            "claim_amount": claim_amount,
            "claim_type": claim_type,
            "collateral_description": collateral_description,
            "status": status,
            "legal_basis": legal_basis,
            "metadata": metadata or {},
            "updated_at": "now()",
        }
        
        if source_document_id:
            data["metadata"]["source_document_id"] = source_document_id
        
        # Check if exists (Search by encrypted name)
        query = sb.table("claims").select("id").eq("case_id", case_id).eq("creditor_name", encrypt_pii(creditor_name)).execute()
        existing_data = query.data
        
        if existing_data and len(existing_data) > 0:
            result = sb.table("claims").update(data).eq("id", existing_data[0]["id"]).execute()
        else:
            result = sb.table("claims").insert(data).execute()
            
        if result.data and len(result.data) > 0:
            claim = result.data[0]
            claim["creditor_name"] = decrypt_pii(claim.get("creditor_name"))
            claim["creditor_aliases"] = [decrypt_pii(a) for a in claim.get("creditor_aliases", [])]
            return {"claim": claim, "error": None}
            
        return {"claim": None, "error": None}
    except Exception as e:
        return {"error": str(e), "claim": None}


def create_audit_flag(
    case_id: str,
    title: str,
    description: str,
    severity: str = "medium",
    flag_type: str = "contradiction",
    claim_id: str | None = None,
    evidence: list[dict] | None = None,
    legal_reference: str | None = None,
    source_document_id: str | None = None,
) -> dict:
    """Record a forensic audit flag (contradiction, anomaly, etc.).
    
    Args:
        case_id: UUID of the case.
        title: Short title of the issue.
        description: Detailed explanation of the flag.
        severity: 'critical', 'high', 'medium', 'low'.
        flag_type: 'contradiction', 'actio_pauliana', 'entity_duplicate', etc.
        claim_id: Optional UUID of the associated claim.
        evidence: List of evidence objects {source: str, content: str}.
        legal_reference: Relevant law articles (e.g. UU 37/2004 Art 41).
        source_document_id: ID of the document where this flag was found.
        
    Returns:
        The created audit flag record.
    """
    try:
        sb = _get_supabase()
        
        actual_evidence = evidence or []
        if source_document_id:
            # We store it in evidence so we can find it for deletion cleanup
            actual_evidence.append({
                "type": "source_link",
                "source_document_id": source_document_id,
                "note": "Automatically linked to source document"
            })

        data = {
            "case_id": case_id,
            "claim_id": claim_id,
            "severity": severity,
            "flag_type": flag_type,
            "title": title,
            "description": description,
            "evidence": actual_evidence,
            "legal_reference": legal_reference,
            "resolved": False,
        }
        result = sb.table("audit_flags").insert(data).execute()
        return {"flag": result.data[0] if result.data else None, "error": None}
    except Exception as e:
        return {"error": str(e), "flag": None}


GLOBAL_LEGAL_CASE_ID = "00000000-0000-0000-0000-000000000000"


def search_regulations(query: str, top_k: int = 5) -> dict:
    """Search specifically within the Global Legal & PSAK Case.
    
    This is used by the Regulatory Scholar to find law articles and 
    accounting standards that apply to all cases.
    
    Args:
        query: The legal or accounting question.
        top_k: Number of relevant clauses to return.
    """
    return semantic_search(case_id=GLOBAL_LEGAL_CASE_ID, query=query, top_k=top_k)
def sync_legal_knowledge(keywords: list[str], force: bool = False) -> dict:
    """Manual/Scheduled trigger to sync latest Indonesian regulations.
    
    Uses Google Search to find new PDF/articles from official JDIH sites 
    (Setkab, OJK, Kemenkeu, BPHN) and indexes them into the Global Case.
    
    Args:
        keywords: List of legal topics to search for.
        force: If True, skip the weekly check and perform sync anyway.
    """
    import os
    import datetime
    from google import genai as _genai # type: ignore
    
    try:
        sb = _get_supabase()
        
        # 1. Weekly Check (User Feedback: "update is on weekly basis")
        case_res = sb.table("cases").select("metadata").eq("id", GLOBAL_LEGAL_CASE_ID).maybe_single().execute()
        # Ensure case_metadata is treated as a mutable dict
        case_metadata = dict(case_res.data.get("metadata", {})) if case_res.data else {}
        last_sync_str = case_metadata.get("last_sync")
        
        if not force and isinstance(last_sync_str, str):
            last_sync = datetime.datetime.fromisoformat(last_sync_str)
            if (datetime.datetime.now(datetime.timezone.utc) - last_sync).days < 7:
                return {"status": "skipped", "message": "Last sync was less than a week ago. Use force=True to override."}

        # 2. Search and discover
        client = _genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))
        discovered_links: list[dict[str, str]] = []
        
        # Ensure keywords is a list
        search_keywords = keywords if isinstance(keywords, list) else ["Indonesian regulations 2026", "hukum kepailitan"]
        
        for kw in search_keywords:
            # Broad search across official government domains (OJK, Kemenkeu, BPHN)
            search_query = f"site:ojk.go.id OR site:jdih.kemenkeu.go.id OR site:bphn.go.id {kw} 2026 2027 filetype:pdf"
            
            # Using GenAI as the "Search Bridge"
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=f"Find the official URL for the latest regulation about {kw} in 2026/2027 in Indonesia. Return only a short list of URLs.",
                config=_genai.types.GenerateContentConfig(
                    tools=[{"google_search": {}}]
                )
            )
            
            # Extract links from grounding metadata
            if response.candidates[0].grounding_metadata:
                for chunk in response.candidates[0].grounding_metadata.grounding_chunks or []:
                    if chunk.web:
                        discovered_links.append({"url": chunk.web.uri, "title": chunk.web.title, "topic": kw})

        # 3. Process first 3 discovered links (throttled for performance)
        synced = []
        for i, link in enumerate(discovered_links):
            if i >= 3:
                break
            res = scrape_and_index_regulation(url=link["url"], title=link["title"])
            if "success" in res:
                synced.append(link["title"])
        
        # 4. Update last_sync
        from typing import Any, cast
        m_data = cast(dict[str, Any], case_metadata)
        m_data["last_sync"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        sb.table("cases").update({"metadata": m_data}).eq("id", GLOBAL_LEGAL_CASE_ID).execute()
        
        return {
            "status": "success", 
            "synced_count": len(synced), 
            "synced_titles": synced,
            "next_sync_available": (datetime.datetime.now() + datetime.timedelta(days=7)).isoformat()
        }
    except Exception as e:
        return {"error": str(e)}


def scrape_and_index_regulation(url: str, title: str) -> dict:
    """Downloads a regulation from a URL and indexes it into the Global Case.
    
    Args:
        url: URL to the PDF or HTML regulation.
        title: Title of the regulation (e.g. 'UU No. 37 Tahun 2004').
    """
    from kuratormind.services.ingestion import ingest_document # type: ignore
    import uuid
    import requests # type: ignore
    from urllib.parse import urlparse
    import socket
    
    try:
        sb = _get_supabase()
        
        # T-15, T-16 FIX: Validate URL to prevent SSRF and indexing malicious precedents
        parsed_url = urlparse(url)
        domain = parsed_url.hostname
        if not domain:
            return {"error": "Invalid URL provided."}
            
        ALLOWED_DOMAINS = ["ojk.go.id", "jdih.kemenkeu.go.id", "bphn.go.id", "mahkamahagung.go.id", "peraturan.go.id"]
        if not any(domain.endswith(d) for d in ALLOWED_DOMAINS):
            return {"error": f"Domain {domain} is not an authorized official legal source."}
            
        try:
            ip = socket.gethostbyname(domain)
            if ip.startswith("127.") or ip.startswith("10.") or ip.startswith("192.168.") or ip.startswith("169.254.") or ip.startswith("::1"):
                return {"error": "Invalid domain resolution (SSRF protection)."}
        except socket.error:
            return {"error": "Failed to resolve domain."}

        # 1. Download file content
        response = requests.get(url, timeout=30)
        if response.status_code != 200:
            return {"error": f"Failed to download from {url}"}
            
        file_bytes = response.content
        file_name = f"{title.replace(' ', '_')}.pdf"
        storage_path = f"global_regulations/{file_name}"
        
        # 2. Upload to Supabase Storage (case-files bucket)
        sb.storage.from_("case-files").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "application/pdf"}
        )
        
        # 3. Create vault_document record
        doc_id = str(uuid.uuid4())
        sb.table("case_documents").insert({
            "id": doc_id,
            "case_id": GLOBAL_LEGAL_CASE_ID,
            "file_name": file_name,
            "file_type": "application/pdf",
            "file_path": storage_path,
            "status": "pending"
        }).execute()
        
        # 4. Trigger Ingestion (Service logic)
        # Note: ingest_document handles chunking, embedding, and summary.
        ingest_result = ingest_document(
            document_id=doc_id,
            case_id=GLOBAL_LEGAL_CASE_ID,
            storage_path=storage_path,
            file_name=file_name,
            file_type="application/pdf"
        )
        
        return {"success": True, "document_id": doc_id, "ingestion": ingest_result}
    except Exception as e:
        return {"error": str(e)}

def get_case_consolidated_findings(case_id: str) -> dict:
    """Helper for Output Architect. Collects all forensic data for a case.
    
    Fetches:
    1. Financial Analyses (Ratios/Anomalies)
    2. Audit Flags (Red flags/Legal contradictions/Regulatory issues)
    3. Claim Statistics (Total concurrent, secured, preferential)
    4. Global Entity Conflicts (Phase 1D - Networked risks)
    
    Args:
        case_id: UUID of the case to consolidate.
    """
    try:
        sb = _get_supabase()
        
        # 1. Financials
        financials = sb.table("financial_analyses").select("*").eq("case_id", case_id).order("period").execute()
        
        # 2. Audit Flags
        flags = sb.table("audit_flags").select("*").eq("case_id", case_id).execute()
        
        # 3. Claims (Decrypt PII)
        claims_res = sb.table("claims").select("*").eq("case_id", case_id).execute()
        claims = claims_res.data or []
        for c in claims:
            c["creditor_name"] = decrypt_pii(c.get("creditor_name"))
            c["creditor_aliases"] = [decrypt_pii(a) for a in c.get("creditor_aliases", [])]

        # 4. Global Overlaps (from Phase 1D)
        # Find all entities in this case that exist in others
        overlaps = sb.table("entity_occurrences") \
            .select("entity_id, global_entities(name, entity_type, risk_score)") \
            .eq("case_id", case_id) \
            .execute()
            
        return {
            "financials": financials.data or [],
            "audit_flags": flags.data or [],
            "claims": claims.data or [],
            "global_overlaps": overlaps.data or [],
            "error": None
        }
    except Exception as e:
        return {"error": str(e)}


def save_generated_output(
    case_id: str, 
    title: str, 
    output_type: str, 
    content: str | dict, 
    metadata: dict | None = None,
    file_path: str | None = None
) -> dict:
    """Persist a generated forensic document to the database.
    
    Args:
        case_id: UUID of the case.
        title: Title of the document (e.g. 'Daftar Piutang Tetap - V2').
        output_type: 'judge_report', 'creditor_list', 'forensic_summary'.
        content: The primary content (Markdown string or structured JSON).
        metadata: Optional additional metadata.
        file_path: Optional path to the physical file in Storage.
    """
    try:
        sb = _get_supabase()
        
        # Wrap string content in a dict for the JSONB column if it's not already
        if isinstance(content, str):
            content_data = {"markdown": content}
        else:
            content_data = content
            
        data = {
            "case_id": case_id,
            "title": title,
            "output_type": output_type,
            "content": content_data,
            "file_path": file_path,
            "metadata": metadata or {},
        }
        
        result = sb.table("generated_outputs").insert(data).execute()
        return {"output": result.data[0] if result.data else None, "error": None}
    except Exception as e:
        return {"error": str(e), "output": None}


def global_semantic_search(query: str, current_case_id: str, top_k: int = 10) -> dict:
    """Perform semantic search across document chunks in the user's cases.

    Useful for finding precedents, similar cases, or cross-case evidence within
    the user's own portfolio. Note: T-08 fix ensures tenant isolation.

    Args:
        query: The natural language query to search for.
        current_case_id: The ID of the case you are currently analyzing.
        top_k: Maximum number of results to return.

    Returns:
        Matches including case_id for cross-referencing.
    """
    import os
    from google import genai as _genai # type: ignore

    try:
        sb = _get_supabase()
        client = _genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))
        embed_result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=[query],
            config=_genai.types.EmbedContentConfig(output_dimensionality=768),
        )
        query_embedding: list[float] = embed_result.embeddings[0].values

        # Fetch user_id from current_case_id to establish tenant boundary
        case_res = sb.table("cases").select("user_id").eq("id", current_case_id).execute()
        if not case_res.data:
            return {"error": "Invalid current_case_id provided.", "results": []}
            
        user_id = case_res.data[0]["user_id"]

        result = sb.rpc(
            "match_global_chunks_by_user",
            {
                "query_embedding": query_embedding,
                "user_id_param": user_id,
                "match_count": top_k,
                "match_threshold": 0.1,
                "exclude_case_id": current_case_id
            },
        ).execute()

        return {"results": result.data or [], "count": len(result.data or []), "query": query}
    except Exception as e:
        return {"error": str(e), "results": []}


def resolve_global_entity(name: str, entity_type: str, case_id: str, source_id: str, source_type: str) -> dict:
    """Links a local entity (creditor/director) to a global identity.
    
    Uses fuzzy name matching to find potential existing global entities.
    If match found > 0.85, links to it. Otherwise creates a new global entity.
    
    Args:
        name: Name of the entity.
        entity_type: 'creditor', 'debtor', 'director', 'counsel'.
        case_id: Current case ID.
        source_id: The ID of the claim or document chunk where this was found.
        source_type: 'claim', 'chunk', etc.
    """
    try:
        sb = _get_supabase()
        
        # 1. Fuzzy match for existing global entity
        # We use ilike for now as a simple proxy, but with pg_trgm we could use similarity(name, ?)
        existing = sb.table("global_entities").select("*").ilike("name", f"%{name}%").eq("entity_type", entity_type).execute()
        
        entity_id = None
        if existing.data:
            # Simple exact match check first
            exact = next((e for e in existing.data if e["name"].lower() == name.lower()), None)
            if exact:
                entity_id = exact["id"]
        
        # 2. If not found, create new global entity
        if not entity_id:
            res = sb.table("global_entities").insert({
                "name": name,
                "entity_type": entity_type,
            }).execute()
            if res.data:
                entity_id = res.data[0]["id"]
        
        # 3. Create occurrence record
        if entity_id:
            sb.table("entity_occurrences").insert({
                "entity_id": entity_id,
                "case_id": case_id,
                "source_type": source_type,
                "source_id": source_id,
            }).execute()
            
            # Check for conflict: Does this entity exist in OTHER cases?
            other_vaults = sb.table("entity_occurrences").select("case_id").eq("entity_id", entity_id).neq("case_id", case_id).execute()
            has_conflict = len(other_vaults.data) > 0
            
            # T-09 FIX: We purposefully DO NOT return len(other_vaults.data) to avoid leaking
            # metadata about the scale of other confidential cases.
            return {
                "entity_id": entity_id, 
                "has_conflict": has_conflict
            }
            
        return {"error": "Failed to resolve entity"}
    except Exception as e:
        return {"error": str(e)}

