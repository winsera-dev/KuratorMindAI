"use client";

import React, { useState, useEffect } from "react";
import { Search, FileText, Loader2, Info, ChevronRight, CornerDownRight } from "lucide-react";
import { searchVault, SearchResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DiscoveryTabProps {
  vaultId: string;
  onViewEvidence: (evidence: any) => void;
}

/**
 * Forensic Discovery Tab
 * A high-powered semantic search interface for cross-document analysis.
 */
export function DiscoveryTab({ vaultId, onViewEvidence }: DiscoveryTabProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse["results"]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const response = await searchVault(vaultId, query);
      setResults(response.results);
    } catch (err) {
      console.error("Discovery search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. Forensic Search Input */}
      <section className="relative">
        <form onSubmit={handleSearch} className="group">
          <div className="relative overflow-hidden rounded-3xl bg-card border border-border-default shadow-lg shadow-black/20 focus-within:ring-2 focus-within:ring-accent-cyan/30 transition-all">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-text-muted group-focus-within:text-accent-cyan transition-colors">
              <Search size={20} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari bukti forensic... (Contoh: 'Hutang pajak belum bayar' atau 'Aliran dana mencurigakan')"
              className="w-full bg-transparent border-none py-5 pl-14 pr-32 text-lg focus:outline-none placeholder:text-text-muted/60"
            />
            <div className="absolute inset-y-0 right-3 flex items-center">
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-5 py-2.5 bg-accent-cyan hover:bg-accent-cyan/90 disabled:opacity-50 text-black font-bold rounded-2xl text-sm transition-all shadow-md shadow-accent-cyan/20 active:scale-95"
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
                className="group relative overflow-hidden bg-card border border-border-default rounded-2xl p-5 hover:border-accent-cyan/50 hover:shadow-xl hover:shadow-accent-cyan/5 transition-all cursor-pointer"
                onClick={() => onViewEvidence({
                    chunk_id: res.id,
                    document_id: res.document_id,
                    file_name: res.file_name,
                    page: res.page_number,
                    text_snippet: res.content
                })}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-accent-cyan group-hover:bg-accent-cyan group-hover:text-black transition-colors shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-tight line-clamp-1">
                        {res.file_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-text-muted font-bold">
                        PAGE {res.page_number ?? "?"}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary leading-relaxed line-clamp-3">
                        {res.content}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5 text-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-bold uppercase">View Evidence</span>
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
              <h3 className="font-bold text-text-primary">No exact forensic matches found</h3>
              <p className="text-sm text-text-muted max-w-xs mx-auto">Try broadening your search term or asking a direct question about the estate.</p>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center space-y-6">
            <div className="grid grid-cols-2 gap-3 max-w-lg">
                {[
                    "Audit atas Hutang Pajak",
                    "Aset yang dialihkan (Actio Pauliana)",
                    "Daftar Piutang Perusahaan X",
                    "Analisis Laba Rugi 2024"
                ].map((hint) => (
                    <button
                        key={hint}
                        onClick={() => { setQuery(hint); handleSearch(); }}
                        className="px-4 py-3 text-xs font-medium text-text-secondary bg-card border border-border-default rounded-xl hover:border-accent-cyan hover:text-accent-cyan transition-all text-left flex items-center justify-between group"
                    >
                        {hint}
                        <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </button>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
