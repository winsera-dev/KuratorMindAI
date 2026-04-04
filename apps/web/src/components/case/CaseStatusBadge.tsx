"use client";

import { useState } from "react";
import { 
  Calendar, 
  ChevronDown, 
  Gavel, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Case, CaseStage } from "@/types";
import { updateCase } from "@/lib/api";

const STAGE_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  petition: { label: "Petition (Filing)", color: "slate", Icon: FileText },
  pkpu_temp: { label: "PKPU Temporary (45d)", color: "amber", Icon: Clock },
  pkpu_permanent: { label: "PKPU Permanent (270d)", color: "blue", Icon: Calendar },
  bankrupt: { label: "Bankruptcy (Pailit)", color: "rose", Icon: Gavel },
  liquidation: { label: "Liquidation", color: "orange", Icon: AlertCircle },
  homologasi: { label: "Homologasi (Resolved)", color: "emerald", Icon: CheckCircle2 },
  closed: { label: "Closed", color: "emerald", Icon: CheckCircle2 },
  terminated: { label: "Terminated", color: "rose", Icon: AlertCircle },
};

interface CaseStatusBadgeProps {
  caseData: Case;
  onUpdate?: (updatedVault: Case) => void;
  readOnly?: boolean;
}

export function CaseStatusBadge({ caseData, onUpdate, readOnly = false }: CaseStatusBadgeProps) {
  const currentStage = STAGE_CONFIG[caseData.stage] || STAGE_CONFIG.pkpu_temp;


  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-all duration-300 shrink-0",
        "backdrop-blur-lg bg-opacity-5 shadow-sm",
        currentStage.color === "slate" && "bg-slate-500/5 border-slate-500/20 text-slate-400",
        currentStage.color === "amber" && "bg-accent-amber/5 border-accent-amber/20 text-accent-amber shadow-[0_0_15px_-5px_theme(colors.accent-amber/0.1)]",
        currentStage.color === "blue" && "bg-accent-blue/5 border-accent-blue/20 text-accent-blue shadow-[0_0_15px_-5px_theme(colors.accent-blue/0.1)]",
        currentStage.color === "rose" && "bg-accent-rose/5 border-accent-rose/20 text-accent-rose shadow-[0_0_15px_-5px_theme(colors.accent-rose/0.1)]",
        currentStage.color === "orange" && "bg-accent-orange/5 border-accent-orange/20 text-accent-orange shadow-[0_0_15px_-5px_theme(colors.accent-orange/0.1)]",
        currentStage.color === "emerald" && "bg-accent-emerald/5 border-accent-emerald/20 text-accent-emerald shadow-[0_0_15px_-5px_theme(colors.accent-emerald/0.1)]"
      )}
    >
      <div className="relative flex items-center justify-center">
        {!readOnly && (
          <span className={cn(
            "absolute inset-0 rounded-full animate-ping opacity-20",
            currentStage.color === "amber" && "bg-accent-amber",
            currentStage.color === "blue" && "bg-accent-blue",
            currentStage.color === "rose" && "bg-accent-rose",
            currentStage.color === "emerald" && "bg-accent-emerald"
          )}></span>
        )}
        <currentStage.Icon size={13} className={cn("relative z-10", !readOnly && "agent-working")} />
      </div>
      
      <span className="text-[10px] font-black uppercase tracking-[0.05em] leading-none">
        {currentStage.label.split(' (')[0]}
      </span>
      
      {caseData.stage_started_at && (
        <span className="ml-1 pl-2 border-l border-current/10 text-[9px] font-bold opacity-40 tabular-nums uppercase tracking-tighter leading-none">
          {new Date(caseData.stage_started_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
        </span>
      )}
      {!readOnly && <ChevronDown size={10} className="ml-0.5 opacity-30 shrink-0" />}
    </div>
  );
}
