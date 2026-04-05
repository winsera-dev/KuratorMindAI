/**
 * KuratorMind AI — Typed API Client
 *
 * Centralised fetch wrapper for all backend endpoints.
 * All functions are typed end-to-end.
 */

import { 
  Case, 
  CaseDocument, 
  ChatMessage, 
  Citation,
  Claim,
  AuditFlag,
  GlobalEntity,
  EntityOccurrence,
  GeneratedOutput,
} from "@/types";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export type { 
  Case, 
  CaseDocument, 
  ChatMessage, 
  Citation,
  Claim,
};

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || 
  process.env.NEXT_PUBLIC_AGENT_API_URL || 
  "http://localhost:8000";

/**
 * Returns the Authorization header for the current Supabase session.
 * Must be called from client-side code only.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Response Types
export interface UploadResponse {
  message: string;
  document: CaseDocument;
}

export interface DocumentsResponse {
  documents: CaseDocument[];
  count: number;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

export interface SearchResponse {
  results: Array<{
    id: string;
    content: string;
    document_id: string;
    file_name: string;
    page_number?: number;
    similarity_score?: number;
  }>;
  count: number;
  query: string;
  fallback: boolean;
}

export interface StreamEvent {
  event: "agent_status" | "token" | "done" | "error";
  data: {
    text?: string;
    agent?: string;
    status?: string;
    message?: string;
    content?: string;
    agent_name?: string;
    citations?: Citation[];
    error?: string;
  };
}

// ---------------------------------------------------------------------------
// Cases API
// ---------------------------------------------------------------------------

/**
 * Fetch all cases for the current authenticated user.
 */
export async function getCases(): Promise<Case[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/cases`, { headers });
  if (!res.ok) throw new Error("Failed to fetch cases");
  const data = await res.json();
  return data.cases;
}

/**
 * Fetch a single case by ID.
 */
export async function getCase(caseId: string): Promise<Case> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/cases/${caseId}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch case");
  return res.json();
}

/**
 * Create a new forensic case.
 */
export async function createCase(caseData: Partial<Case>): Promise<Case> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/cases`, {
    method: "POST",
    headers,
    body: JSON.stringify(caseData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to create case");
  }
  return res.json();
}
/**
 * Update an existing forensic case.
 * Supports optimistic locking via expected_updated_at.
 */
export async function updateCase(
  caseId: string,
  updates: Partial<Case> & { expected_updated_at?: string }
): Promise<Case> {
  const headers = await getAuthHeaders();
  
  // If expected_updated_at is provided, the backend will verify it
  // to prevent concurrent update conflicts (412 Precondition Failed).
  const res = await fetch(`${BASE_URL}/api/v1/cases/${caseId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });

  if (res.status === 412) {
    throw new Error("CONCURRENCY_CONFLICT");
  }

  if (res.status === 428) {
    throw new Error("PRECONDITION_REQUIRED");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Update failed" }));
    throw new Error(err.detail ?? "Failed to update case");
  }
  return res.json();
}

/**
 * Delete a forensic case.
 */
export async function deleteCase(caseId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/cases/${caseId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete case");
}

/**
 * Get aggregated statistics for a case.
 */
export async function getCaseStats(caseId: string): Promise<{
  document_count: number;
  total_claims_idr: number;
  flag_count: number;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/cases/${caseId}/stats`, { headers });
  if (!res.ok) throw new Error("Failed to fetch case stats");
  return res.json();
}

// ---------------------------------------------------------------------------
// Documents API
// ---------------------------------------------------------------------------

/**
 * Upload a file to a case. Returns the created document record immediately.
 * Ingestion runs in the background — poll getDocuments() to track status.
 */
export async function uploadDocument(
  caseId: string,
  file: File,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("case_id", caseId);
  form.append("file", file);

  // For multipart/form-data we must NOT set Content-Type manually (browser sets boundary)
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(`${BASE_URL}/api/v1/documents/upload`, {
    method: "POST",
    headers: authHeaders,
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }

  return res.json() as Promise<UploadResponse>;
}

/**
 * List all documents in a case, ordered by most recent.
 * Includes forensic metadata (e.g., OCR confidence).
 */
export async function getDocuments(
  caseId: string,
): Promise<DocumentsResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/documents/${caseId}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch documents");
  const data = await res.json();
  
  // Ensure metadata is parsed if it comes as a string from some legacy paths
  const parsedDocs = data.documents.map((doc: any) => ({
    ...doc,
    metadata: typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata
  }));

  return { documents: parsedDocs, count: data.count };
}

/**
 * Delete a document and all its indexed chunks.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/documents/${documentId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

/**
 * Generate a signed URL for a document to view in the frontend.
 */
export async function getDocumentSignedUrl(documentId: string): Promise<{
  signed_url: string;
  file_name: string;
  file_type: string;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/documents/${documentId}/signed-url`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to get signed URL: ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Claims API
// ---------------------------------------------------------------------------

/**
 * Fetch all extracted claims for aSpecific case.
 */
export async function getClaims(caseId: string): Promise<{
  claims: Claim[];
  count: number;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/claims/${caseId}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch claims");
  return res.json();
}

/**
 * Update a claim's status or details (Manual override).
 */
export async function updateClaim(
  claimId: string,
  updates: Partial<Claim>,
): Promise<Claim> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/claims/${claimId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update claim");
  return res.json();
}

/**
 * Lists forensic red flags for a case.
 */
export async function getAuditFlags(
  caseId: string, 
  severity?: string, 
  resolved?: boolean
): Promise<{ flags: any[]; count: number }> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (severity) params.append("severity", severity);
  if (resolved !== undefined) params.append("resolved", String(resolved));
  
  const url = `${BASE_URL}/api/v1/audit/flags/${caseId}?${params.toString()}`;
  console.log(`[Forensic Agent] Fetching flags: ${url}`);
  
  const res = await fetch(url, { headers });
  console.log(`[Forensic Agent] Status: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "No error body");
    console.error(`[Forensic Agent] Audit API failed: ${res.status}`, errorBody);
    throw new Error(`Audit API failed: ${res.status} ${errorBody}`);
  }
  return res.json();
}

