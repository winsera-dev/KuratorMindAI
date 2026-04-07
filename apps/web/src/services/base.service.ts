import { createClient } from "@/lib/supabase/client";
import { config } from "@/config";
import { 
  CaseDocument, 
  ChatMessage, 
  Citation,
  Claim,
  Case,
} from "@/types";

export const supabase = createClient();
export const BASE_URL = config.api.baseUrl;

/**
 * Returns the Authorization header for the current Supabase session.
 * Must be called from client-side code only.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
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
