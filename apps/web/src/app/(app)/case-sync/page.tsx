"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  Database, 
  RefreshCw, 
  Terminal as TerminalIcon, 
  ExternalLink, 
  Calendar, 
  ShieldCheck, 
  Scale,
  Search,
  AlertCircle,
  Clock,
  Loader2,
  Maximize2,
  Info
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { getGlobalCaseStats, triggerSync, getDocuments } from "@/lib/api";

const GLOBAL_LEGAL_CASE_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_KEYWORDS = [
  "Kepailitan & PKPU", 
  "Audit Investigatif", 
  "Pencucian Uang", 
  "Regulasi OJK", 
  "Standar Forensik Digital"
];

export default function CaseSyncPage() {
  const [stats, setStats] = useState<any>(null);
  const [regulations, setRegulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${format(new Date(), "HH:mm:ss")}] ${msg}`]);
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, docsData] = await Promise.all([
        getGlobalCaseStats(),
        getDocuments(GLOBAL_LEGAL_CASE_ID)
      ]);
      setStats(statsData);
      setRegulations(docsData.documents || []);
      
      // Auto-sync check (7 days)
      const lastSync = statsData.metadata?.last_sync;
      if (lastSync) {
        const daysSinceSync = differenceInDays(new Date(), new Date(lastSync));
        if (daysSinceSync >= 7) {
          addLog("System Alert: Weekly synchronization is overdue. Starting auto-sync...");
          handleSync();
        } else {
          addLog(`System Standby: Last sync was ${daysSinceSync} days ago. Everything is up to date.`);
        }
      } else {
        addLog("System Alert: No sync history found. Starting initial synchronization...");
        handleSync();
      }

    } catch (error) {
      console.error("Error fetching sync data:", error);
      addLog("Error: Failed to fetch system infrastructure status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (syncing) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [logs, syncing]);

  const handleSync = async () => {
    if (syncing) return;
    
    setSyncing(true);
    setLogs([]);
    addLog("Initializing Regulatory Grounding Engine...");
    addLog("Targeting keywords: " + DEFAULT_KEYWORDS.join(", "));
    
    try {
      addLog("Connecting to official regulatory sources (JDIH, OJK, Supreme Court)...");
      const result = await triggerSync(DEFAULT_KEYWORDS);
      
      if (result.added_count > 0) {
        addLog(`Success: Indexed ${result.added_count} new regulations/cases.`);
      } else {
        addLog("No new updates found in official repositories.");
      }
      
      addLog("Grounding complete. Re-indexing vector database...");
      
      // Refresh data
      const [statsData, docsData] = await Promise.all([
        getGlobalCaseStats(),
        getDocuments(GLOBAL_LEGAL_CASE_ID)
      ]);
      setStats(statsData);
      setRegulations(docsData.documents || []);
      
      addLog("System synchronization complete.");
    } catch (error: any) {
      addLog(`Error during synchronization: ${error.message || "Unknown Error"}`);
      if (error.message?.includes("wait")) {
          addLog("Rate Limit Enforcement: Manual trigger is limited to once per 7 days.");
      }
    } finally {
      setSyncing(false);
    }
  };

  const filteredRegulations = regulations.filter(reg => 
    reg.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const nextSyncDate = stats?.metadata?.last_sync 
    ? addDays(new Date(stats.metadata.last_sync), 7)
    : new Date();

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#050608] text-text-primary p-8 space-y-8 custom-scrollbar">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="px-1.5 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/20">
               <Database className="w-3.5 h-3.5 text-accent-blue" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-blue/80">Infrastructure & Grounding</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent italic">
            Case Sync Control Center
          </h1>
          <p className="text-sm text-text-muted max-w-xl leading-relaxed">
            Automated grounding with official legal repositories (JDIH, OJK) for verified AI forensic analysis.
          </p>
        </div>

        <button 
          onClick={handleSync}
          disabled={syncing}
          className="relative group flex items-center gap-3 px-6 py-2.5 rounded-lg bg-accent-blue hover:bg-accent-blue-hover text-white font-bold transition-all shadow-lg hover:shadow-glow-blue disabled:opacity-50 disabled:grayscale overflow-hidden shrink-0"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="text-sm tracking-wide uppercase">{syncing ? "Active Syncing..." : "Manual Sync"}</span>
        </button>
      </header>

      {/* Compact Stats Row - Forced Horizontal Ribbon */}
      <div className="flex flex-row gap-4 overflow-x-auto pb-2 no-scrollbar">
        {[
          { icon: Scale, label: "Total Indexed", value: stats?.document_count || 0, sub: "Grounding Documents", color: "blue" },
          { icon: ShieldCheck, label: "Sync Protocol", value: "Weekly", sub: "Automated Active", color: "teal" },
          { icon: Calendar, label: "Last Updated", value: stats?.metadata?.last_sync ? format(new Date(stats.metadata.last_sync), "MMM dd") : "None", sub: "Registry Sync", color: "amber" },
          { icon: Clock, label: "Next Scheduled", value: format(nextSyncDate, "MMM dd"), sub: "Auto-check Routine", color: "rose" }
        ].map((item, idx) => (
          <div key={idx} className="bg-card/30 backdrop-blur-sm border border-border-default/50 rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-card/50 hover:border-accent-blue/30 group min-w-[240px] flex-1">
            <div className={`p-2 rounded-lg bg-accent-${item.color}/10 text-accent-${item.color} group-hover:scale-110 transition-transform`}>
              <item.icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-0.5 whitespace-nowrap">{item.label}</div>
              <div className="text-base font-bold truncate">
                {loading ? (
                  <div className="h-5 w-12 bg-white/5 animate-pulse rounded" />
                ) : (
                  item.value
                )}
              </div>
              <div className="text-[8px] text-text-muted mt-0.5 opacity-60 uppercase truncate">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Diagnostic Workspace - Vertical Stack */}
      <div className="flex flex-col gap-8 pb-10">
        
        {/* Regulations Data Workspace (TOP) - Highly Visible */}
        <div className="flex flex-col bg-card border border-border-default rounded-2xl shadow-sm overflow-hidden min-h-[500px]">
          {/* Workspace Header */}
          <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-default shrink-0">
             <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-secondary/30">
                   <Search className="w-4 h-4 text-text-muted" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-text-primary italic">Indexed Registry</h3>
             </div>

            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted/60" />
              <input 
                type="text" 
                placeholder="Filter regulations by keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0c10] border border-border-default/60 rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 transition-all placeholder:text-text-muted/40"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="bg-[#0a0c10] sticky top-0 z-20">
                <tr>
                  <th className="w-3/4 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border-default">Regulation Identity</th>
                  <th className="w-1/4 px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border-default text-right">Origin Trace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/40">
                {loading ? (
                  [1, 2, 3, 4, 5, 6, 7].map(i => (
                    <tr key={i}>
                      <td className="px-6 py-5">
                         <div className="flex flex-col gap-2">
                           <div className="h-4 bg-white/5 animate-pulse rounded w-2/3" />
                           <div className="h-3 bg-white/5 animate-pulse rounded w-1/4" />
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         <div className="h-8 bg-white/5 animate-pulse rounded w-24 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredRegulations.length > 0 ? (
                  filteredRegulations.map((reg) => {
                    const sourceUrl = reg.metadata?.source_url || reg.metadata?.url;
                    return (
                      <tr key={reg.id} className="hover:bg-accent-blue/[0.03] transition-colors group relative">
                        {/* Selected Indicator */}
                        <td className="px-6 py-4 relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-blue opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-text-primary group-hover:text-accent-blue transition-colors truncate mb-1">
                              {reg.file_name.replace(/_/g, " ").replace(/\.pdf$/i, "").replace(/\.pdf$/i, "")}
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-accent-blue/60 tracking-wider">
                                <Maximize2 className="w-2.5 h-2.5" />
                                <span>Grounding Node</span>
                              </div>
                              <span className="w-1 h-1 rounded-full bg-border-default" />
                              <div className="flex items-center gap-1 text-[9px] text-text-muted font-medium">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>{format(new Date(reg.created_at), "MMM d, yyyy")}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           {sourceUrl ? (
                             <a 
                               href={sourceUrl} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-default bg-[#0a0c10] hover:border-accent-blue text-text-secondary hover:text-accent-blue transition-all group/btn"
                             >
                               <span className="text-[10px] font-bold uppercase tracking-tight">Access</span>
                               <ExternalLink className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                             </a>
                           ) : (
                             <div className="flex items-center justify-end gap-1.5 text-text-muted opacity-40 italic">
                                <Info className="w-3 h-3" />
                                <span className="text-[10px] font-medium uppercase">Internal Vault</span>
                             </div>
                           )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={2} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 max-w-sm mx-auto opacity-50">
                        <AlertCircle className="w-12 h-12 text-text-muted" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold uppercase tracking-wider">Registry Empty</p>
                          <p className="text-xs">No matching regulations found. Initiate a manual sync to reconcile the legal vault.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Status Bar Footer */}
          <div className="px-6 py-3 bg-[#0a0c10] border-t border-border-default flex items-center justify-between shrink-0">
             <div className="text-[9px] font-medium text-text-muted/60 uppercase tracking-widest leading-none">
                Data Grounding Integrity: {filteredRegulations.length > 0 ? "Verified" : "Pending"}
             </div>
             <div className="text-[9px] font-medium text-text-muted/60 leading-none">
                Vault ID: {GLOBAL_LEGAL_CASE_ID.slice(0, 8)}...
             </div>
          </div>
        </div>

        {/* Forensic Terminal (BOTTOM) - Stable Visibility */}
        <div className="flex flex-col bg-card/20 rounded-2xl border border-border-default shadow-lg overflow-hidden min-h-[300px]">
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0a0c10] border-b border-border-default shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5 px-0.5">
                <div className="w-2 h-2 rounded-full bg-[#ff5f56]" />
                <div className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
                <div className="w-2 h-2 rounded-full bg-[#27c93f]" />
              </div>
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-text-muted opacity-80">
                <TerminalIcon className="w-3 h-3" />
                Live_Diagnostic_Trace.sh
              </div>
            </div>
            {syncing && (
              <div className="flex items-center gap-2">
                 <div className="w-1 h-1 rounded-full bg-accent-blue animate-ping" />
                 <span className="text-[8px] font-bold uppercase text-accent-blue tracking-tighter">Syncing...</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 bg-black/40 backdrop-blur-md p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar relative flex flex-col group min-h-[120px]">
             {/* Scanline Effect overlay */}
             <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.01),rgba(0,255,0,0.01),rgba(0,0,255,0.01))] bg-[length:100%_4px,3px_100%] opacity-10" />
            
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center space-y-2 opacity-30">
                 <TerminalIcon className="w-6 h-6" />
                 <p className="text-[10px] uppercase tracking-widest font-bold">Terminal Standby</p>
              </div>
            ) : (
              logs.map((log, i) => {
                const isError = log.includes("Error");
                const isSuccess = log.includes("Success") || log.includes("complete");
                return (
                  <div key={i} className={`mb-1 leading-relaxed transition-all animate-in fade-in slide-in-from-left-1 duration-300 ${
                    isError ? "text-accent-rose bg-accent-rose/5 px-2 py-0.5 rounded" : isSuccess ? "text-accent-teal" : "text-gray-400"
                  }`}>
                    <span className="text-accent-blue/50 mr-2">›</span>
                    <span className="opacity-50 inline-block w-14 mr-1">[{log.match(/\[(.*?)\]/)?.[1] || '--:--:--'}]</span>
                    {log.split('] ')[1] || log}
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
