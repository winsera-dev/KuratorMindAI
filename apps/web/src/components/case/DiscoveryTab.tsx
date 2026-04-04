"use client";

import React, { useState, useEffect } from "react";
import { Search, FileText, Loader2, Info, ChevronRight, CornerDownRight, Gavel } from "lucide-react";
import { searchCase, searchRegulations, SearchResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DiscoveryTabProps {
  caseId: string;
  onViewEvidence: (evidence: any) => void;
}

/**
 * Forensic Discovery Tab
 * A high-powered semantic search interface for cross-document analysis.
 */
export function DiscoveryTab({ caseId, onViewEvidence }: DiscoveryTabProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse["results"]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<"case" | "regulations">("case");

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const response = searchMode === "case" 
        ? await searchCase(caseId, query)
        : await searchRegulations(query);
      setResults(response.results);
    } catch (err) {
      console.error("Discovery search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. Forensic Search Toggle & Input */}
      <section className="space-y-4">
        <div className="flex items-center justify-center">
            <div className="inline-flex p-1 bg-secondary rounded-2xl border border-border-default shadow-sm">
                <button 
                  onClick={() => { setSearchMode("case"); setResults([]); setHasSearched(false); }}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    searchMode === "case" ? "bg-card text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                    <FileText size={14} />
                    Evidence
                </button>
                <button 
                  onClick={() => { setSearchMode("regulations"); setResults([]); setHasSearched(false); }}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    searchMode === "regulations" ? "bg-accent-cyan text-black shadow-lg shadow-accent-cyan/20" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                    <Gavel size={14} />
                    Indonesian Law
                </button>
            </div>
        </div>

        <form onSubmit={handleSearch} className="group">
          <div className={cn(
            "relative overflow-hidden rounded-3xl bg-card border shadow-lg shadow-black/20 focus-within:ring-2 focus-within:ring-accent-cyan/30 transition-all",
            searchMode === "regulations" ? "border-accent-cyan/30" : "border-border-default"
          )}>
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-text-muted group-focus-within:text-accent-cyan transition-colors">
              {searchMode === "case" ? <Search size={20} /> : <Gavel size={20} className="text-accent-cyan" />}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === "case" 
                ? "Cari bukti forensic... (Contoh: 'Hutang pajak' atau 'Aliran dana')" 
                : "Cari dasar hukum... (Contoh: 'Actio Pauliana' atau 'Priority Debt')"
              }
              className="w-full bg-transparent border-none py-5 pl-14 pr-32 text-lg focus:outline-none placeholder:text-text-muted/60"
            />
            <div className="absolute inset-y-0 right-3 flex items-center">
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className={cn(
                    "px-5 py-2.5 font-bold rounded-2xl text-sm transition-all shadow-md active:scale-95",
                    searchMode === "case" 
                        ? "bg-accent-blue text-white shadow-accent-blue/20" 
                        : "bg-accent-cyan text-black shadow-accent-cyan/20"
                )}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Search"}
              </button>
            </div>
          </div>
        </form>
        <div className="mt-3 flex items-center gap-4 px-2">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5 opacity-60">
                <Info size={10} /> Forensic Vector Engine (Gemini 2.5)
            </span>
        </div>
      </section>

      {/* 2. Results Section */}
      <section className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-secondary/50 rounded-2xl animate-pulse border border-border-default/50" />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4 pb-10">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
                    Found {results.length} relevant excerpts
                </h3>
            </div>
            {results.map((res) => (
              <div 
                key={res.id} 
                className={cn(
                    "group relative overflow-hidden bg-card border rounded-2xl p-5 transition-all cursor-pointer",
                    searchMode === "case" ? "hover:border-accent-cyan/50" : "hover:border-accent-cyan/80 bg-accent-cyan/[0.02]"
                )}
                onClick={() => onViewEvidence({
                    chunk_id: res.id,
                    document_id: res.document_id,
                    file_name: res.file_name,
                    page: res.page_number,
                    text_snippet: res.content
                })}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "mt-1 w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                    searchMode === "case" ? "bg-secondary text-accent-cyan group-hover:bg-accent-blue group-hover:text-white" : "bg-accent-cyan/20 text-accent-cyan group-hover:bg-accent-cyan group-hover:text-black"
                  )}>
                    {searchMode === "case" ? <FileText size={16} /> : <Gavel size={16} />}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-tight line-clamp-1">
                        {res.file_name || (searchMode === "regulations" ? "Global Legal Case" : "Unknown Source")}
                      </span>
                      {res.page_number && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-text-muted font-bold">
                            PAGE {res.page_number}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-primary leading-relaxed line-clamp-3">
                        {res.content}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5 text-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {searchMode === "case" ? "View Evidence" : "Cite Regulation"}
                            </span>
                            <CornerDownRight size={10} />
                        </div>
                        {res.similarity_score && (
                            <span className="text-[10px] font-mono text-text-muted opacity-50">
                                Match: {Math.round(res.similarity_score * 100)}%
                            </span>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched && !loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 bg-secondary/20 rounded-3xl border border-dashed border-border-default">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Search className="text-text-muted opacity-30" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-text-primary">
                {searchMode === "case" ? "No forensic matches found" : "No regulatory matches found"}
              </h3>
              <p className="text-sm text-text-muted max-w-xs mx-auto">Try broadening your search term or asking a direct legal question.</p>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center space-y-6">
            <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {(searchMode === "case" 
                    ? ["Audit atas Hutang Pajak", "Aset dialihkan (Actio Pauliana)", "Rasio Solvabilitas Q4", "Kontradiksi Invoice"]
                    : ["UU 37/2004 Pasal 41", "Hak Tanggungan PKPU", "Priority Payments Law", "PSAK 71 Impairment"]
                ).map((hint) => (
                    <button
                        key={hint}
                        onClick={() => { setQuery(hint); handleSearch(); }}
                        className="px-4 py-3 text-xs font-bold text-text-secondary bg-card border border-border-default rounded-xl hover:border-accent-cyan hover:text-accent-cyan transition-all text-left flex items-center justify-between group shadow-sm active:scale-95"
                    >
                        <span className="truncate pr-2">{hint}</span>
                        <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all shrink-0" />
                    </button>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
