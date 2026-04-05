"use client";

import React, { useMemo } from "react";
import { 
  Claim, 
  ClaimType, 
  ClaimStatus 
} from "@/types";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  XCircle, 
  FileSearch2, 
  ShieldCheck, 
  ShieldAlert, 
  Banknote,
  Fingerprint,
} from "lucide-react";

interface ClaimsTableProps {
  claims: Claim[];
  loading?: boolean;
  isScanning?: boolean;
  onUpdateStatus?: (claimId: string, status: ClaimStatus) => void;
  onViewEvidence?: (claim: Claim) => void;
}

/**
 * Interactive Debt Mapping Table
 * Supports grouping, AI confidence indicators, and evidence drill-down.
 */
export function ClaimsTable({ 
  claims, 
  loading, 
  isScanning,
  onUpdateStatus, 
  onViewEvidence 
}: ClaimsTableProps) {
  // 1. Group claims by type
  const groupedClaims = useMemo(() => {
    const groups: Record<ClaimType, Claim[]> = {
      preferential: [],
      secured: [],
      concurrent: [],
    };
    claims.forEach((c) => {
      const type = c.claim_type || "concurrent";
      if (groups[type]) groups[type].push(c);
      else groups.concurrent.push(c);
    });
    return groups;
  }, [claims]);

  const formatCurrency = (amount: number = 0, currency: string = "IDR") => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && !isScanning) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-elevated rounded-xl border border-border-default/50" />
        ))}
      </div>
    );
  }

  if (claims.length === 0) {
    if (isScanning) {
      return (
        <div className="grid grid-cols-1 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-card/50 border border-dashed border-border-subtle rounded-2xl flex items-center justify-center">
              <div className="flex items-center gap-4 opacity-20">
                <div className="w-12 h-12 rounded-xl bg-accent-blue/20 animate-pulse" />
                <div className="space-y-2">
                  <div className="w-48 h-3 bg-text-muted rounded animate-pulse" />
                  <div className="w-32 h-2 bg-text-muted/50 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center space-y-3 bg-card/30 rounded-2xl border border-dashed border-border-default">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
          <Banknote className="text-text-muted opacity-50" size={20} />
        </div>
        <div>
          <h3 className="font-medium text-text-primary">No claims identified yet</h3>
          <p className="text-sm text-text-muted">Upload estate documents to start forensic extraction.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {(Object.entries(groupedClaims) as [ClaimType, Claim[]][]).map(([type, list]) => {
        if (list.length === 0) return null;

        return (
          <section key={type} className="space-y-4">
            <header className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  type === "preferential" && "bg-accent-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                  type === "secured" && "bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.5)]",
                  type === "concurrent" && "bg-text-muted opacity-50"
                )} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                  {type === "preferential" && "Preferential (Preferen)"}
                  {type === "secured" && "Secured (Separatis)"}
                  {type === "concurrent" && "Concurrent (Konkuren)"}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-text-muted font-medium">
                  {list.length}
                </span>
              </div>
              <div className="text-xs text-text-muted font-medium">
                Subtotal: {formatCurrency(list.reduce((sum, c) => sum + (c.claim_amount || 0), 0))}
              </div>
            </header>

            <PaginatedTableSection list={list} formatCurrency={formatCurrency} onViewEvidence={onViewEvidence} />
          </section>
        );
      })}
    </div>
  );
}