/**
 * Updates an audit flag's resolution status or notes.
 */
export async function updateAuditFlag(
  flagId: string, 
  updates: { resolved?: boolean; resolution?: string }
): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/audit/flags/${flagId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update audit flag");
  return res.json();
}

// ---------------------------------------------------------------------------
// Search API
// ---------------------------------------------------------------------------

/**
 * Perform a semantic search across a case's documents.
 */
export async function searchCase(
  caseId: string, 
  query: string, 
  topK: number = 10
): Promise<SearchResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ case_id: caseId, query, top_k: topK }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Search failed");
  }
  
  return res.json() as Promise<SearchResponse>;
}

/**
 * Global Regulatory Search
 * Searches the Global Legal & PSAK Case (ID: 0000...)
 */
export async function searchRegulations(query: string): Promise<SearchResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ 
      case_id: "00000000-0000-0000-0000-000000000000", 
      query, 
      top_k: 5 
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Regulatory search failed");
  }
  
  return res.json() as Promise<SearchResponse>;
}

/**
 * Generate Forensic Audit Report
 * Direct trigger for the Output Architect swarm.
 */
export async function generateForensicReport(caseId: string): Promise<{
    session_id: string;
    message: string;
    status: string;
}> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/v1/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            case_id: caseId,
            message: "Generate a consolidated Forensic Audit Report for this case. Summarize all findings, claims, and financial anomalies.",
            agent_override: "output_architect" 
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Report generation failed");
    }
    
    return res.json();
}

// ---------------------------------------------------------------------------
// Outputs API
// ---------------------------------------------------------------------------

/**
 * Fetch all generated documents for a case.
 */
export async function getGeneratedOutputs(
  caseId: string
): Promise<GeneratedOutput[]> {
  const { data, error } = await supabase
    .from("generated_outputs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as GeneratedOutput[]) || [];
}

/**
 * Trigger the Output Architect to generate a new report.
 * Uses the Chat API internally with the output_architect override.
 */
export async function generateReport(
  caseId: string,
  type: string,
  title: string
): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      case_id: caseId,
      message: `Generate a professional ${type} with the title '${title}'. Consolidate all forensic findings, claims, and financial anomalies.`,
      agent_override: "output_architect"
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const errorMessage = typeof err.detail === "string" 
      ? err.detail 
      : JSON.stringify(err.detail);
    throw new Error(errorMessage ?? "Report generation failed");
  }

  return { success: true, message: "Generation started" };
}

/**
 * Polls for a new report creation.
 * Since the Output Architect saves to the DB after generation,
 * we poll for a record with a recent created_at timestamp.
 */
