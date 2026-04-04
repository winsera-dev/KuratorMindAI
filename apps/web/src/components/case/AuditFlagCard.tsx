"use client";

import React from "react";
import { 
  AlertTriangle, 
  ShieldAlert, 
  FileSearch, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Info
} from "lucide-react";
import { AuditFlag, FlagSeverity, FlagType } from "@/types";
import { cn } from "@/lib/utils";

interface AuditFlagCardProps {
  flag: AuditFlag;
  onToggleResolve: (id: string, resolved: boolean) => void;
  onViewEvidence: (flag: AuditFlag) => void;
}

/**
 * Audit Flag Card
 * Displays a single red flag with severity badges and forensic evidence triggers.
 */
export function AuditFlagCard({ flag, onToggleResolve, onViewEvidence }: AuditFlagCardProps) {
  const severityConfig: Record<FlagSeverity, { color: string; bg: string; icon: any }> = {
    critical: { color: "text-accent-rose", bg: "bg-accent-rose/10", icon: ShieldAlert },
    high: { color: "text-accent-amber", bg: "bg-accent-amber/10", icon: AlertTriangle },
    medium: { color: "text-accent-blue", bg: "bg-accent-blue/10", icon: Info },
    low: { color: "text-text-muted", bg: "bg-secondary", icon: Info },
  };

  const typeLabels: Record<FlagType, string> = {
    contradiction: "Evidence Contradiction",
    actio_pauliana: "Actio Pauliana Risk",
    entity_duplicate: "Duplicate Entity",
    non_compliance: "PSAK Non-Compliance",
    anomaly: "Financial Anomaly",
    inflated_claim: "Inflated Claim Value",
  };

  const config = severityConfig[flag.severity];
  const Icon = config.icon;

  return (
    <div className={cn(
      "group relative bg-card border rounded-2xl p-5 transition-all hover:shadow-lg hover:shadow-black/5",
      flag.resolved ? "opacity-60 grayscale-[0.5] border-border-default" : "border-border-default"
    )}>
      {/* 1. Header & Severity */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", config.bg, config.color)}>
            <Icon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] font-black uppercase tracking-widest", config.color)}>
                {flag.severity}
              </span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest opacity-40">•</span>
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                {typeLabels[flag.flag_type]}
              </span>
            </div>
            <h4 className="text-sm font-black text-text-primary mt-0.5 tracking-tight group-hover:text-accent-blue transition-colors">
              {flag.title}
            </h4>
            {flag.legal_reference && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-[9px] font-black text-accent-cyan uppercase tracking-tighter">
                  Legal Basis: {flag.legal_reference}
                </span>
                <span className="text-[9px] text-text-muted font-bold opacity-40">Grounded by Regulatory Scholar</span>
              </div>
            )}
          </div>
        </div>
        
        <button 
          onClick={() => onToggleResolve(flag.id, !flag.resolved)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all",
            flag.resolved 
              ? "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20" 
              : "bg-secondary text-text-muted hover:text-text-primary border border-transparent"
          )}
        >
          {flag.resolved ? (
            <><CheckCircle2 size={12} /> RESOLVED</>
          ) : (
            <><Clock size={12} /> MARK RESOLVED</>
          )}
        </button>
      </div>

      {/* 2. Description */}
      <p className="text-xs text-text-secondary leading-relaxed mb-5 line-clamp-2 italic">
        "{flag.description}"
      </p>

      {/* 3. Evidence Preview & Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border-default/50">
        <div className="flex -space-x-2">
          {Array.isArray(flag.evidence) && flag.evidence.map((_, i) => (
            <div key={i} className="w-6 h-6 rounded-lg bg-secondary border border-background flex items-center justify-center text-[10px] font-bold text-text-muted">
              {i + 1}
            </div>
          ))}
          {(!flag.evidence || !Array.isArray(flag.evidence) || flag.evidence.length === 0) && (
            <span className="text-[10px] font-medium text-text-muted lowercase">No linked evidence</span>
          )}
        </div>

        <button 
          onClick={() => onViewEvidence(flag)}
          className="flex items-center gap-1.5 text-[11px] font-black text-accent-blue hover:underline uppercase tracking-tight"
        >
          View Forensic Proof
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Resolution Note if present */}
      {flag.resolved && flag.resolution && (
        <div className="mt-4 p-3 bg-accent-emerald/5 rounded-xl border border-accent-emerald/10">
          <p className="text-[10px] font-bold text-accent-emerald uppercase tracking-tight mb-1">Resolution Note</p>
          <p className="text-[11px] text-text-secondary italic">
            {flag.resolution}
          </p>
        </div>
      )}
    </div>
  );
}
