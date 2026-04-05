/** Shared types for KuratorMind AI */

/** Case case stages matching the Indonesian insolvency lifecycle */
export type CaseStage =
  | "petition"        // Stage 1: Filing
  | "pkpu_temp"       // Stage 2: 45-day window
  | "pkpu_permanent"  // Stage 3: 270-day window
  | "bankrupt"        // Stage 4/5: Bankruptcy
  | "liquidation"     // Stage 5: Asset liquidation
  | "homologasi"       // Stage 4: Debt restructing saved
  | "closed"          // Stage 6: Case closed
  | "terminated";      // Legacy/Alternate close

export type CaseStatus = "active" | "archived" | "closed";

export interface Case {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  debtor_entity?: string;
  case_number?: string;
  court_name?: string;
  stage_started_at?: string;
  stage: CaseStage;
  status: CaseStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type DocumentStatus = "pending" | "processing" | "ready" | "error";

export interface CaseDocument {
  id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  file_size?: number;
  status: DocumentStatus;
  page_count?: number;
  summary?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  case_id: string;
  content: string;
  chunk_index: number;
  page_number?: number;
  section_title?: string;
  metadata: Record<string, unknown>;
}

export type ClaimType = "preferential" | "secured" | "concurrent";
export type ClaimStatus = "pending" | "verified" | "disputed" | "rejected";

export interface Claim {
  id: string;
  case_id: string;
  global_entity_id?: string; // Phase 1D: Link to canonical global identity
  creditor_name: string;
  creditor_aliases?: string[];
  claim_amount?: number;
  adjusted_amount?: number;
  currency: string;
  claim_type?: ClaimType;
  collateral_description?: string;
  priority_rank?: number;
  status: ClaimStatus;
  confidence_score?: number;
  supporting_documents?: string[];
  contradicting_evidence: Array<{
    document_id: string;
    page: number;
    excerpt: string;
    type: string;
  }>;
  legal_basis?: string;
  rejection_reason?: string;
  flags?: string[];
  notes?: string;
  verified_by?: string;
  verified_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type FlagSeverity = "critical" | "high" | "medium" | "low";
export type FlagType =
  | "contradiction"
  | "actio_pauliana"
  | "entity_duplicate"
  | "conflict_of_interest" // Phase 1D
  | "non_compliance"
  | "anomaly"
  | "inflated_claim";

export interface AuditFlag {
  id: string;
  case_id: string;
  claim_id?: string;
  global_entity_id?: string; // Phase 1D
  severity: FlagSeverity;
  flag_type: FlagType;
  title: string;
  description: string;
  evidence: Array<{
    document_id: string;
    page: number;
    excerpt: string;
    case_id?: string; // Cross-case evidence
  }>;
  legal_reference?: string;
  resolution?: string;
  resolved: boolean;
  created_at: string;
}

/** Phase 1D: Global Entity Resolution */
export type GlobalEntityType = "creditor" | "debtor" | "director" | "counsel" | "entity";

export interface GlobalEntity {
  id: string;
  name: string;
  entity_type: GlobalEntityType;
  aliases: string[];
  is_verified: boolean;
  risk_score: number;
  occurrences?: any[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EntityOccurrence {
  id: string;
  entity_id: string;
  case_id: string;
  case_name?: string; // Joined field
  source_type: "case" | "claim" | "chunk" | "flag";
  source_id: string;
  confidence: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatSession {
  id: string;
  case_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  chunk_id: string;
  document_id: string;
  page: number;
  text_snippet: string;
  file_name?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  agent_name?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Agent task tracking */
export type AgentTaskStatus =
  | "submitted"
  | "working"
  | "input_required"
  | "completed"
  | "failed";

export interface AgentTask {
  id: string;
  case_id: string;
  parent_task_id?: string;
  agent_name: string;
  task_type: string;
  status: AgentTaskStatus;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  a2a_messages: Array<Record<string, unknown>>;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

/** Phase 2A: Automated Synthesis (Outputs) */
export type OutputType = "judge_report" | "creditor_list" | "forensic_summary" | "presentation" | "spreadsheet" | "legal_summary";

export interface GeneratedOutput {
  id: string;
  case_id: string;
  output_type: OutputType;
  title: string;
  file_path?: string;
  content: {
    markdown?: string;
    json?: Record<string, any>;
  };
  citations: Citation[];
  metadata: Record<string, unknown>;
  created_at: string;
}
