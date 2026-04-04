"use client";

import { useEffect, useState } from "react";
import { 
  ShieldAlert, 
  Users, 
  Search, 
  ExternalLink, 
  AlertTriangle,
  Fingerprint,
  RefreshCw,
  Loader2,
  ChevronRight,
  GanttChartSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGlobalConflicts } from "@/lib/api";
import { 
  type AuditFlag, 
  type GlobalEntity, 
  type Citation 
} from "@/types";

interface CrossCaseTabProps {
  caseId: string;
  onViewEvidence: (evidence: Citation) => void;
}

export function CrossCaseTab({ caseId, onViewEvidence }: CrossCaseTabProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    conflicts: AuditFlag[];
    entities: GlobalEntity[];
  }>({ conflicts: [], entities: [] });
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getGlobalConflicts(caseId);
      setData(res);
      setError(null);
    } catch (err) {
      setError("Failed to fetch cross-case intelligence data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 size={32} className="animate-spin text-accent-cyan mb-4" />
        <p className="text-sm text-text-muted">Analyzing global patterns across KuratorMind network…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Fingerprint className="text-accent-cyan" size={24} />
            Cross-Case Intelligence
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Detecting systemic fraud, repeated bankruptcies, and global conflicts of interest.
          </p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-elevated border border-border-default hover:bg-tertiary transition-all text-sm text-text-secondary"
        >
          <RefreshCw size={14} />
          Refresh Analysis
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-sm flex items-center gap-3">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Conflicts & High Risk */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
              <ShieldAlert size={14} />
              Systemic Conflicts ({data.conflicts.length})
            </h3>
            
            {data.conflicts.length === 0 ? (
              <div className="p-8 rounded-2xl bg-card border border-border-subtle text-center">
                <ShieldAlert size={32} className="mx-auto text-text-muted mb-3 opacity-30" />
                <p className="text-sm text-text-muted italic">No global conflicts detected for this case.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.conflicts.map((flag) => (
                  <ConflictCard 
                    key={flag.id} 
                    flag={flag} 
                    onViewEvidence={onViewEvidence} 
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
              <GanttChartSquare size={14} />
              Precedents & Similar Patterns
            </h3>
            <div className="p-6 rounded-2xl bg-tertiary border border-border-default flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  Discovery Search across all cases
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Search legal strategies or document patterns from other insolvency cases.
                </p>
              </div>
              <button 
                className="p-2 rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-all font-medium text-xs flex items-center gap-2"
                onClick={() => {
                  const searchTab = document.getElementById('tab-search');
                  if (searchTab) searchTab.click();
                }}
              >
                <Search size={14} />
                Open Global Search
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Entity Overlap */}
        <div className="space-y-6">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
              <Users size={14} />
              Entity Overlap ({data.entities.length})
            </h3>
            <div className="space-y-2">
              {data.entities.length === 0 ? (
                <p className="text-sm text-text-muted italic px-2">No overlapping entities found.</p>
              ) : (
                data.entities.map((entity) => (
                  <div 
                    key={entity.id}
                    className="p-3 rounded-xl bg-card border border-border-subtle hover:border-accent-cyan/40 transition-all group cursor-default"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-text-primary px-2 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan">
                        {entity.entity_type.toUpperCase()}
                      </span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                        entity.risk_score > 0.7 ? "bg-accent-rose/10 text-accent-rose" : "bg-accent-emerald/10 text-accent-emerald"
                      )}>
                        Risk: {(entity.risk_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-text-primary mt-2">{entity.name}</p>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle">
                       <span className="text-[10px] text-text-muted">Detected in 3+ cases</span>
                       <button className="text-[10px] flex items-center gap-1 text-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                         Details <ChevronRight size={10} />
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ConflictCard({ 
  flag, 
  onViewEvidence 
}: { 
  flag: AuditFlag; 
  onViewEvidence: (ev: Citation) => void;
}) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border-subtle hover:border-accent-rose/30 transition-all relative overflow-hidden group">
      {/* Risk Indicator bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-accent-rose/20" />
      <div className="absolute top-0 left-0 w-1/3 h-1 bg-accent-rose animate-shimmer" />

      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent-rose/10 flex items-center justify-center text-accent-rose shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-base font-bold text-text-primary">
              {flag.title}
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-accent-rose/20 text-accent-rose text-[10px] font-bold uppercase tracking-wider">
              {flag.severity} RISK
            </span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            {flag.description}
          </p>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {flag.evidence.map((ev: any, i: number) => (
              <button
                key={i}
                onClick={() => onViewEvidence({
                  document_id: ev.document_id,
                  chunk_id: "", // Placeholder for global evidence
                  file_name: `Evidence ${i+1}`,
                  page: ev.page,
                  text_snippet: ev.excerpt
                })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elevated border border-border-default hover:bg-tertiary transition-all text-[11px] font-medium text-text-muted"
              >
                <div className="w-4 h-4 rounded bg-accent-rose/20 flex items-center justify-center text-[9px] font-bold text-accent-rose">v.{ev.case_id?.slice(0,4) || "S"}</div>
                <span>View Evidence Snapshot</span>
                <ExternalLink size={10} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