function PaginatedTableSection({ list, formatCurrency, onViewEvidence }: any) {
  const [displayCount, setDisplayCount] = React.useState(50);
  const visibleList = list.slice(0, displayCount);

  return (
    <div className="overflow-hidden bg-card rounded-2xl border border-border-default shadow-sm hover:shadow-md transition-shadow">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border-default bg-secondary/30">
            <th className="px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-tight w-1/3">Creditor Name</th>
            <th className="px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-tight text-right">Amount (IDR)</th>
            <th className="px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-tight text-center">Confidence</th>
            <th className="px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-tight text-center">Status</th>
            <th className="px-5 py-3.5 text-xs font-semibold text-text-muted uppercase tracking-tight text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default/50">
          {visibleList.map((claim: any) => (
            <tr key={claim.id} className="group hover:bg-elevated/50 transition-colors">
              <td className="px-5 py-4">
                <div className="font-semibold text-text-primary text-sm line-clamp-1">{claim.creditor_name}</div>
                <div className="text-[11px] text-text-muted mt-1 opacity-70 flex flex-wrap gap-x-3 gap-y-1 font-medium uppercase tracking-tight">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={11} className="text-accent-emerald shrink-0" />
                    <span>AI Extracted — Ref: {claim.supporting_documents?.length || 0} docs</span>
                  </div>
                  {claim.legal_basis && (
                    <div className="flex items-center gap-1 text-accent-cyan/80">
                      <ShieldAlert size={11} className="shrink-0" />
                      <span>Basis: {claim.legal_basis}</span>
                    </div>
                  )}
                  {claim.global_entity_id && (
                    <div className="flex items-center gap-1 text-accent-cyan animate-pulse">
                      <Fingerprint size={11} className="shrink-0" />
                      <span className="font-bold">Networked Entity</span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-5 py-4 text-right">
                <div className={cn(
                  "font-mono text-sm font-bold tabular-nums flex flex-col items-end gap-1",
                  (claim.claim_amount || 0) <= 0 ? "text-accent-rose" : "text-accent-blue"
                )}>
                  <span>{formatCurrency(claim.claim_amount)}</span>
                  {(claim.claim_amount || 0) <= 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent-rose/80 flex items-center gap-1">
                      <ShieldAlert size={10} /> Invalid Amount
                    </span>
                  )}
                </div>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-16 h-1 rounded-full bg-secondary overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000",
                        (claim.confidence_score || 0) > 0.8 ? "bg-accent-emerald" : 
                        (claim.confidence_score || 0) > 0.5 ? "bg-accent-amber" : "bg-accent-rose"
                      )} 
                      style={{ width: `${(claim.confidence_score || 0) * 100}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] font-bold tabular-nums", 
                        (claim.confidence_score || 0) > 0.8 ? "text-accent-emerald" : 
                        (claim.confidence_score || 0) > 0.5 ? "text-accent-amber" : "text-accent-rose"
                  )}>
                    {Math.round((claim.confidence_score || 0) * 100)}% ({(claim.confidence_score || 0) > 0.8 ? 'HIGH' : (claim.confidence_score || 0) > 0.5 ? 'MEDIUM' : 'LOW'})
                  </span>
                </div>
              </td>
              <td className="px-5 py-4">
                <div className="flex justify-center">
                  <StatusBadge status={claim.status} />
                </div>
              </td>
              <td className="px-5 py-4 text-right">
                <button 
                  onClick={() => onViewEvidence?.(claim)}
                  className="p-2 text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 rounded-lg transition-all"
                  title="View Supporting Evidence"
                >
                  <FileSearch2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length > displayCount && (
        <div className="p-4 border-t border-border-default/50 bg-secondary/10 flex justify-center">
          <button
            onClick={() => setDisplayCount(prev => prev + 50)}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary bg-card border border-border-default rounded-xl hover:border-accent-cyan/50 transition-all active:scale-95"
          >
            Show More ({list.length - displayCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ClaimStatus }) {
  const styles = {
    pending: "bg-secondary text-text-muted border-border-default",
    verified: "bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20",
    disputed: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
    rejected: "bg-accent-rose/10 text-accent-rose border-accent-rose/20",
  };

  const icons = {
    pending: <Clock size={12} />,
    verified: <CheckCircle2 size={12} />,
    disputed: <AlertCircle size={12} />,
    rejected: <XCircle size={12} />,
  };

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      styles[status]
    )}>
      {icons[status]}
      <span>{status}</span>
    </div>
  );
}
