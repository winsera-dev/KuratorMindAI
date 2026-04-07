import { Citation } from "@/types";
import { 
  BASE_URL, 
  getAuthHeaders, 
  ChatHistoryResponse 
} from "./base.service";

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
