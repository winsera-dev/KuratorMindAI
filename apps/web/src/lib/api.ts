/**
 * KuratorMind AI — Typed API Client
 *
 * Centralised fetch wrapper for all backend endpoints.
 * All functions are typed end-to-end.
 */

import { 
  Vault, 
  VaultDocument, 
  ChatMessage, 
  Citation,
  Claim,
} from "@/types";

export type { 
  Vault, 
  VaultDocument, 
  ChatMessage, 
  Citation,
  Claim,
};

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || 
  process.env.NEXT_PUBLIC_AGENT_API_URL || 
  "http://localhost:8000";

// Response Types
export interface UploadResponse {
  message: string;
  document: VaultDocument;
}

export interface DocumentsResponse {
  documents: VaultDocument[];
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
// Vaults API
// ---------------------------------------------------------------------------

/**
 * Fetch all vaults for the current authenticated user.
 */
export async function getVaults(): Promise<Vault[]> {
  const res = await fetch(`${BASE_URL}/api/v1/vaults`);
  if (!res.ok) throw new Error("Failed to fetch vaults");
  const data = await res.json();
  return data.vaults;
}

/**
 * Create a new forensic vault.
 */
export async function createVault(vault: Partial<Vault>): Promise<Vault> {
  const res = await fetch(`${BASE_URL}/api/v1/vaults`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vault),
  });
  if (!res.ok) throw new Error("Failed to create vault");
  return res.json();
}

/**
 * Get aggregated statistics for a vault.
 */
export async function getVaultStats(vaultId: string): Promise<{
  document_count: number;
  total_claims_idr: number;
  flag_count: number;
}> {
  const res = await fetch(`${BASE_URL}/api/v1/vaults/${vaultId}/stats`);
  if (!res.ok) throw new Error("Failed to fetch vault stats");
  return res.json();
}

// ---------------------------------------------------------------------------
// Documents API
// ---------------------------------------------------------------------------

/**
 * Upload a file to a vault. Returns the created document record immediately.
 * Ingestion runs in the background — poll getDocuments() to track status.
 */
export async function uploadDocument(
  vaultId: string,
  file: File,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("vault_id", vaultId);
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/api/v1/documents/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }

  return res.json() as Promise<UploadResponse>;
}

/**
 * List all documents in a vault, ordered by most recent.
 */
export async function getDocuments(
  vaultId: string,
): Promise<DocumentsResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/documents/${vaultId}`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json() as Promise<DocumentsResponse>;
}

/**
 * Delete a document and all its indexed chunks.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/documents/${documentId}`, {
    method: "DELETE",
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
  const res = await fetch(`${BASE_URL}/api/v1/documents/${documentId}/signed-url`);
  if (!res.ok) {
    throw new Error(`Failed to get signed URL: ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Claims API
// ---------------------------------------------------------------------------

/**
 * Fetch all extracted claims for aSpecific vault.
 */
export async function getClaims(vaultId: string): Promise<{
  claims: Claim[];
  count: number;
}> {
  const res = await fetch(`${BASE_URL}/api/v1/claims/${vaultId}`);
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
  const res = await fetch(`${BASE_URL}/api/v1/claims/${claimId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return res.json();
}

/**
 * Lists forensic red flags for a vault.
 */
export async function getAuditFlags(
  vaultId: string, 
  severity?: string, 
  resolved?: boolean
): Promise<{ flags: any[]; count: number }> {
  const params = new URLSearchParams();
  if (severity) params.append("severity", severity);
  if (resolved !== undefined) params.append("resolved", String(resolved));
  
  const url = `${BASE_URL}/api/v1/audit/flags/${vaultId}?${params.toString()}`;
  console.log(`[Forensic Agent] Fetching flags: ${url}`);
  
  const res = await fetch(url);
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
  const res = await fetch(`${BASE_URL}/api/v1/audit/flags/${flagId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update audit flag");
  return res.json();
}

// ---------------------------------------------------------------------------
// Search API
// ---------------------------------------------------------------------------

/**
 * Perform a semantic search across a vault's documents.
 */
export async function searchVault(
  vaultId: string, 
  query: string, 
  topK: number = 10
): Promise<SearchResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vault_id: vaultId, query, top_k: topK }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Search failed");
  }
  
  return res.json() as Promise<SearchResponse>;
}

// ---------------------------------------------------------------------------
// Chat API — SSE streaming
// ---------------------------------------------------------------------------

/**
 * Send a chat message and stream the response via SSE.
 */
export async function streamChat(
  request: {
    vault_id: string;
    session_id: string;
    message: string;
    user_id?: string;
  },
  callbacks: {
    onToken: (text: string) => void;
    onStatus?: (agent: string, message: string) => void;
    onDone?: (content: string, citations: Citation[]) => void;
    onError?: (error: string) => void;
  },
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

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
            callbacks.onStatus(data.agent ?? "", data.message ?? "");
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
  const res = await fetch(`${BASE_URL}/api/v1/chat/history/${sessionId}`);
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
