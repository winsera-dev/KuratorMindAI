import { Case } from "@/types";
import { BASE_URL, getAuthHeaders } from "./base.service";

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

/**
 * Trigger a manual synchronization of official regulations.
 */
export async function triggerSync(keywords: string[]): Promise<any> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/v1/cases/sync-regulations`, {
        method: "POST",
        headers,
        body: JSON.stringify({ keywords, force: true }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Sync failed");
    }
    
    return res.json();
}

/**
 * Fetch metadata and stats for the Global Legal Case.
 */
export async function getGlobalCaseStats(): Promise<{
  document_count: number;
  total_claims_idr: number;
  flag_count: number;
  metadata?: { last_sync?: string };
}> {
  const GLOBAL_ID = "00000000-0000-0000-0000-000000000000";
  const headers = await getAuthHeaders();
  
  // Use existing stats endpoint
  const statsRes = await fetch(`${BASE_URL}/api/v1/cases/${GLOBAL_ID}/stats`, { headers });
  const caseRes = await fetch(`${BASE_URL}/api/v1/cases/${GLOBAL_ID}`, { headers });
  
  if (!statsRes.ok || !caseRes.ok) throw new Error("Failed to fetch global stats");
  
  const stats = await statsRes.json();
  const caseData = await caseRes.json();
  
  return {
    document_count: stats.document_count,
    total_claims_idr: stats.total_claims_idr,
    flag_count: stats.flag_count,
    metadata: caseData.metadata
  };
}
