/**
 * KuratorMind AI — API Client
 *
 * This file now serves as a central entry point that re-exports specialized services.
 * Existing code can continue to import from "@/lib/api" without changes.
 */

export * from "../services/base.service";
export * from "../services/case.service";
export * from "../services/document.service";
export * from "../services/forensic.service";
export * from "../services/chat.service";
export * from "../services/output.service";
export * from "../services/profile.service";

// Re-export common types for convenience
export type { 
  Case, 
  CaseDocument, 
  ChatMessage, 
  Citation,
  Claim,
} from "@/types";
