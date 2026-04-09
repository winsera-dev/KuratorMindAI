"""
KuratorMind AI — Search API Route

Standalone endpoint for semantic (vector) search across a case's documents.
Used by the 'Discovery' tab to find forensic evidence.
"""

import logging
import os
from typing import List, Optional, Annotated
from fastapi import APIRouter, HTTPException, Depends, Request as FastAPIRequest  # type: ignore
from pydantic import BaseModel  # type: ignore
from supabase import create_client, Client # type: ignore
from kuratormind.api.deps import get_current_user
from kuratormind.api.limiter import limiter, LIMIT_SEARCH
from kuratormind.tools.supabase_tools import semantic_search # type: ignore

logger = logging.getLogger(__name__)
router = APIRouter()

# ------------------------------------------------------------
# Models
# ------------------------------------------------------------

class SearchRequest(BaseModel):
    case_id: str
    query: str
    top_k: Optional[int] = 10

class SearchResult(BaseModel):
    id: str
    content: str
    document_id: str
    file_name: str
    page_number: Optional[int]
    similarity_score: Optional[float] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]
    count: int
    query: str
    fallback: bool = False

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

@router.post("/search", response_model=SearchResponse)
@limiter.limit(LIMIT_SEARCH)
async def case_search(
    request: FastAPIRequest,
    search_request: SearchRequest,
    current_user: Annotated[str, Depends(get_current_user)],
):
    """
    Perform a semantic search across all document chunks in a case.
    Returns ranked results with citations.
    """
    try:
        sb = _get_supabase()
        # Ownership check: verify case belongs to current_user
        case = sb.table("cases").select("user_id").eq("id", search_request.case_id).maybe_single().execute()
        if not case.data or case.data.get("user_id") != current_user:
            raise HTTPException(status_code=403, detail="Access denied to this case.")

        search_results = semantic_search(
            case_id=search_request.case_id,
            query=search_request.query,
            top_k=search_request.top_k or 10
        )
        
        if "error" in search_results:
            raise HTTPException(status_code=500, detail=search_results["error"])
            
        results = []
        for res in search_results.get("results", []):
            results.append(SearchResult.model_validate({
                "id": res.get("id", ""),
                "content": res.get("content", ""),
                "document_id": res.get("document_id", ""),
                "file_name": res.get("file_name", "Unknown"),
                "page_number": res.get("page_number"),
                "similarity_score": res.get("similarity") # pgvector similarity score
            }))
            
        return SearchResponse.model_validate({
            "results": results,
            "count": len(results),
            "query": search_request.query,
            "fallback": search_results.get("fallback", False)
        })
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Search API Error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
