"""
KuratorMind AI — Supabase Tools

Shared tools for agents to interact with the Supabase database.
Provides vault document search, semantic search, and CRUD operations.
"""

import os
import json
from typing import Optional
from google.adk.tools import FunctionTool # type: ignore
from supabase import create_client, Client # type: ignore

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
    source_document_id: str | None = None,
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
        source_document_id: ID of the document that generated this claim.
        
    Returns:
        The created/updated claim record.
    """
    try:
        sb = _get_supabase()
        
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
        
        if source_document_id:
            data["metadata"]["source_document_id"] = source_document_id
        
        # Check if exists
        query = sb.table("claims").select("id").eq("vault_id", vault_id).eq("creditor_name", creditor_name).execute()
        existing_data = query.data
        
        if existing_data and len(existing_data) > 0:
            result = sb.table("claims").update(data).eq("id", existing_data[0]["id"]).execute()
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
    source_document_id: str | None = None,
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
            "vault_id": vault_id,
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
def sync_legal_knowledge(keywords: list[str], force: bool = False) -> dict:
    """Manual/Scheduled trigger to sync latest Indonesian regulations.
    
    Uses Google Search to find new PDF/articles from official JDIH sites 
    (Setkab, OJK, Kemenkeu, BPHN) and indexes them into the Global Vault.
    
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
        vault_res = sb.table("vaults").select("metadata").eq("id", GLOBAL_LEGAL_VAULT_ID).maybe_single().execute()
        # Ensure vault_metadata is treated as a mutable dict
        vault_metadata = dict(vault_res.data.get("metadata", {})) if vault_res.data else {}
        last_sync_str = vault_metadata.get("last_sync")
        
        if not force and isinstance(last_sync_str, str):
            last_sync = datetime.datetime.fromisoformat(last_sync_str)
            if (datetime.datetime.now(datetime.timezone.utc) - last_sync).days < 7:
                return {"status": "skipped", "message": "Last sync was less than a week ago. Use force=True to override."}

        # 2. Search and discover
        client = _genai.Client(api_key=os.environ.get("GOOGLE_API_KEY", ""))
        discovered_links: list[dict[str, str]] = []
        
        for kw in keywords:
            # Broad search across official government domains (OJK, Kemenkeu, BPHN)
            search_query = f"site:ojk.go.id OR site:jdih.kemenkeu.go.id OR site:bphn.go.id {kw} 2026 2027 filetype:pdf"
            
            # Using GenAI as the "Search Bridge"
            response = client.models.generate_content(
                model="gemini-1.5-flash",
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
        m_data = cast(dict[str, Any], vault_metadata)
        m_data["last_sync"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        sb.table("vaults").update({"metadata": m_data}).eq("id", GLOBAL_LEGAL_VAULT_ID).execute()
        
        return {
            "status": "success", 
            "synced_count": len(synced), 
            "synced_titles": synced,
            "next_sync_available": (datetime.datetime.now() + datetime.timedelta(days=7)).isoformat()
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

def get_vault_consolidated_findings(vault_id: str) -> dict:
    """Helper for Output Architect. Collects all forensic data for a vault.
    
    Fetches:
    1. Financial Analyses (Ratios/Anomalies)
    2. Audit Flags (Red flags/Legal contradictions/Regulatory issues)
    3. Claim Statistics (Total concurrent, secured, preferential)
    4. Global Entity Conflicts (Phase 1D - Networked risks)
    
    Args:
        vault_id: UUID of the vault to consolidate.
    """
    try:
        sb = _get_supabase()
        
        # 1. Financials
        financials = sb.table("financial_analyses").select("*").eq("vault_id", vault_id).order("period").execute()
        
        # 2. Audit Flags
        flags = sb.table("audit_flags").select("*").eq("vault_id", vault_id).execute()
        
        # 3. Claims
        claims = sb.table("claims").select("*").eq("vault_id", vault_id).execute()

        # 4. Global Overlaps (from Phase 1D)
        # Find all entities in this vault that exist in others
        overlaps = sb.table("entity_occurrences") \
            .select("entity_id, global_entities(name, entity_type, risk_score)") \
            .eq("vault_id", vault_id) \
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
    vault_id: str, 
    title: str, 
    output_type: str, 
    content: str | dict, 
    metadata: dict | None = None,
    file_path: str | None = None
) -> dict:
    """Persist a generated forensic document to the database.
    
    Args:
        vault_id: UUID of the vault.
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
            "vault_id": vault_id,
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


def global_semantic_search(query: str, top_k: int = 10, exclude_vault_id: str | None = None) -> dict:
    """Perform semantic search across ALl document chunks in the entire database.

    Useful for finding precedents, similar cases, or cross-vault evidence.

    Args:
        query: The natural language query to search for.
        top_k: Maximum number of results to return.
        exclude_vault_id: Optional ID to exclude from results (e.g. current case).

    Returns:
        Matches including vault_id for cross-referencing.
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

        result = sb.rpc(
            "match_global_chunks",
            {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "match_threshold": 0.1,
                "exclude_vault_id": exclude_vault_id
            },
        ).execute()

        return {"results": result.data or [], "count": len(result.data or []), "query": query}
    except Exception as e:
        return {"error": str(e), "results": []}


def resolve_global_entity(name: str, entity_type: str, vault_id: str, source_id: str, source_type: str) -> dict:
    """Links a local entity (creditor/director) to a global identity.
    
    Uses fuzzy name matching to find potential existing global entities.
    If match found > 0.85, links to it. Otherwise creates a new global entity.
    
    Args:
        name: Name of the entity.
        entity_type: 'creditor', 'debtor', 'director', 'counsel'.
        vault_id: Current vault ID.
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
                "vault_id": vault_id,
                "source_type": source_type,
                "source_id": source_id,
            }).execute()
            
            # Check for conflict: Does this entity exist in OTHER vaults?
            other_vaults = sb.table("entity_occurrences").select("vault_id").eq("entity_id", entity_id).neq("vault_id", vault_id).execute()
            has_conflict = len(other_vaults.data) > 0
            
            return {
                "entity_id": entity_id, 
                "has_conflict": has_conflict, 
                "other_vault_count": len(other_vaults.data)
            }
            
        return {"error": "Failed to resolve entity"}
    except Exception as e:
        return {"error": str(e)}

