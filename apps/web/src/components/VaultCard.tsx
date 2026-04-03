"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ExternalLink, 
  FileText, 
  Scale, 
  AlertTriangle,
  Loader2,
  Clock,
  Calendar,
  Gavel,
  CheckCircle2,
  AlertCircle,
  FileText as FileIcon
} from "lucide-react";
import { getVaultStats } from "@/lib/api";
import { cn } from "@/lib/utils";

interface VaultCardProps {
  vault: any;
}

export default function VaultCard({ vault }: VaultCardProps) {
  const [stats, setStats] = useState<{
    document_count: number;
    total_claims_idr: number;
    flag_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const s = await getVaultStats(vault.id);
        setStats(s);
      } catch (err) {
        console.error("Failed to fetch stats for vault:", vault.id, err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [vault.id]);

  // Indonesian Currency Formatter (Global Standard Abbreviation)
  const formatIDR = (num: number) => {
    if (num >= 1000000000000) return `Rp ${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `Rp ${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `Rp ${(num / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      maximumFractionDigits: 0 
    }).format(num);
  };

  return (
    <Link
      href={`/vault/${vault.id}`}
      className="group block bg-bg-card border border-border-default rounded-2xl p-6 hover:border-accent-blue/50 transition-all hover:shadow-xl hover:shadow-accent-blue/5 relative overflow-hidden h-full"
    >
      {/* Top Row: Case Metadata */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Case #{vault.case_number || "PENDING"}
          </span>
          <h3 className="text-xl font-bold group-hover:text-accent-blue transition-colors">
            {vault.debtor_entity || vault.name}
          </h3>
        </div>
        <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center text-text-muted group-hover:text-accent-blue transition-colors">
          <ExternalLink className="w-5 h-5" />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-text-secondary line-clamp-2 mb-6 h-10">
        {vault.description || "No case description provided yet."}
      </p>

      {/* Stats Row */}
      <div className="flex justify-between items-start py-4 border-t border-border-default min-h-[72px] gap-2">
        {loading ? (
          <div className="w-full flex items-center justify-center py-2 opacity-50">
             <Loader2 className="w-4 h-4 animate-spin mr-2" />
             <span className="text-xs">Analyzing case stats...</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-1.5 text-text-muted whitespace-nowrap">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Sources</span>
              </div>
              <span className="text-sm font-bold truncate text-text-primary">
                {stats?.document_count || 0}
              </span>
            </div>

            <div className="flex flex-col gap-1 min-w-0 flex-1 px-2 border-x border-border-default/30 items-center">
              <div className="flex items-center gap-1.5 text-text-muted whitespace-nowrap">
                <Scale className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Claims</span>
              </div>
              <span 
                className="text-sm font-bold truncate text-text-primary max-w-full" 
                title={stats?.total_claims_idr ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(stats.total_claims_idr) : "Rp 0"}
              >
                {stats?.total_claims_idr ? formatIDR(stats.total_claims_idr) : "Rp 0"}
              </span>
            </div>

            <div className="flex flex-col gap-1 min-w-0 text-text-muted items-end">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <AlertTriangle className="w-3.5 h-3.5 text-accent-amber" />
                <span className="text-[10px] font-medium">Flags</span>
              </div>
              <span className="text-sm font-bold truncate text-text-primary">
                {stats?.flag_count || 0}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Stage Indicator */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            (vault.stage === "bankrupt" || vault.stage === "terminated") && "bg-accent-rose",
            vault.stage === "pkpu_temp" && "bg-accent-amber",
            vault.stage === "pkpu_permanent" && "bg-accent-blue",
            vault.stage === "liquidation" && "bg-accent-orange",
            (vault.stage === "homologasi" || vault.stage === "closed") && "bg-accent-emerald",
            (!vault.stage || vault.stage === "petition") && "bg-text-muted"
          )} />
          <span className={cn(
            "text-xs font-black uppercase tracking-tight",
            (vault.stage === "bankrupt" || vault.stage === "terminated") && "text-accent-rose",
            vault.stage === "pkpu_temp" && "text-accent-amber",
            vault.stage === "pkpu_permanent" && "text-accent-blue",
            vault.stage === "liquidation" && "text-accent-orange",
            (vault.stage === "homologasi" || vault.stage === "closed") && "text-accent-emerald",
            (!vault.stage || vault.stage === "petition") && "text-text-muted"
          )}>
            {vault.stage?.replace('_', ' ') || 'ACTIVE'}
          </span>
        </div>
        <div className="text-[10px] font-bold text-text-muted bg-bg-primary px-2 py-0.5 rounded border border-border-subtle uppercase tracking-wider">
           {vault.court_name || "Commercial Court"}
        </div>
      </div>

      {/* Hover Decor */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent-blue/5 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
