"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getClaims, updateClaim } from "@/lib/api";
import { Claim, ClaimStatus } from "@/types";
import { ClaimsTable } from "./ClaimsTable";
import { 
  Plus, 
  RotateCw, 
  Search, 
  Filter, 
  Download, 
  ShieldCheck, 
  TrendingUp, 
  Calculator 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClaimsTabProps {
  vaultId: string;
  onViewEvidence?: (claim: Claim) => void;
}

/**
 * Claims Workspace Container
 * Orchestrates data fetching and top-level filters for the creditor list.
 */
export function ClaimsTab({ vaultId, onViewEvidence }: ClaimsTabProps) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await getClaims(vaultId);
      setClaims(data.claims);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch claims:", err);
      setError("Failed to load claims database.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vaultId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleUpdateStatus = async (claimId: string, status: ClaimStatus) => {
    try {
      await updateClaim(claimId, { status });
      // Optimistic update
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status } : c));
    } catch (err) {
      console.error("Failed to update claim:", err);
    }
  };

  const filteredClaims = claims.filter(c => 
    c.creditor_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: claims.length,
    verified: claims.filter(c => c.status === "verified").length,
    amount: claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0),
    confidenceAvg: claims.length > 0
      ? (claims.reduce((sum, c) => sum + (c.confidence_score || 0), 0) / claims.length) * 100
      : 0,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-full flex flex-col space-y-8 pb-12 overflow-y-auto pr-2 scrollbar-none">
      {/* 1. Forensic Header Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-card p-5 rounded-2xl border border-border-default shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Total Claims Value</p>
              <h3 className="text-2xl font-black text-accent-blue tracking-tight">
                {formatCurrency(stats.amount)}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-accent-blue/10 text-accent-blue group-hover:scale-110 transition-transform">
              <Calculator size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-default/50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Verification Progress</span>
            <span className="text-[10px] font-black text-accent-emerald tabular-nums">
              {stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0}% DONE
            </span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border-default shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Claim Summary</p>
              <h3 className="text-2xl font-black text-text-primary tracking-tight">
                {stats.total} <span className="text-sm font-medium text-text-muted">CREDITORS</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-secondary text-text-muted group-hover:scale-110 transition-transform">
              <Search size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-default/50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Verified Creditors</span>
            <span className="text-[10px] font-black text-text-secondary tabular-nums">
              {stats.verified} / {stats.total}
            </span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border-default shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">AI Forensic Score</p>
              <h3 className={cn(
                "text-2xl font-black tracking-tight",
                stats.confidenceAvg > 80 ? "text-accent-emerald" :
                stats.confidenceAvg > 50 ? "text-accent-amber" : "text-accent-rose"
              )}>
                {Math.round(stats.confidenceAvg)}% <span className="text-sm font-medium text-text-muted">CERTAINTY</span>
              </h3>
            </div>
            <div className={cn(
              "p-2.5 rounded-xl group-hover:scale-110 transition-transform",
              stats.confidenceAvg > 80 ? "bg-accent-emerald/10 text-accent-emerald" :
              stats.confidenceAvg > 50 ? "bg-accent-amber/10 text-accent-amber" : "bg-accent-rose/10 text-accent-rose"
            )}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-default/50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Confidence Accuracy</span>
            <span className="text-[10px] font-black text-text-secondary flex items-center gap-1">
              <TrendingUp size={10} className="text-accent-emerald" />
              STABLE
            </span>
          </div>
        </div>
      </section>

      {/* 2. Workspace Controls */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-accent-blue" size={16} />
            <input 
              type="text" 
              placeholder="Filter by creditor name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border-default rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue shadow-sm transition-all"
            />
          </div>
          <button className="p-2.5 bg-card border border-border-default rounded-xl text-text-muted hover:text-text-primary hover:border-text-muted transition-all">
            <Filter size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              "p-2.5 bg-card border border-border-default rounded-xl text-text-muted hover:text-text-primary transition-all active:scale-95",
              refreshing && "animate-spin text-accent-blue border-accent-blue"
            )}
          >
            <RotateCw size={18} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border-default rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:border-text-muted transition-all uppercase tracking-tight">
            <Download size={14} />
            Export List
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-accent-blue text-white rounded-xl text-xs font-bold hover:bg-opacity-90 hover:scale-[1.02] shadow-lg shadow-accent-blue/20 transition-all uppercase tracking-tight">
            <Plus size={14} />
            Add Manual Claim
          </button>
        </div>
      </section>

      {/* 3. The Claims Table */}
      {error ? (
        <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 bg-accent-rose/5 rounded-3xl border border-accent-rose/20 p-8">
          <div className="p-4 rounded-2xl bg-accent-rose/10 text-accent-rose">
            <Search size={28} />
          </div>
          <div>
            <h4 className="text-base font-bold text-text-primary uppercase tracking-tight">Network Isolation Error</h4>
            <p className="text-sm text-text-muted max-w-sm mt-1">{error}</p>
          </div>
          <button 
            onClick={() => fetchData()}
            className="px-6 py-2 bg-accent-rose text-white text-xs font-black rounded-xl hover:opacity-90 transition-all uppercase tracking-widest"
          >
            Retry Fetch
          </button>
        </div>
      ) : (
        <ClaimsTable 
          claims={filteredClaims} 
          loading={loading}
          onUpdateStatus={handleUpdateStatus}
          onViewEvidence={onViewEvidence}
        />
      )}
    </div>
  );
}
