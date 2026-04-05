"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getGeneratedOutputs, generateReport, getOutputSignedUrl } from "@/lib/api";
import { GeneratedOutput, OutputType } from "@/types";
import { 
  FileText, 
  Download, 
  RotateCw, 
  Plus, 
  Clock, 
  ShieldCheck, 
  Gavel, 
  Users,
  Search,
  ExternalLink,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

// Removed date-fns to keep dependencies lean. Using Intl instead.
const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
};

interface OutputsTabProps {
  caseId: string;
  documentCount?: number;
}

export function OutputsTab({ caseId, documentCount = 0 }: OutputsTabProps) {
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGeneratedOutputs(caseId);
      setOutputs(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch outputs:", err);
      setError("Failed to load generated documents.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async (type: OutputType, title: string) => {
    if (documentCount === 0) return; // guard: no documents
    setGenerating(type);
    try {
      await generateReport(caseId, type, title);
      // Wait a bit and refresh (or the agent will update the DB)
      setTimeout(fetchData, 5000); 
    } catch (err) {
      console.error("Manual generation failed:", err);
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = async (output: GeneratedOutput) => {
    if (!output.file_path) return;
    try {
      const url = await getOutputSignedUrl(caseId, output.file_path);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const templates = [
    {
      id: "judge_report",
      title: "Laporan Hakim Pengawas",
      subtitle: "Periodic report required by Art. 71 UU 37/2004",
      icon: Gavel,
      color: "text-accent-blue",
      bg: "bg-accent-blue/10",
    },
    {
      id: "creditor_list",
      title: "Daftar Piutang Tetap",
      subtitle: "Final verified creditor list for distribution",
      icon: Users,
      color: "text-accent-emerald",
      bg: "bg-accent-emerald/10",
    },
    {
      id: "forensic_summary",
      title: "Forensic Summary",
      subtitle: "Executive summary of red flags and overlaps",
      icon: ShieldCheck,
      color: "text-accent-amber",
      bg: "bg-accent-amber/10",
    }
  ];

  return (
    <div className="h-full flex flex-col space-y-10 pb-12 overflow-y-auto pr-2 scrollbar-none">
      {/* 1. Document Generator Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">Document Factory</h2>
            <p className="text-sm text-text-muted">Generate legally compliant reports from forensic findings.</p>
          </div>
          <button 
            onClick={() => fetchData()}
            className="p-2.5 bg-card border border-border-default rounded-xl text-text-muted hover:text-text-primary transition-all shadow-sm"
          >
            <RotateCw size={18} className={loading ? "animate-spin text-accent-blue" : ""} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div key={tpl.id} className="bg-card group p-6 rounded-3xl border border-border-default shadow-sm hover:shadow-xl hover:border-text-muted/20 transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className={cn("inline-flex p-3 rounded-2xl", tpl.bg, tpl.color)}>
                  <tpl.icon size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-text-primary leading-tight">{tpl.title}</h3>
                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{tpl.subtitle}</p>
                </div>
              </div>
              
              {documentCount === 0 ? (
                <div className="mt-6 w-full py-3 rounded-xl bg-secondary/50 border border-border-default text-[10px] font-black uppercase tracking-widest text-text-muted flex items-center justify-center gap-2 cursor-not-allowed">
                  <AlertCircle size={12} />
                  No Documents Uploaded
                </div>
              ) : (
                <button 
                  onClick={() => handleGenerate(tpl.id as OutputType, tpl.title)}
                  disabled={generating !== null}
                  className={cn(
                    "mt-6 w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                    generating === tpl.id 
                      ? "bg-secondary text-text-muted cursor-not-allowed" 
                      : "bg-text-secondary text-white hover:bg-text-primary shadow-lg shadow-black/5"
                  )}
                >
                  {generating === tpl.id ? (
                    <>
                      <RotateCw size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      New Document
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 2. Generation Archive */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">Case Archive</h2>
            <p className="text-sm text-text-muted">Access and download previous audit versions.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border-default">
            <Search size={14} className="text-text-muted" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Search Archive</span>
          </div>
        </div>

        {error ? (
          <div className="bg-accent-rose/5 border border-accent-rose/20 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4">
             <AlertCircle size={40} className="text-accent-rose" />
             <p className="text-sm font-medium text-text-secondary">{error}</p>
             <button onClick={fetchData} className="px-5 py-2 bg-accent-rose text-white text-xs font-bold rounded-xl uppercase tracking-widest">Retry</button>
          </div>
        ) : outputs.length === 0 && !loading ? (
          <div className="bg-secondary/20 border-2 border-dashed border-border-default rounded-3xl p-16 text-center flex flex-col items-center justify-center space-y-4">
            <div className="p-4 rounded-full bg-background border border-border-default text-text-muted">
              <FileText size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-text-primary">No Documents Yet</h4>
              <p className="text-xs text-text-muted max-w-[240px] mx-auto leading-relaxed">
                Trigger the Output Architect to generate your first professional report.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {loading && outputs.length === 0 ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-20 bg-card/40 animate-pulse rounded-2xl border border-border-default" />
              ))
            ) : (
              outputs.map((output) => (
                <div 
                  key={output.id} 
                  className="bg-card group p-4 rounded-2xl border border-border-default hover:border-text-muted/30 hover:shadow-md transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-secondary text-text-muted group-hover:bg-accent-blue/10 group-hover:text-accent-blue transition-colors">
                      <FileText size={20} />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-text-primary">{output.title}</h4>
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-[9px] font-black uppercase text-text-muted tracking-tighter">
                          {output.output_type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-text-muted font-medium">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatDate(output.created_at)}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-border-default" />
                        <span className="uppercase">{output.metadata.report_id ? "Verified AI Output" : "Manual Entry"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all">
                    <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
                      <ExternalLink size={16} />
                    </button>
                    <button 
                      onClick={() => handleDownload(output)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-text-secondary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-text-primary shadow-lg shadow-black/10"
                    >
                      <Download size={12} />
                      Download PDF
                    </button>
                  </div>
                  
                  <div className="group-hover:hidden text-text-muted/40">
                    <ChevronRight size={18} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
