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
import { Vault, VaultStage } from "@/types";
import { updateVault } from "@/lib/api";

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

interface VaultStatusBadgeProps {
  vault: Vault;
  onUpdate?: (updatedVault: Vault) => void;
  readOnly?: boolean;
}

export function VaultStatusBadge({ vault, onUpdate, readOnly = false }: VaultStatusBadgeProps) {
  const currentStage = STAGE_CONFIG[vault.stage] || STAGE_CONFIG.pkpu_temp;


  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 group",
        currentStage.color === "slate" && "bg-bg-secondary border-border-default text-text-muted",
        currentStage.color === "amber" && "bg-accent-amber/10 border-accent-amber/20 text-accent-amber",
        currentStage.color === "blue" && "bg-accent-blue/10 border-accent-blue/20 text-accent-blue",
        currentStage.color === "rose" && "bg-accent-rose/10 border-accent-rose/20 text-accent-rose",
        currentStage.color === "orange" && "bg-accent-orange/10 border-accent-orange/20 text-accent-orange",
        currentStage.color === "emerald" && "bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald"
      )}
    >
      <currentStage.Icon size={12} className={cn(readOnly ? "" : "agent-working")} />
      <div className="flex flex-col items-start leading-none gap-0.5">
        <span className="text-[8px] font-black uppercase tracking-[0.15em] opacity-50">
          Stage
        </span>
        <span className="text-[10px] font-black flex items-center gap-1 uppercase tracking-tight">
          {currentStage.label.split(' (')[0]}
          {!readOnly && <ChevronDown size={8} className="opacity-40" />}
        </span>
      </div>
      
      {vault.stage_started_at && (
        <div className="ml-1.5 pl-1.5 border-l border-current/20 flex flex-col items-start leading-none gap-0.5">
          <span className="text-[8px] font-black uppercase tracking-[0.15em] opacity-50">
            Since
          </span>
          <span className="text-[10px] font-black whitespace-nowrap uppercase tracking-tight">
            {new Date(vault.stage_started_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
          </span>
        </div>
      )}
    </div>
  );
}
