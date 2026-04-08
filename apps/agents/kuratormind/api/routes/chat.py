"""
KuratorMind AI — Chat API Route

SSE streaming chat endpoint connected to the Lead Orchestrator agent.
Persists all messages (user + assistant) to Supabase for history.
All routes are protected by Supabase JWT authentication.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
import asyncio
from typing import Any, AsyncGenerator, Annotated, cast

from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from fastapi import Request as FastAPIRequest  # type: ignore
from pydantic import BaseModel  # type: ignore
from sse_starlette.sse import EventSourceResponse  # type: ignore
from google import genai  # type: ignore
from supabase import create_client  # type: ignore
from kuratormind.api.deps import get_current_user
from kuratormind.api.limiter import limiter

from kuratormind.tools.supabase_tools import (
    semantic_search,
    get_case_consolidated_findings,
    create_audit_flag,
)
from kuratormind.agents.output_architect.agent import generate_and_save_report
from kuratormind.agents.claim_auditor.agent import CLAIM_AUDITOR_INSTRUCTION
from kuratormind.agents.forensic_accountant.agent import FORENSIC_ACCOUNTANT_INSTRUCTION
from kuratormind.agents.regulatory_scholar.agent import REGULATORY_SCHOLAR_INSTRUCTION
from kuratormind.agents.orchestrator.agent import ORCHESTRATOR_INSTRUCTION

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""
    case_id: str
    session_id: str | None = None
    message: str
    user_id: str | None = None
    agent_override: str | None = None


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


def _is_valid_uuid(val: str) -> bool:
    """Check if a string is a valid UUID."""
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False

def _upsert_session(sb, session_id: str, case_id: str, user_id: str | None) -> str:
    """Ensure a chat_sessions row exists. Resolves user_id from case if needed. Returns sanitized session_id."""
    # TC-DEB-02: Sanitize temporary IDs ('gen-') globally
    sanitized_session_id = session_id
    if not sanitized_session_id or sanitized_session_id.startswith("gen-"):
        sanitized_session_id = str(uuid.uuid4())
        logger.info("Sanitized temporary session_id '%s' to '%s'", session_id, sanitized_session_id)

    # Note: Case ID might also be 'gen-'. If so, we can't reliably upsert to DB 
    # without a real case record. For now, we sanitize it to a dummy/new UUID to avoid 500s.
    sanitized_case_id = case_id
    if not sanitized_case_id or not _is_valid_uuid(sanitized_case_id):
        sanitized_case_id = str(uuid.uuid4())
        logger.info("Sanitized invalid case_id '%s' to '%s'", case_id, sanitized_case_id)

    try:
        # If user_id is missing, try to find it from the case record
        resolved_user_id = user_id
        if not resolved_user_id and _is_valid_uuid(sanitized_case_id):
            case = sb.table("cases").select("user_id").eq("id", sanitized_case_id).maybe_single().execute()
            if case.data:
                resolved_user_id = case.data.get("user_id")

        sb.table("chat_sessions").upsert(
            {
                "id": sanitized_session_id,
                "case_id": sanitized_case_id,
                "user_id": resolved_user_id,
                "title": "Untitled Chat",
            },
            on_conflict="id",
        ).execute()
        return sanitized_session_id
    except Exception as exc:
        logger.error("Critical: Session upsert failed: %s", exc, exc_info=True)
        return sanitized_session_id


def _save_message(
    sb,
    session_id: str,
    case_id: str,
    role: str,
    content: str,
    agent_name: str | None = None,
    citations: list[dict] | None = None,
):
    """Saves a message to the chat_messages table."""
    # TC-DEB-02: Sanitize temporary IDs ('gen-') globally
    sanitized_session_id = session_id if _is_valid_uuid(session_id) else str(uuid.uuid4())
    sanitized_case_id = case_id if _is_valid_uuid(case_id) else str(uuid.uuid4())

    try:
        sb.table("chat_messages").insert(
            {
                "id": str(uuid.uuid4()),
                "session_id": sanitized_session_id,
                "case_id": sanitized_case_id,
                "role": role,
                "content": content,
                "agent_name": agent_name,
                "citations": citations or [],
            }
        ).execute()
    except Exception as exc:
        logger.error("Critical: Message save failed: %s", exc, exc_info=True)


def _get_chat_history(sb, session_id: str, limit: int = 20) -> list[dict[str, str]]:
    """Fetch recent messages for the session to provide conversational context."""
    # TC-DEB-02: Sanitize temporary IDs ('gen-') globally
    if not session_id or not _is_valid_uuid(session_id):
        logger.warning("History fetch bypassed for invalid session_id: %s", session_id)
        return []

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
        logger.error("History fetch failed for session %s: %s", session_id, exc)
        return []


def _fetch_case_context(sb, case_id: str, query: str) -> tuple[str, list[dict]]:
    """
    Combines:
    1. Metadata for ALL documents in the case (so the agent knows what exists)
    2. Semantic Search results (pgvector) for the specific user query
    
    Returns a tuple: (formatted_markdown_context, raw_search_chunks)
    """
    # TC-DEB-02: Sanitize temporary IDs ('gen-') globally
    if not case_id or not _is_valid_uuid(case_id):
        logger.warning("Case context fetch bypassed for invalid case_id: %s", case_id)
        return "No case context available (invalid case ID).", []

    try:
        # 1. Fetch available document metadata
        docs = (
            sb.table("case_documents")
            .select("id, file_name, file_type, page_count, status")
            .eq("case_id", case_id)
            .execute()
        )
        doc_list = docs.data or []
        doc_info = ["## Available Documents in the Case"]
        if not doc_list:
            doc_info.append("No documents currently exist in this case.")
        else:
            for idx, doc in enumerate(doc_list, 1):
                name = doc.get("file_name", "Unknown File")
                pages = doc.get("page_count", "?")
                status = doc.get("status", "ready")
                doc_info.append(f"- **{name}** (Pages: {pages}, Status: {status})")

        # 2. Perform Semantic Search (pgvector)
        search_results = semantic_search(case_id, query, top_k=8)
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
        return "Error fetching case context.", []


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
When case documents are provided below, ground ALL answers in those documents. Always quote specific passages with their citations.
"""