export async function waitForReport(
  caseId: string,
  type: string,
  timeoutMs: number = 60000
): Promise<GeneratedOutput> {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < timeoutMs) {
    const { data, error } = await supabase
      .from("generated_outputs")
      .select("*")
      .eq("case_id", caseId)
      .eq("output_type", type)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // If it's created in the last 2 minutes, assume it's our new one
    if (data) {
      const createdAt = new Date(data.created_at).getTime();
      if (Date.now() - createdAt < 120000) {
        return data as GeneratedOutput;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Report generation timed out. Please check the list in a moment.");
}

/**
 * Generate a signed URL for a generated output (PDF).
 */
export async function getOutputSignedUrl(caseId: string, filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("case-files")
    .createSignedUrl(filePath, 3600); // 1 hour

  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Chat API — SSE streaming
// ---------------------------------------------------------------------------

/**
 * Send a chat message and stream the response via SSE.
 */
export async function streamChat(
  request: {
    case_id: string;
    session_id: string;
    message: string;
    user_id?: string;
    agent_override?: string;
  },
  callbacks: {
    onToken: (text: string) => void;
    onStatus?: (agent: string, message: string, confidence?: number) => void;
    onDone?: (content: string, citations: Citation[]) => void;
    onError?: (error: string) => void;
  },
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (res.status === 429) {
    if (callbacks.onError) {
      callbacks.onError("Rate limit exceeded. Please wait a moment before trying again.");
    }
    throw new Error("Rate limit exceeded");
  }

  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // Keep incomplete last line

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === "token" && data.text) {
            callbacks.onToken(data.text);
          } else if (currentEvent === "agent_status" && callbacks.onStatus) {
            callbacks.onStatus(data.agent ?? "", data.message ?? "", data.confidence);
          } else if (currentEvent === "done" && callbacks.onDone) {
            callbacks.onDone(data.content ?? "", data.citations ?? []);
          } else if (currentEvent === "error" && callbacks.onError) {
            callbacks.onError(data.error ?? "Unknown error");
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  }
}

/**
 * Fetch the full message history for a chat session.
 */
export async function getChatHistory(
  sessionId: string,
): Promise<ChatHistoryResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/v1/chat/history/${sessionId}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch chat history");
  return res.json() as Promise<ChatHistoryResponse>;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/**
 * Check backend health through the Next.js API proxy (if using one) or directly.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "healthy";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Phase 1D: Cross-Case Intelligence
// ---------------------------------------------------------------------------

export async function getGlobalConflicts(caseId: string): Promise<{
  conflicts: AuditFlag[];
  entities: any[];
  totalCases: number;
}> {
  // 0. Fetch total case count for the user (for UI guard rails)
  const { count: caseCount, error: countErr } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true });

  if (countErr) {
     console.error("Error fetching case count:", countErr);
  }
  const totalCases = caseCount || 0;

  // 1. Fetch conflict flags (Systemic Risks)
  const { data: flags, error: flagErr } = await supabase
    .from("audit_flags")
    .select("*")
    .or("flag_type.eq.contradiction,flag_type.eq.entity_duplicate,flag_type.eq.inflated_claim")
    .eq("case_id", caseId);

  if (flagErr) throw flagErr;

  // 2. Fetch entities found in THIS case
  const { data: localOccurrences, error: occErr } = await supabase
    .from("entity_occurrences")
    .select(`
      entity_id,
      global_entities (*)
    `)
    .eq("case_id", caseId);

  if (occErr) throw occErr;

  if (!localOccurrences || localOccurrences.length === 0) {
    return { 
      conflicts: (flags as AuditFlag[]) || [], 
      entities: [],
      totalCases
    };
  }

  // 3. For each entity, fetch ALL its occurrences to see other cases
  const entityIds = localOccurrences.map(o => o.entity_id);
  const { data: allOccurrences, error: allOccErr } = await supabase
    .from("entity_occurrences")
    .select(`
      entity_id,
      case_id,
      source_type,
      cases (name)
    `)
    .in("entity_id", entityIds);

  if (allOccErr) throw allOccErr;

  // 4. Map everything together
  const enrichedEntities = localOccurrences.map(local => {
    const entity = local.global_entities as any;
    const occurrences = allOccurrences
      .filter(o => o.entity_id === local.entity_id)
      .map(o => ({
        case_id: o.case_id,
        case_name: (o.cases as any)?.name,
        source_type: o.source_type
      }));
    
    return {
      ...entity,
      occurrences,
      occurrence_count: occurrences.length
    };
  });

  // Filter only those that appear in multiple cases (actual overlaps)
  const overlappingEntities = enrichedEntities.filter(e => e.occurrence_count > 1);

  return {
    conflicts: (flags as AuditFlag[]) || [],
    entities: overlappingEntities,
    totalCases
  };
}
