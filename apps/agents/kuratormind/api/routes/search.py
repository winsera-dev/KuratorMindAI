"""
KuratorMind AI — Search API Route

Standalone endpoint for semantic (vector) search across a vault's documents.
Used by the 'Discovery' tab to find forensic evidence.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException  # type: ignore
from pydantic import BaseModel  # type: ignore
from kuratormind.tools.supabase_tools import semantic_search # type: ignore

logger = logging.getLogger(__name__)
router = APIRouter()

class SearchRequest(BaseModel):
    vault_id: str
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

@router.post("/search", response_model=SearchResponse)
async def vault_search(request: SearchRequest):
    """
    Perform a semantic search across all document chunks in a vault.
    Returns ranked results with citations.
    """
    try:
        search_results = semantic_search(
            vault_id=request.vault_id,
            query=request.query,
            top_k=request.top_k or 10
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
            "query": request.query,
            "fallback": search_results.get("fallback", False)
        })
        
    except Exception as exc:
        logger.error(f"Search API Error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
