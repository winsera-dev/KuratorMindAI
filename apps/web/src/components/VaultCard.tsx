"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ExternalLink, 
  FileText, 
  Scale, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { getVaultStats } from "@/lib/api";

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

  // Indonesian Currency Formatter
  const formatIDR = (num: number) => {
    if (num >= 1000000000000) return `Rp ${(num / 1000000000000).toFixed(1)}T`;
    if (num >= 1000000000) return `Rp ${(num / 1000000000).toFixed(1)}B`;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
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
      <div className="grid grid-cols-3 gap-4 py-4 border-t border-border-default min-h-[72px]">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-2 opacity-50">
             <Loader2 className="w-4 h-4 animate-spin mr-2" />
             <span className="text-xs">Analyzing case stats...</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-text-muted">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Sources</span>
              </div>
              <span className="text-sm font-bold">{stats?.document_count || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Scale className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Claims</span>
              </div>
              <span className="text-sm font-bold">
                {stats?.total_claims_idr ? formatIDR(stats.total_claims_idr) : "Rp 0"}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-accent-amber">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Flags</span>
              </div>
              <span className="text-sm font-bold">{stats?.flag_count || 0}</span>
            </div>
          </>
        )}
      </div>

      {/* Stage Indicator */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-emerald" />
          <span className="text-xs font-semibold text-accent-emerald uppercase">
            {vault.stage?.replace('_', ' ') || 'ACTIVE'}
          </span>
        </div>
        <div className="text-[10px] text-text-muted bg-bg-primary px-2 py-0.5 rounded border border-border-subtle">
           {vault.court_name || "Commercial Court"}
        </div>
      </div>

      {/* Hover Decor */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent-blue/5 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
