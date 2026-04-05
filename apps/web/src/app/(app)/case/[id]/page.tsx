"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  ClipboardList,
  Search,
  FileOutput,
  Pencil,
  Hash,
} from "lucide-react";
import { 
  checkHealth, 
  getDocuments, 
  getCase,
  type CaseDocument,
  type Citation,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { ClaimsTab } from "@/components/case/ClaimsTab";
import { AuditTab } from "@/components/case/AuditTab";
import { DiscoveryTab } from "@/components/case/DiscoveryTab";
import { CrossCaseTab } from "@/components/case/CrossCaseTab";
import { OutputsTab } from "@/components/case/OutputsTab";
import { ForensicSidebar } from "@/components/case/ForensicSidebar";
import { CaseStatusBadge } from "@/components/case/CaseStatusBadge";
import CaseModal from "@/components/modals/CaseModal";
import { type Case } from "@/types";

// Modular Tabs
import { ChatTab } from "@/components/case/ChatTab";
import { SourcesTab } from "@/components/case/SourcesTab";

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS = [
  { id: "sources", label: "Sources", Icon: FileText },
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "search", label: "Discovery", Icon: Search },
  { id: "claims", label: "Claims", Icon: ClipboardList },
  { id: "audit", label: "Audit", Icon: ClipboardList },
  { id: "intelligence", label: "Intelligence", Icon: Search },
  { id: "outputs", label: "Outputs", Icon: FileOutput },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Main Workspace Component
// ---------------------------------------------------------------------------

export default function CaseWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [isCaseScanning, setIsCaseScanning] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Health polling setup
  const failCountRef = useRef(0);

  const checkCaseStatus = useCallback(async () => {
    try {
      const docsData = await getDocuments(caseId);
      const scanning = docsData.documents.some(d => d.status === "pending" || d.status === "processing");
      setIsCaseScanning(scanning);
      setDocumentCount(docsData.count);
    } catch (err) {
      console.error("Status check failed:", err);
    }
  }, [caseId]);

  useEffect(() => {
    const poll = async () => {
      const ok = await checkHealth();
      if (ok) {
        failCountRef.current = 0;
        setBackendOnline(true);
      } else {
        failCountRef.current += 1;
        if (failCountRef.current >= 2) setBackendOnline(false);
      }
      
      // Also check case document status during health check
      checkCaseStatus();
    };

    poll(); 
    const interval = setInterval(poll, 5000);

    getCase(caseId).then(setCaseData).catch(console.error);

    return () => clearInterval(interval);
  }, [caseId, checkCaseStatus]);

  return (
    <div className="h-screen flex flex-col bg-primary">
      {/* 1. Forensic Header */}
      <header className="flex h-20 items-center justify-between px-6 border-b border-border-default bg-secondary/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2 overflow-hidden">
          <Link
            href="/"
            className="p-1.5 hover:bg-bg-elevated rounded-lg text-text-muted hover:text-text-primary transition-all group shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          </Link>

          <div className="flex items-center gap-4 overflow-hidden ml-1">
            <div className="flex flex-col justify-center gap-0.5">
              <h1 className="text-lg font-black text-text-primary whitespace-nowrap truncate max-w-[320px] lg:max-w-xl tracking-tight leading-tight">
                {caseData?.debtor_entity || caseData?.name || "Initializing workspace..."}
              </h1>
              
              {caseData?.case_number && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-bg-elevated/50 border border-border-subtle text-[10px] font-mono font-bold text-text-muted/60 uppercase tracking-[0.1em] w-fit">
                  <Hash size={10} className="opacity-40" />
                  {caseData.case_number}
                </div>
              )}
            </div>

            {caseData && (
              <div className="flex items-center gap-2 shrink-0 ml-1 mt-0.5">
                <CaseStatusBadge caseData={caseData} readOnly={true} />
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-1.5 hover:bg-bg-elevated rounded border border-transparent hover:border-border-default text-text-muted hover:text-accent-blue transition-all"
                  title="Edit Case Intelligence"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-6 items-center">
          <div className={cn(
            "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500",
            backendOnline === null
              ? "bg-bg-secondary border-border-default text-text-muted"
              : backendOnline
              ? "bg-accent-emerald/5 border-accent-emerald/20 text-accent-emerald shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)]"
              : "bg-accent-rose/10 border-accent-rose/20 text-accent-rose"
          )}>
            <div className="relative flex h-1.5 w-1.5">
              {backendOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-emerald opacity-75"></span>
              )}
              <span className={cn(
                "relative inline-flex rounded-full h-1.5 w-1.5",
                backendOnline === null ? "bg-text-muted" :
                backendOnline ? "bg-accent-emerald" :
                "bg-accent-rose"
              )}></span>
            </div>
            {backendOnline === null ? "Syncing" : backendOnline ? "Agent Online" : "Agent Offline"}
          </div>
          
          <div className="h-9 w-9 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-[12px] font-black text-accent-blue uppercase shrink-0">
            {caseData?.name?.slice(0, 1) || "K"}
          </div>
        </div>
      </header>

      {/* 2. Tab Navigation */}
      <nav className="flex items-center gap-1 px-4 py-2 border-b border-border-default bg-secondary">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === id
                ? "bg-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary hover:bg-tertiary"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {/* 3. Main Stage */}
      <main className="flex-1 overflow-hidden relative">
        <div className={activeTab === "sources" ? "h-full" : "hidden"}>
          <SourcesTab caseId={caseId} />
        </div>
        
        <div className={activeTab === "chat" ? "h-full" : "hidden"}>
          <ChatTab
              caseId={caseId}
              onViewSource={(citation) => setSelectedEvidence(citation)}
          />
        </div>

        {activeTab === "search" && (
          <div className="h-full px-8 py-10 bg-primary overflow-y-auto">
            <DiscoveryTab 
                caseId={caseId} 
                onViewEvidence={(ev) => setSelectedEvidence(ev)} 
            />
          </div>
        )}

        {activeTab === "claims" && (
          <div className="h-full px-6 py-6 bg-primary overflow-y-auto">
            <ClaimsTab 
              caseId={caseId} 
              isScanningOverride={isCaseScanning}
              onViewEvidence={(claim) => {
                if (claim.supporting_documents && claim.supporting_documents.length > 0) {
                  setSelectedEvidence({
                    document_id: claim.supporting_documents[0],
                    file_name: claim.creditor_name,
                    page: 1,
                    text_snippet: `Evidence for claim of ${claim.creditor_name}`
                  });
                }
              }}
            />
          </div>
        )}

        {activeTab === "audit" && (
          <div className="h-full px-6 py-6 bg-primary overflow-y-auto">
            <AuditTab 
              caseId={caseId} 
              isScanningOverride={isCaseScanning}
              onViewEvidence={(ev: Citation) => setSelectedEvidence(ev)}
            />
          </div>
        )}
        
        {activeTab === "intelligence" && (
          <div className="h-full px-6 py-6 bg-primary overflow-y-auto">
            <CrossCaseTab 
              caseId={caseId} 
              onViewEvidence={(ev: Citation) => setSelectedEvidence(ev)}
            />
          </div>
        )}

        {activeTab === "outputs" && (
          <div className="h-full px-8 py-10 bg-primary overflow-y-auto">
            <OutputsTab caseId={caseId} documentCount={documentCount} />
          </div>
        )}
      </main>

      {/* 4. Forensic Sidebar (Contextual Drill-down) */}
      {selectedEvidence && (
        <ForensicSidebar
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}

      {/* 5. Case Modal (Unified Intelligence Management) */}
      {caseData && (
        <CaseModal
          mode="edit"
          initialData={caseData}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updated) => updated && setCaseData(updated)}
        />
      )}
    </div>
  );
}
