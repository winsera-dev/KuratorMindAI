import { 
  Claim, 
  AuditFlag 
} from "@/types";
import { 
  BASE_URL, 
  getAuthHeaders, 
  supabase, 
  SearchResponse 
} from "./base.service";

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
