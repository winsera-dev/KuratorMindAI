import { 
  supabase, 
  BASE_URL, 
  getAuthHeaders, 
  UploadResponse, 
  DocumentsResponse 
} from "./base.service";

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
  const maxRetries = 3;
  let delay = 1000; // Start with 1s

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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

      if (res.ok) {
        return res.json();
      }

      const err = await res.json().catch(() => ({}));
      
      // Don't retry on 4xx errors (Auth, Duplicate, Size) except specifically 429
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(err.detail || `Upload failed with status ${res.status}`);
      }

      // If it's a 429 or 5xx, we might want to retry
      if (attempt === maxRetries) {
        throw new Error(err.detail || `Upload failed after ${maxRetries} retries`);
      }
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      
      console.warn(`[API] Upload attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw new Error('Upload failed unexpectedly');
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
