"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  Database, 
  RefreshCw, 
  Terminal as TerminalIcon, 
  Calendar, 
  ShieldCheck, 
  Scale,
  Search,
  Clock,
  Loader2,
  Maximize2,
  Info,
  PauseCircle
} from "lucide-react";
import { format, addDays } from "date-fns";
import { getGlobalCaseStats, getDocuments } from "@/lib/api";
import { cn } from "@/lib/utils";

const GLOBAL_LEGAL_CASE_ID = "00000000-0000-0000-0000-000000000000";

export default function CaseSyncPage() {
  const [stats, setStats] = useState<any>(null);
  const [regulations, setRegulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${format(new Date(), "HH:mm:ss")}] ${msg}`]);
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, docsData] = await Promise.all([
        getGlobalCaseStats(),
        getDocuments(GLOBAL_LEGAL_CASE_ID)
      ]);
      setStats(statsData);
      setRegulations(docsData.documents || []);
      addLog("System Standby: Automatic synchronization is temporarily suspended.");
    } catch (error) {
      console.error("Error fetching sync data:", error);
      addLog("Error: Failed to fetch system infrastructure status.");
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (syncing) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [logs, syncing]);

  const filteredRegulations = regulations.filter(reg => 
    reg.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const nextSyncDate = stats?.metadata?.last_sync 
    ? addDays(new Date(stats.metadata.last_sync), 7)
    : new Date();

  return (
    <div className="h-full flex flex-col space-y-10 animate-in fade-in duration-700">
      {/* 1. Technical Header - Cleaned up per request */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
              <span className="w-6 h-1 bg-accent-blue rounded-full" />
              <h1 className="text-2xl font-black tracking-tight text-text-primary uppercase italic">
                System <span className="text-accent-blue not-italic">Sync</span>
              </h1>
          </div>
          <p className="text-text-muted text-[11px] font-bold uppercase tracking-widest">
            Regulatory Synchronization Engine
          </p>
        </div>

        <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-secondary border border-border-default rounded-lg">
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-0.5">Sync Status</p>
                <p className="text-xs font-mono text-accent-rose tracking-tighter uppercase font-bold">Maintenance Mode Active</p>
            </div>
            <button 
                disabled={true}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-elevated border border-border-default text-text-muted font-black text-[10px] uppercase tracking-widest opacity-50 cursor-not-allowed shadow-inner"
            >
                <PauseCircle size={14} />
                Sync Disabled
            </button>
        </div>
      </header>

      {/* 2. Precision Vitals - Horizontal Row */}
      <section className="flex flex-row items-center gap-4 w-full mt-4">
        {[
          { label: "Grounded Docs", value: stats?.document_count || 0, icon: Scale, color: "text-accent-blue" },
          { label: "Sync Protocol", value: "Suspended", icon: ShieldCheck, color: "text-accent-rose" },
          { label: "Last Registry", value: stats?.metadata?.last_sync ? format(new Date(stats.metadata.last_sync), "MMM dd") : "None", icon: Calendar, color: "text-accent-amber" },
          { label: "Next Window", value: "Locked", icon: Clock, color: "text-text-muted" },
        ].map((stat, i) => (
          <div key={i} className="flex-1 bg-card border border-border-subtle p-4 rounded-xl flex items-center gap-4 group hover:border-border-default transition-colors min-w-0">
            <div className={cn("p-2 rounded-lg bg-secondary shrink-0", stat.color)}>
              <stat.icon size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-text-muted text-[9px] font-black uppercase tracking-widest truncate">{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-lg font-black text-text-primary tracking-tight">
                    {loading ? <div className="h-5 w-10 bg-secondary animate-pulse rounded" /> : stat.value}
                </h3>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 3. High-Density Diagnostic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
        
        {/* Left: Indexed Registry Table */}
        <div className="lg:col-span-2 flex flex-col">
          <section className="bg-card border border-border-subtle rounded-2xl flex-1 flex flex-col overflow-hidden min-h-[500px] shadow-card">
            <div className="px-6 py-5 flex items-center justify-between border-b border-border-default bg-secondary/20">
              <div>
                <h3 className="text-xs font-black text-text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Database size={14} className="text-accent-blue" />
                  Verified Registry
                </h3>
                <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1.5 opacity-60">Last Successful Grounding Cycle</p>
              </div>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted group-focus-within:text-accent-blue transition-colors" />
                <input 
                  type="text" 
                  placeholder="Filter by keyword..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-primary/50 border border-border-default rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/10 transition-all w-64"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-secondary/40 sticky top-0 z-20 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted border-b border-border-default">Regulation Identity</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-muted border-b border-border-default text-right">Vault Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-6 animate-pulse"><div className="h-4 bg-secondary rounded w-3/4" /></td>
                        <td className="px-6 py-6 animate-pulse"><div className="h-4 bg-secondary rounded w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredRegulations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-accent-blue/[0.02] transition-colors group relative">
                      <td className="px-6 py-5 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-blue opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-black text-text-primary group-hover:text-accent-blue transition-colors truncate mb-1">
                            {reg.file_name.replace(/_/g, " ").replace(/\.pdf$/i, "")}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-accent-blue/60 uppercase tracking-widest">Grounding Node</span>
                            <span className="w-1 h-1 rounded-full bg-border-default" />
                            <span className="text-[9px] text-text-muted font-bold uppercase">{format(new Date(reg.created_at), "MMM dd, yyyy")}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                         <div className="flex items-center justify-end gap-2 text-text-muted opacity-40 italic">
                            <Info size={12} />
                            <span className="text-[10px] font-bold uppercase">Internal Vault</span>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right: Forensic Terminal */}
        <div className="flex flex-col">
          <section className="bg-card border border-border-subtle rounded-2xl flex-1 flex flex-col overflow-hidden shadow-card">
            <div className="px-5 py-4 border-b border-border-default flex items-center justify-between bg-secondary/20">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted flex items-center gap-2">
                <TerminalIcon size={14} className="text-accent-rose" />
                Diagnostic Trace
              </h3>
              <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-rose" />
                  <span className="text-[8px] font-black uppercase text-accent-rose">Offline</span>
              </div>
            </div>
            
            <div className="flex-1 bg-black/20 p-5 font-mono text-[11px] overflow-y-auto custom-scrollbar relative">
               <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.01),rgba(0,255,0,0.01),rgba(0,0,255,0.01))] bg-[length:100%_4px,3px_100%] opacity-20" />
              
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 space-y-3">
                   <TerminalIcon size={24} />
                   <p className="text-[10px] font-black uppercase tracking-widest italic">Terminal Standby</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-text-secondary leading-tight">
                      <span className="text-accent-blue opacity-50 shrink-0 select-none">›</span>
                      <span className="tracking-tight">{log}</span>
                    </div>
                  ))}
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>

            <div className="p-4 border-t border-border-default bg-secondary/10">
                <p className="text-[9px] font-bold text-text-muted uppercase text-center tracking-widest opacity-40">
                    Engine Access Locked // Node-07X
                </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
