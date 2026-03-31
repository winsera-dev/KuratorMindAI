"""
KuratorMind AI — Chat API Route

SSE streaming chat endpoint connected to the Lead Orchestrator agent.
Persists all messages (user + assistant) to Supabase for history.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any, AsyncGenerator, cast

from fastapi import APIRouter, HTTPException  # type: ignore
from pydantic import BaseModel  # type: ignore
from sse_starlette.sse import EventSourceResponse  # type: ignore
from google import genai  # type: ignore
from supabase import create_client  # type: ignore
from kuratormind.tools.supabase_tools import semantic_search  # type: ignore

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""
    vault_id: str
    session_id: str
    message: str
    user_id: str | None = None


class ChatResponse(BaseModel):
    """Non-streaming chat response."""
    content: str
    citations: list[dict] = []
    agent_name: str = "lead_orchestrator"


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------


def _get_supabase():
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return None
    return create_client(url, key)


def _upsert_session(sb, session_id: str, vault_id: str, user_id: str | None) -> None:
    """Ensure a chat_sessions row exists. Resolves user_id from vault if needed."""
    try:
        # If user_id is missing, try to find it from the vault record
        resolved_user_id = user_id
        if not resolved_user_id:
            vault = sb.table("vaults").select("user_id").eq("id", vault_id).maybe_single().execute()
            if vault.data:
                resolved_user_id = vault.data.get("user_id")

        sb.table("chat_sessions").upsert(
            {
                "id": session_id,
                "vault_id": vault_id,
                "user_id": resolved_user_id,
                "title": "Untitled Chat",
            },
            on_conflict="id",
        ).execute()
    except Exception as exc:
        logger.error("Critical: Session upsert failed: %s", exc, exc_info=True)


def _save_message(
    sb,
    session_id: str,
    vault_id: str,
    role: str,
    content: str,
    citations: list[dict] | None = None,
    agent_name: str | None = None,
) -> None:
    """Persist a chat message to Supabase."""
    try:
        sb.table("chat_messages").insert(
            {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "role": role,
                "content": content,
                "citations": citations or [],
                "agent_name": agent_name,
            }
        ).execute()
    except Exception as exc:
        logger.error("Critical: Message save failed: %s", exc, exc_info=True)


def _get_chat_history(sb, session_id: str, limit: int = 20) -> list[dict[str, str]]:
    """Fetch recent messages for the session to provide conversational context."""
    try:
        result = (
            sb.table("chat_messages")
            .select("role, content, citations, agent_name")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        # Reverse to chronological order
        raw: list[dict[str, Any]] = result.data or []
        return list(reversed(raw))
    except Exception as exc:
        logger.error("History fetch failed: %s", exc)
        return []


def _fetch_vault_context(sb, vault_id: str, query: str) -> tuple[str, list[dict]]:
    """
    Combines:
    1. Metadata for ALL documents in the vault (so the agent knows what exists)
    2. Semantic Search results (pgvector) for the specific user query
    
    Returns a tuple: (formatted_markdown_context, raw_search_chunks)
    """
    try:
        # 1. Fetch available document metadata
        docs = (
            sb.table("vault_documents")
            .select("id, file_name, file_type, page_count, status")
            .eq("vault_id", vault_id)
            .execute()
        )
        doc_list = docs.data or []
        doc_info = ["## Available Documents in the Vault"]
        if not doc_list:
            doc_info.append("No documents currently exist in this vault.")
        else:
            for idx, doc in enumerate(doc_list, 1):
                name = doc.get("file_name", "Unknown File")
                pages = doc.get("page_count", "?")
                status = doc.get("status", "ready")
                doc_info.append(f"- **{name}** (Pages: {pages}, Status: {status})")

        # 2. Perform Semantic Search (pgvector)
        search_results = semantic_search(vault_id, query, top_k=8)
        chunks = search_results.get("results", [])
        
        rag_lines = ["\n## Relevant Document Excerpts (Context)"]
        if not chunks:
            rag_lines.append("No relevant document segments found for semantic search.")
        else:
            rag_lines.append("Use the following excerpts to answer. Cite them using the record number in brackets, e.g. [1], [2].")
            for idx, chunk in enumerate(chunks, 1):
                file_name = chunk.get("file_name", "Unknown")
                page = chunk.get("page_number", "?")
                content = chunk.get("content", "").replace("\n", " ").strip()
                rag_lines.append(f"SOURCE [{idx}]: {file_name}, p.{page}\n{content}\n")

        full_context = "\n".join(doc_info + rag_lines)
        return full_context, chunks

    except Exception as exc:
        logging.error("Context fetch error: %s", exc)
        return "Error fetching vault context.", []


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_BASE = """You are KuratorMind AI, a forensic AI assistant for Indonesian Kurators (Bankruptcy Receivers).

## Core Directives
1. ALWAYS cite sources — Every factual claim must reference the provided context using the source number in brackets: [1], [2], etc.
2. NEVER hallucinate — If information is not in the provided context, say: "Informasi ini tidak ditemukan dalam dokumen yang diunggah."
3. STRICT LANGUAGE ALIGNMENT — You MUST identify the language used in the user's prompt and respond ONLY in that exact language. If the user writes in English, ALL output must be in English. If they write in Indonesian, ALL output must be in Indonesian. Do not mix languages.
4. Think forensically — Actively look for contradictions, inconsistencies, and red flags.

## Domain Knowledge
- UU No. 37/2004 (Kepailitan dan PKPU) governs all bankruptcy procedures
- Creditor priority: State taxes/wages → Secured → Preferential → Concurrent
- Double Majority: >50% creditors AND ≥2/3 total debt value for voting  
- Actio Pauliana: Transfers within 1 year before bankruptcy can be challenged
- PSAK/IFRS: Indonesian accounting standards apply