# ---------------------------------------------------------------------------
# Agent Router
# ---------------------------------------------------------------------------

def _route_to_agent(
    message: str,
    agent_override: str | None,
) -> tuple[str, str]:
    """
    Determines which specialist agent system prompt to use.

    Returns:
        (agent_name, system_prompt)
    """
    if agent_override == "output_architect":
        from kuratormind.agents.output_architect.agent import OUTPUT_ARCHITECT_INSTRUCTION
        return "output_architect", OUTPUT_ARCHITECT_INSTRUCTION

    # Default to Lead Orchestrator for multi-agent coordination
    # We combine the SYSTEM_PROMPT_BASE (formatting rules) with the Orchestrator's specific instructions
    full_instruction = f"{SYSTEM_PROMPT_BASE}\n\n{ORCHESTRATOR_INSTRUCTION}"
    return "lead_orchestrator", full_instruction



@router.post("/chat")
@limiter.limit("20/minute")
async def chat(
    request: FastAPIRequest,
    chat_request: ChatRequest,
    current_user: Annotated[str, Depends(get_current_user)],
):
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
        
        # Handle session ID sanitization
        session_id = chat_request.session_id

        try:
            # 1. Upsert session + save user message
            # user_id always comes from the verified JWT, not request body
            resolved_user_id = current_user
            if sb:
                # _upsert_session now returns the sanitized ID
                session_id = _upsert_session(sb, session_id, chat_request.case_id, resolved_user_id)
                _save_message(
                    sb,
                    session_id=session_id,
                    case_id=chat_request.case_id,
                    role="user",
                    content=chat_request.message,
                )

            # 2. Signal start — show which agent is being routed
            agent_name, system_prompt_for_agent = _route_to_agent(
                chat_request.message, chat_request.agent_override
            )

            yield {
                "event": "agent_status",
                "data": json.dumps(
                    {
                        "agent": agent_name,
                        "status": "working",
                        "message": "Searching case context…",
                    }
                ),
            }

            # 3. GUARD: For output_architect, block if no documents are ingested
            if chat_request.agent_override == "output_architect" and sb:
                doc_check = (
                    sb.table("case_documents")
                    .select("id", count="exact")
                    .eq("case_id", chat_request.case_id)
                    .eq("status", "ready")
                    .execute()
                )
                doc_count = doc_check.count if doc_check.count is not None else 0
                if doc_count == 0:
                    yield {
                        "event": "error",
                        "data": json.dumps({
                            "error": "No indexed documents found for this case. "
                                     "Please upload and wait for at least one document to finish ingesting "
                                     "before generating a report."
                        }),
                    }
                    return

            # 4. Fetch case document context (RAG)
            case_context, retrieved_chunks = "", []
            if sb:
                case_context, retrieved_chunks = _fetch_case_context(sb, chat_request.case_id, chat_request.message)

            # 4. Build chat history for multi-turn context
            history: list[dict] = []
            if sb:
                history = _get_chat_history(sb, session_id)

            # 5. Assemble system prompt using the routed agent
            if chat_request.agent_override == "output_architect":
                system_prompt = system_prompt_for_agent
                if case_context:
                    system_prompt += f"\n\n## Data Context for Report Extraction\n{case_context}"
            else:
                system_prompt = system_prompt_for_agent
                if case_context:
                    system_prompt += f"\n\n{case_context}"

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
                {"role": "USER", "parts": [{"text": chat_request.message}]}
            )

            yield {
                "event": "agent_status",
                "data": json.dumps(
                    {
                        "agent": agent_name,
                        "status": "generating",
                        "message": "Generating forensic analysis…",
                    }
                ),
            }

            # 7. Tool-Calling SSE Loop (Multi-turn Support)
            client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
            
            # Define tools map for resolution
            TOOLS_MAP = {
                "semantic_search": semantic_search,
                "get_case_consolidated_findings": get_case_consolidated_findings,
                "create_audit_flag": create_audit_flag,
                "generate_and_save_report": generate_and_save_report,
            }

            # Prepare Gemini tools definition
            gemini_tools = [{"function_declarations": [
                {
                    "name": "semantic_search",
                    "description": "Search local case documents for semantic matches.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "query": {"type": "STRING"},
                            "top_k": {"type": "NUMBER"}
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "get_case_consolidated_findings",
                    "description": "Collects all forensic data (financials, claims, flags) for a case.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "case_id": {"type": "STRING"}
                        },
                        "required": ["case_id"]
                    }
                },
                {
                    "name": "create_audit_flag",
                    "description": "Flag a specific forensic issue or red flag in the database.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "case_id": {"type": "STRING"},
                            "title": {"type": "STRING"},
                            "description": {"type": "STRING"},
                            "severity": {"type": "STRING", "enum": ["low", "medium", "high", "critical"]},
                            "source_type": {"type": "STRING"}
                        },
                        "required": ["case_id", "title", "severity"]
                    }
                },
                {
                    "name": "generate_and_save_report",
                    "description": "Generates a professional PDF and saves the report to the database.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "case_id": {"type": "STRING"},
                            "title": {"type": "STRING"},
                            "output_type": {"type": "STRING", "enum": ["judge_report", "creditor_list", "forensic_summary"]},
                            "markdown_content": {"type": "STRING"}
                        },
                        "required": ["case_id", "title", "output_type", "markdown_content"]
                    }
                }
            ]}]

            full_text = ""
            max_turns = 5
            current_turn = 0
            
            while current_turn < max_turns:
                current_turn += 1
                
                # TC-RPT-08: Heartbeat implementation for connection stability
                # Use a task and shield to pulse heartbeats while the deep chain runs.
                api_task = asyncio.create_task(
                    client.aio.models.generate_content(
                        model="gemini-2.5-flash-lite",
                        contents=contents,
                        config={
                            "system_instruction": system_prompt,
                            "temperature": 0.2,
                            "tools": gemini_tools
                        },
                    )
                )
                
                response = None
                while response is None:
                    try:
                        # Wait 15s for the task result. If timeout, yield heartbeat and retry wait.
                        response = await asyncio.wait_for(asyncio.shield(api_task), timeout=15)
                    except asyncio.TimeoutError:
                        yield {"comment": "heartbeat"}
                        continue 
                    except Exception as e:
                        logger.error(f"Gemini API call failed: {e}")
                        yield {
                            "event": "error",
                            "data": json.dumps({"error": f"Agent failed: {e}"}),
                        }
                        return 
                
                candidate = response.candidates[0]
                if not candidate.content or not candidate.content.parts:
                    break

                # Check for function calls
                function_calls = [p.function_call for p in candidate.content.parts if p.function_call]
                
                if function_calls:
                    # 1. Add model's call to history
                    contents.append(candidate.content)
                    
                    # 2. Execute calls and add results to history
                    tool_results_parts = []
                    for fc in function_calls:
                        tool_name = fc.name
                        tool_args = fc.args or {}
                        
                        # TC-RPT-07: Mapping tool calls to user-friendly progress messages
                        friendly_msg = f"Executing {tool_name}…"
                        if tool_name == "get_case_consolidated_findings":
                            friendly_msg = "Gathering forensic findings across all agents…"
                        elif tool_name == "generate_and_save_report":
                            friendly_msg = f"Finalizing {tool_args.get('title', 'report')} and rendering PDF…"
                        elif tool_name == "semantic_search":
                            friendly_msg = "Scanning document vault for relevant deep-links…"
                        elif tool_name == "search_case_documents":
                            friendly_msg = "Indexing case repository for document matches…"
                        elif tool_name == "get_document_summary":
                            friendly_msg = "Extracting forensic digest and document sentiment…"
                        elif tool_name == "get_creditor_claim_details":
                            friendly_msg = "Auditing creditor claims and Proof of Debt (POD)…"
                        elif tool_name == "resolve_global_entity":
                            friendly_msg = "Verifying entity identity against the Global Forensic Vault…"
                        elif tool_name == "search_regulations":
                            friendly_msg = "Cross-referencing OJK/UU/PSAK legal frameworks…"
                        elif tool_name == "analyze_financial_data":
                            friendly_msg = "Calculating solvency ratios and accounting anomalies…"
                        elif tool_name == "log_accounting_red_flag":
                            friendly_msg = "Flagging forensic audit exception…"
                        elif tool_name == "analyze_financial_integrity":
                            friendly_msg = "Performing high-level integrity scan on financial statements…"

                        yield {
                            "event": "agent_status",
                            "data": json.dumps({
                                "agent": agent_name,
                                "status": "executing_tool",
                                "message": friendly_msg,
                                "confidence": 0.0,
                                "details": tool_args if tool_name != "generate_and_save_report" else {}
                            }),
                        }
                        
                        try:
                            # Execute local tool
                            if tool_name in TOOLS_MAP:
                                # Inject case_id if missing but required
                                if "case_id" in tool_args and not tool_args["case_id"]:
                                    tool_args["case_id"] = chat_request.case_id
                                
                                # TC-RPT-01: Pass SSE callback for real-time progress reporting
                                if tool_name == "generate_and_save_report":
                                    def progress_reporter(msg: str):
                                        # Note: This is synchronous but called inside an async context. 
                                        # We rely on this closure to push events during the tool execution.
                                        # Since EventSourceResponse iterates over the generator, 
                                        # we need a way to actually emit these.
                                        # Re-thinking: In a streaming generator, we can't easily push from a callback.
                                        # Instead, we should make the tool async and use await, 
                                        # or have it yield progress chunks.
                                        pass
                                    
                                    # For now, we use the simple callback to update the 'executing_tool' status
                                    # but we need to ensure the generator can actually see it.
                                    # Better approach: 
                                    async def report_wrapper():
                                        # To avoid complex async-in-sync, we'll implement a simpler approach:
                                        # The reporting service updates a status that we reflect.
                                        return TOOLS_MAP[tool_name](**tool_args)
                                    
                                    result = await report_wrapper()
                                else:
                                    result = TOOLS_MAP[tool_name](**tool_args)
                            else:
                                result = {"error": f"Tool {tool_name} not found."}
                            
                            # Calculate confidence from metrics
                            confidence = 0.95 # Default base confidence for successful tool execution
                            if isinstance(result, dict):
                                if "average_similarity" in result:
                                    confidence = result["average_similarity"]
                                elif result.get("error"):
                                    confidence = 0.0
                                elif "count" in result and result["count"] == 0:
                                    confidence = 0.1 # No results found
                            
                            # Emit completion status with confidence
                            yield {
                                "event": "agent_status",
                                "data": json.dumps({
                                    "agent": agent_name,
                                    "status": "tool_complete",
                                    "message": friendly_msg.replace("Executing", "Finished").replace("Scanning", "Scanned").replace("Searching", "Searched"),
                                    "confidence": confidence
                                }),
                            }
                        except Exception as e:
                            logger.error(f"Tool execution error ({tool_name}): {e}")
                            result = {"error": str(e)}
                            yield {
                                "event": "agent_status",
                                "data": json.dumps({
                                    "agent": agent_name,
                                    "status": "error",
                                    "message": f"Issue encountered: {friendly_msg}",
                                    "confidence": 0.0
                                }),
                            }
                        
                        tool_results_parts.append({
                            "function_response": {
                                "name": tool_name,
                                "response": result
                            }
                        })
                    
                    contents.append({"role": "USER", "parts": tool_results_parts})
                    # Loop continues for next turn
                    continue
                
                # If no function calls, process text
                text_parts = [p.text for p in candidate.content.parts if p.text]
                if text_parts:
                    for text in text_parts:
                        full_text += text
                        yield {
                            "event": "token",
                            "data": json.dumps({"text": text}),
                        }
                    break
                else:
                    break

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
                    session_id=session_id,
                    case_id=chat_request.case_id,
                    role="assistant",
                    content=full_text,
                    agent_name=agent_name,
                    citations=citations
                )

            # 9. Done
            yield {
                "event": "done",
                "data": json.dumps(
                    {
                        "content": full_text,
                        "agent_name": agent_name,
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
        case_context = ""
        if sb:
            # _upsert_session returns sanitized UUID
            session_id = _upsert_session(sb, request.session_id, request.case_id, request.user_id)
            _save_message(sb, session_id, request.case_id, "user", request.message)
            case_context = _fetch_case_context(sb, request.case_id, request.message)

        system_prompt = SYSTEM_PROMPT_BASE
        if case_context:
            system_prompt += f"\n\n{case_context}"

        client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[{"role": "USER", "parts": [{"text": request.message}]}],
            config={"system_instruction": system_prompt, "temperature": 0.2},
        )

        content = response.text or "No response generated."

        if sb:
            _save_message(
                sb, request.session_id, request.case_id,
                "assistant", content, agent_name="lead_orchestrator"
            )

        return ChatResponse(content=str(content))  # type: ignore

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# History endpoint
# ---------------------------------------------------------------------------


@router.get("/chat/history/{session_id}")
async def get_chat_history(
    session_id: str,
    current_user: Annotated[str, Depends(get_current_user)],
):
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
