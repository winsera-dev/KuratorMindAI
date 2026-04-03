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
  onUpdate: (updatedVault: Vault) => void;
}

export function VaultStatusBadge({ vault, onUpdate }: VaultStatusBadgeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempStage, setTempStage] = useState(vault.stage);
  const [tempDate, setTempDate] = useState(vault.stage_started_at || vault.bankruptcy_date || "");

  const currentStage = STAGE_CONFIG[vault.stage] || STAGE_CONFIG.pkpu_temp;

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await updateVault(vault.id, {
        stage: tempStage,
        stage_started_at: tempDate,
      });
      onUpdate(updated);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 bg-elevated border border-border-default rounded-lg p-1 animate-in fade-in zoom-in-95 duration-200">
        <select
          value={tempStage}
          onChange={(e) => setTempStage(e.target.value as VaultStage)}
          className="bg-transparent text-xs font-medium text-text-primary px-2 py-1 outline-none border-r border-border-subtle"
        >
          {Object.entries(STAGE_CONFIG).map(([id, cfg]) => (
            <option key={id} value={id}>{cfg.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 px-2 py-1">
          <Calendar size={12} className="text-text-muted" />
          <input
            type="date"
            value={tempDate ? tempDate.split("T")[0] : ""}
            onChange={(e) => setTempDate(e.target.value)}
            className="bg-transparent text-xs font-mono text-text-primary outline-none [color-scheme:dark]"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-3 py-1 rounded-md bg-accent-blue text-white text-xs font-medium hover:bg-accent-blue/90 transition-all disabled:opacity-50"
        >
          {loading ? "..." : "Save"}
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className="px-2 py-1 text-text-muted hover:text-text-primary text-xs"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 hover:scale-[1.02] group",
        currentStage.color === "slate" && "bg-elevated border-border-default text-text-muted",
        currentStage.color === "amber" && "bg-accent-amber/10 border-accent-amber/20 text-accent-amber",
        currentStage.color === "blue" && "bg-accent-blue/10 border-accent-blue/20 text-accent-blue",
        currentStage.color === "rose" && "bg-accent-rose/10 border-accent-rose/20 text-accent-rose",
        currentStage.color === "orange" && "bg-accent-orange/10 border-accent-orange/20 text-accent-orange",
        currentStage.color === "emerald" && "bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald"
      )}
    >
      <currentStage.Icon size={14} className="agent-working" />
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
          Current Stage
        </span>
        <span className="text-xs font-semibold flex items-center gap-1">
          {currentStage.label}
          <ChevronDown size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
        </span>
      </div>
      
      {vault.stage_started_at && (
        <div className="ml-2 pl-2 border-l border-current/20 flex flex-col items-start leading-tight">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
            Started At
          </span>
          <span className="text-xs font-mono">
            {new Date(vault.stage_started_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      )}
    </button>
  );
}