## Instructions
When vault documents are provided below, ground ALL answers in those documents. Always quote specific passages with their citations.
"""


# ---------------------------------------------------------------------------
# Streaming endpoint
# ---------------------------------------------------------------------------


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Send a message and receive a Server-Sent Events (SSE) stream.

    Event types:
    - agent_status: Which agent is working and what it's doing
    - token: Individual text chunks as they stream
    - done: Final event with full content + citation list
    - error: Error event if something went wrong
    """

    async def generate() -> AsyncGenerator[dict, None]:
        sb = _get_supabase()

        try:
            # 1. Upsert session + save user message
            if sb:
                _upsert_session(sb, request.session_id, request.vault_id, request.user_id)
                _save_message(
                    sb,
                    session_id=request.session_id,
                    vault_id=request.vault_id,
                    role="user",
                    content=request.message,
                )

            # 2. Signal start
            yield {
                "event": "agent_status",
                "data": json.dumps(
                    {
                        "agent": "lead_orchestrator",
                        "status": "working",
                        "message": "Searching vault context…",
                    }
                ),
            }

            # 3. Fetch vault document context (RAG)
            vault_context, retrieved_chunks = "", []
            if sb:
                vault_context, retrieved_chunks = _fetch_vault_context(sb, request.vault_id, request.message)

            # 4. Build chat history for multi-turn context
            history: list[dict] = []
            if sb:
                history = _get_chat_history(sb, request.session_id)

            # 5. Assemble system prompt
            system_prompt = SYSTEM_PROMPT_BASE
            if vault_context:
                system_prompt += f"\n\n{vault_context}"

            # 6. Build contents list (history + current message)
            contents: list[dict] = []
            # Exclude the last message (the user one we just saved) to avoid duplication
            history_window: list[dict[str, str]] = cast(
                list[dict[str, str]],
                history[: max(0, len(history) - 1)],
            )
            for msg in history_window:
                raw_role: str = msg.get("role", "user")
                # Map database roles ('user'/'assistant') to Gemini roles ('USER'/'MODEL')
                role = "USER" if raw_role == "user" else "MODEL"
                contents.append(
                    {"role": role, "parts": [{"text": msg["content"]}]}
                )
            contents.append(
                {"role": "USER", "parts": [{"text": request.message}]}
            )

            yield {
                "event": "agent_status",
                "data": json.dumps(
                    {
                        "agent": "lead_orchestrator",
                        "status": "generating",
                        "message": "Generating forensic analysis…",
                    }
                ),
            }

            # 7. Stream from Gemini
            client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
            response = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=contents,
                config={
                    "system_instruction": system_prompt,
                    "temperature": 0.2,
                },
            )

            full_text = ""
            for chunk in response:
                if chunk.text:
                    full_text += chunk.text
                    yield {
                        "event": "token",
                        "data": json.dumps({"text": chunk.text}),
                    }

            # 8. Save assistant response to DB
            citations = []
            if full_text:
                # Extract citation indices [1], [2] from text
                import re
                found_indices = set(re.findall(r"\[(\d+)\]", full_text))
                for idx_str in found_indices:
                    idx = int(idx_str) - 1 # Convert to 0-based index
                    if 0 <= idx < len(retrieved_chunks):
                        chunk = retrieved_chunks[idx]
                        citations.append({
                            "chunk_id": chunk.get("id"),
                            "document_id": chunk.get("document_id"),
                            "page": chunk.get("page_number"),
                            "text_snippet": chunk.get("content"),
                            "file_name": chunk.get("file_name")
                        })

            if sb and full_text:
                _save_message(
                    sb,
                    session_id=request.session_id,
                    vault_id=request.vault_id,
                    role="assistant",
                    content=full_text,
                    agent_name="lead_orchestrator",
                    citations=citations
                )

            # 9. Done
            yield {
                "event": "done",
                "data": json.dumps(
                    {
                        "content": full_text,
                        "agent_name": "lead_orchestrator",
                        "citations": citations,
                    }
                ),
            }

        except Exception as exc:
            logger.error("Chat stream error: %s", exc, exc_info=True)
            yield {
                "event": "error",
                "data": json.dumps({"error": str(exc)}),
            }

    return EventSourceResponse(generate())


# ---------------------------------------------------------------------------
# Sync endpoint (for simpler integrations / testing)
# ---------------------------------------------------------------------------


@router.post("/chat/sync")
async def chat_sync(request: ChatRequest) -> ChatResponse:
    """Non-streaming chat. Returns the full response at once."""
    try:
        sb = _get_supabase()
        vault_context = ""
        if sb:
            _upsert_session(sb, request.session_id, request.vault_id, request.user_id)
            _save_message(sb, request.session_id, request.vault_id, "user", request.message)
            vault_context = _fetch_vault_context(sb, request.vault_id, request.message)

        system_prompt = SYSTEM_PROMPT_BASE
        if vault_context:
            system_prompt += f"\n\n{vault_context}"

        client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-04-17",
            contents=[{"role": "USER", "parts": [{"text": request.message}]}],
            config={"system_instruction": system_prompt, "temperature": 0.2},
        )

        content = response.text or "No response generated."

        if sb:
            _save_message(
                sb, request.session_id, request.vault_id,
                "assistant", content, agent_name="lead_orchestrator"
            )

        return ChatResponse(content=str(content))  # type: ignore

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# History endpoint
# ---------------------------------------------------------------------------


@router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """Retrieve the full message history for a chat session."""
    sb = _get_supabase()
    if not sb:
        return {"messages": []}
    try:
        result = (
            sb.table("chat_messages")
            .select("id, role, content, agent_name, citations, created_at")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        return {"messages": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
