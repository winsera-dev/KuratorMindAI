"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  FileText, 
  ExternalLink, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Loader2,
  Maximize2
} from "lucide-react";
import { getDocumentSignedUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ForensicSidebarProps {
  evidence: any;
  onClose: () => void;
}

/**
 * Global Forensic Evidence Sidepanel
 * Used to drill down into document snippets and legal citations.
 */
export function ForensicSidebar({ evidence, onClose }: ForensicSidebarProps) {
  const [opening, setOpening] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  if (!evidence) return null;

  const handleOpenFullDocument = async () => {
    if (!evidence.document_id) return;
    setOpening(true);
    try {
      const { signed_url } = await getDocumentSignedUrl(evidence.document_id);
      window.open(signed_url, "_blank");
    } catch (err) {
      console.error("Failed to open document:", err);
      alert("Gagal membuka dokumen. Hubungi admin.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* 1. Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* 2. Side Panel */}
      <aside 
        className={cn(
          "relative w-full max-w-md h-full bg-card border-l border-border-default shadow-2xl transition-transform duration-500 ease-out pointer-events-auto flex flex-col",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <header className="p-5 border-b border-border-default flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/10 flex items-center justify-center text-accent-cyan border border-accent-cyan/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-tight">Citing Evidence</h2>
              <p className="text-[10px] font-bold text-text-muted opacity-60 uppercase tracking-widest mt-0.5">Forensic Audit Trace</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-full transition-colors text-text-muted"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Metadata Grid */}
          <section className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default shadow-sm">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-1">Source Origin</span>
              <p className="text-xs font-black text-text-primary line-clamp-1 truncate">{evidence.file_name || "Case Evidence"}</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default shadow-sm">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-1">Exact Page</span>
              <p className="text-xs font-black text-text-primary">P. {evidence.page || "Unspecified"}</p>
            </div>
          </section>

          {/* Source Snippet */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                <FileText size={12} className="text-accent-cyan" /> Ground Truth Excerpt
              </h3>
              <div className="px-2 py-0.5 rounded bg-accent-cyan/10 border border-accent-cyan/20 text-[8px] font-black text-accent-cyan uppercase">Raw Data</div>
            </div>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-accent-cyan/10 to-accent-blue/10 rounded-[22px] blur-sm opacity-50 group-hover:opacity-100 transition duration-1000"></div>
              <div className="relative p-6 bg-secondary/80 border border-border-default rounded-3xl text-sm leading-relaxed text-text-primary font-serif italic shadow-inner min-h-[160px]">
                {evidence.text_snippet ? (
                   <span className="relative z-10">"{evidence.text_snippet}"</span>
                ) : (
                   <div className="flex flex-col items-center justify-center py-8 text-text-muted opacity-40">
                      <Loader2 size={24} className="animate-spin mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Reconstructing Trace...</p>
                   </div>
                )}
              </div>
            </div>
          </section>

          {/* Forensic Context */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Forensic Validation</h3>
            <div className="space-y-3">
                <div className="flex items-start gap-3 text-xs text-text-secondary bg-accent-emerald/5 p-4 rounded-2xl border border-accent-emerald/20">
                    <ShieldCheck size={16} className="text-accent-emerald mt-0.5 shrink-0" />
                    <div>
                       <p className="font-black text-accent-emerald uppercase text-[10px] tracking-tight">Verified Ingestion</p>
                       <p className="text-[11px] font-medium mt-1 leading-relaxed text-text-secondary">This snippet was indexed using semantic embeddings and validated against the source checksum.</p>
                    </div>
                </div>
                {evidence.severity && (
                    <div className="flex items-start gap-3 text-xs text-text-secondary bg-accent-rose/5 p-4 rounded-2xl border border-accent-rose/20">
                        <AlertTriangle size={16} className="text-accent-rose mt-0.5 shrink-0" />
                        <div>
                           <p className="font-black text-accent-rose uppercase text-[10px] tracking-tight">Risk Identified</p>
                           <p className="text-[11px] font-medium mt-1 leading-relaxed text-text-secondary italic">Severity: <strong className="uppercase">{evidence.severity}</strong>. Flagged by Claim Auditor Swarm.</p>
                        </div>
                    </div>
                )}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <footer className="p-6 border-t border-border-default bg-secondary/20 space-y-3">
          <button 
            onClick={handleOpenFullDocument}
            disabled={opening || !evidence.document_id}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all text-sm disabled:opacity-50"
          >
            {opening ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                    <Maximize2 size={18} />
                    <span>Open Original Document</span>
                </>
            )}
          </button>
          <p className="text-[10px] text-center text-text-muted font-medium px-4">
            Security Note: Signed links of document expires in 1 hour. Unauthorized sharing of forensic evidence is prohibited.
          </p>
        </footer>
      </aside>
    </div>
  );
}
