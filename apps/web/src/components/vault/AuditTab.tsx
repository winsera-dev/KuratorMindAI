"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getAuditFlags, updateAuditFlag } from "@/lib/api";
import { AuditFlag, Citation } from "@/types";
import { AuditFlagCard } from "./AuditFlagCard";
import { 
  RotateCw, 
  Search, 
  Filter, 
  ShieldAlert, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditTabProps {
  vaultId: string;
  onViewEvidence?: (citation: Citation) => void;
}

/**
 * Audit Tab Workspace
 * Orchestrates forensic flags, contradictions, and legal monitoring.
 */
export function AuditTab({ vaultId, onViewEvidence }: AuditTabProps) {
  const [flags, setFlags] = useState<AuditFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>("critical");
  const [showResolved, setShowResolved] = useState(false);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // By default, we prioritize critical severity per user request
      const data = await getAuditFlags(vaultId, severityFilter || undefined);
      if (data && Array.isArray(data.flags)) {
        setFlags(data.flags);
      } else {
        console.warn("Audit API returned malformed data:", data);
        setFlags([]);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to fetch audit flags:", err);
      setError("Failed to load audit forensic database.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vaultId, severityFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleToggleResolve = async (id: string, resolved: boolean) => {
    try {
      const resolution = resolved ? `Resolved by auditor on ${new Date().toLocaleDateString()}` : "";
      await updateAuditFlag(id, { resolved, resolution });
      // Optimistic update
      setFlags(prev => prev.map(f => f.id === id ? { ...f, resolved, resolution } : f));
    } catch (err) {
      console.error("Failed to toggle flag resolution:", err);
    }
  };

  const handleViewEvidence = (flag: AuditFlag) => {
    if (flag.evidence && flag.evidence.length > 0 && onViewEvidence) {
      const ev = flag.evidence[0];
      onViewEvidence({
        chunk_id: "",
        document_id: ev.document_id,
        page: ev.page,
        text_snippet: ev.excerpt,
      });
    }
  };

  const stats = {
    total: flags.length,
    active: flags.filter(f => !f.resolved).length,
    resolved: flags.filter(f => f.resolved).length,
    riskLevel: flags.find(f => f.severity === "critical" && !f.resolved) ? "CRITICAL" : "STABLE",
  };

  return (
    <div className="h-full flex flex-col space-y-8 pb-12 overflow-y-auto pr-2 scrollbar-none">
      {/* 1. Forensic Header Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-card p-5 rounded-2xl border border-border-default shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent-rose/5 blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-accent-rose/10" />
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Red Flags</p>
              <h3 className={cn(
                "text-2xl font-black tracking-tight",
                stats.active > 0 ? "text-accent-rose" : "text-text-primary"
              )}>
                {stats.active} <span className="text-sm font-medium text-text-muted">ALERT{stats.active !== 1 ? 'S' : ''}</span>
              </h3>
            </div>
            <div className={cn(
              "p-2.5 rounded-xl transition-transform group-hover:scale-110",
              stats.active > 0 ? "bg-accent-rose/10 text-accent-rose" : "bg-secondary text-text-muted"
            )}>
              <ShieldAlert size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-default/50 flex items-center justify-between relative">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Case Risk Level</span>
            <span className={cn(
              "text-[10px] font-black uppercase tabular-nums",
              stats.riskLevel === "CRITICAL" ? "text-accent-rose" : "text-accent-emerald"
            )}>
              {stats.riskLevel}
            </span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border-default shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent-emerald/5 blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-accent-emerald/10" />
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Resolved Anomaly</p>
              <h3 className="text-2xl font-black text-text-primary tracking-tight">
                {stats.resolved} <span className="text-sm font-medium text-text-muted">ITEMS</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-accent-emerald/10 text-accent-emerald transition-transform group-hover:scale-110">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-default/50 flex items-center justify-between relative">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Resolution Efficiency</span>
            <span className="text-[10px] font-black text-accent-emerald tabular-nums">
              {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 100}% DONE
            </span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border-default shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent-amber/5 blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-accent-amber/10" />
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Forensic Certainty</p>
              <h3 className="text-2xl font-black text-accent-amber tracking-tight">
                AI <span className="text-sm font-medium text-text-muted">STABLE</span>
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-accent-amber/10 text-accent-amber transition-transform group-hover:scale-110">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-default/50 flex items-center justify-between relative">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Detection Engine</span>
            <span className="text-[10px] font-black text-text-secondary flex items-center gap-1 uppercase tracking-tight">
              <TrendingUp size={10} className="text-accent-emerald" />
              Active
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
              placeholder="Search red flags and anomalies..."
              className="w-full pl-10 pr-4 py-2 bg-card border border-border-default rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue shadow-sm transition-all"
            />
          </div>
          
          {/* Severity Selector - Locked to Critical default per user request */}
          <div className="flex items-center p-1 bg-secondary rounded-xl gap-1">
            <button 
              onClick={() => setSeverityFilter("critical")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all",
                severityFilter === "critical" ? "bg-accent-rose text-white shadow-lg" : "text-text-muted hover:text-text-secondary"
              )}
            >
              Critical
            </button>
            <button 
              onClick={() => setSeverityFilter(null)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all",
                severityFilter === null ? "bg-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
              )}
            >
              All Levels
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              "p-2 bg-card border border-border-default rounded-xl text-text-muted hover:text-text-primary transition-all active:scale-95",
              refreshing && "animate-spin text-accent-blue border-accent-blue"
            )}
          >
            <RotateCw size={18} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border-default rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:border-text-muted transition-all uppercase tracking-tight">
            <Filter size={14} />
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-text-muted rounded-xl text-xs font-bold disabled:opacity-50 transition-all uppercase tracking-tight cursor-not-allowed">
            <Zap size={14} />
            Auto-Resolve All
          </button>
        </div>
      </section>

      {/* 3. The Flags Grid */}
      {error ? (
        <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 bg-accent-rose/5 rounded-3xl border border-accent-rose/20 p-8">
          <div className="p-4 rounded-2xl bg-accent-rose/10 text-accent-rose">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h4 className="text-base font-bold text-text-primary uppercase tracking-tight">Audit Connection Error</h4>
            <p className="text-sm text-text-muted max-w-sm mt-1">{error}</p>
          </div>
          <button 
            onClick={() => fetchData()}
            className="px-6 py-2 bg-accent-rose text-white text-xs font-black rounded-xl hover:opacity-90 transition-all uppercase tracking-widest"
          >
            Retry Audit
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-44 bg-secondary animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-border-default rounded-3xl p-12">
          <div className="p-5 rounded-full bg-accent-emerald/10 text-accent-emerald">
            <ShieldCheck size={48} strokeWidth={1.5} />
          </div>
          <div className="max-w-md">
            <h4 className="text-base font-black text-text-primary uppercase tracking-tight">System Integrity Protected</h4>
            <p className="text-sm text-text-muted mt-2">
              No logical contradictions or forensic anomalies found in this specific workspace. Every piece of verified evidence is logically consistent.
            </p>
          </div>
          <button className="mt-4 text-xs font-black text-accent-blue hover:underline uppercase tracking-tight">
            Trigger Deep Scan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          {flags
            .filter(f => showResolved || !f.resolved)
            .map(flag => (
              <AuditFlagCard 
                key={flag.id} 
                flag={flag} 
                onToggleResolve={handleToggleResolve}
                onViewEvidence={handleViewEvidence}
              />
            ))}
        </div>
      )}
    </div>
  );
}
