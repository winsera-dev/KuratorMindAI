import { GeneratedOutput } from "@/types";
import { 
  BASE_URL, 
  getAuthHeaders, 
  supabase 
} from "./base.service";

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
