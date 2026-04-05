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
  FileText as FileIcon,
  Pencil
} from "lucide-react";
import { getCaseStats } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CaseCardProps {
  caseData: any;
  onEdit?: (caseData: any) => void;
}

export default function CaseCard({ caseData, onEdit }: CaseCardProps) {
  const [stats, setStats] = useState<{
    document_count: number;
    total_claims_idr: number;
    flag_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const s = await getCaseStats(caseData.id);
        setStats(s);
      } catch (err) {
        console.error("Failed to fetch stats for case:", caseData.id, err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [caseData.id]);

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
      href={`/case/${caseData.id}`}
      className="group block bg-bg-card border border-border-default rounded-2xl p-6 hover:border-accent-blue/50 transition-all hover:shadow-xl hover:shadow-accent-blue/5 relative overflow-hidden h-full"
    >
      {/* Top Row: Case Metadata */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted opacity-60">
            Case #{caseData.case_number || "PENDING"}
          </span>
          <h3 className="text-lg font-black group-hover:text-accent-blue transition-colors truncate">
            {caseData.name}
          </h3>
          <p className="text-[11px] text-text-secondary font-bold uppercase tracking-tight truncate opacity-80">
            {caseData.debtor_entity || "Undisclosed Entity"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(caseData);
              }}
              className="w-10 h-10 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-accent-blue hover:bg-accent-blue/10 hover:border-accent-blue/30 transition-all shrink-0 relative z-10"
              title="Edit Workspace"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted group-hover:text-accent-blue group-hover:bg-accent-blue/5 transition-all shrink-0">
            <Scale className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-text-secondary line-clamp-2 mb-6 h-10">
        {caseData.description || "No case description provided yet."}
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
            (caseData.stage === "bankrupt" || caseData.stage === "terminated") && "bg-accent-rose",
            caseData.stage === "pkpu_temp" && "bg-accent-amber",
            caseData.stage === "pkpu_permanent" && "bg-accent-blue",
            caseData.stage === "liquidation" && "bg-accent-orange",
            (caseData.stage === "homologasi" || caseData.stage === "closed") && "bg-accent-emerald",
            (!caseData.stage || caseData.stage === "petition") && "bg-text-muted"
          )} />
          <span className={cn(
            "text-xs font-black uppercase tracking-tight",
            (caseData.stage === "bankrupt" || caseData.stage === "terminated") && "text-accent-rose",
            caseData.stage === "pkpu_temp" && "text-accent-amber",
            caseData.stage === "pkpu_permanent" && "text-accent-blue",
            caseData.stage === "liquidation" && "text-accent-orange",
            (caseData.stage === "homologasi" || caseData.stage === "closed") && "text-accent-emerald",
            (!caseData.stage || caseData.stage === "petition") && "text-text-muted"
          )}>
            {caseData.stage?.replace('_', ' ') || 'ACTIVE'}
          </span>
        </div>
        <div className="text-[10px] font-bold text-text-muted bg-bg-primary px-2 py-0.5 rounded border border-border-subtle uppercase tracking-wider">
           {caseData.court_name || "Commercial Court"}
        </div>
      </div>

      {/* Hover Decor */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-accent-blue/5 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
