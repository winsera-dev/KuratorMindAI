"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  MessageSquare,
  ClipboardList,
  Search,
  FileOutput,
  Upload,
  Trash2,
  RefreshCw,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Bot,
} from "lucide-react";
import {
  checkHealth,
  deleteDocument,
  getChatHistory,
  getDocuments,
  streamChat,
  uploadDocument,
  getDocumentSignedUrl,
  type ChatMessage,
  type VaultDocument,
  type Citation,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { ClaimsTab } from "@/components/vault/ClaimsTab";
import { AuditTab } from "@/components/vault/AuditTab";
import { type Claim } from "@/types";

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS = [
  { id: "sources", label: "Sources", Icon: FileText },
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "claims", label: "Claims", Icon: ClipboardList },
  { id: "audit", label: "Audit", Icon: Search },
  { id: "outputs", label: "Outputs", Icon: FileOutput },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VaultWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: vaultId } = use(params);
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<{
    citation: Citation;
    index: number;
  } | null>(null);

  // Health polling with 2-strike tolerance (prevents flicker during reloads)
  const failCountRef = useRef(0);

  useEffect(() => {
    const poll = async () => {
      const ok = await checkHealth();
      if (ok) {
        failCountRef.current = 0;
        setBackendOnline(true);
      } else {
        failCountRef.current += 1;
        // Only mark offline after 2 consecutive failures
        if (failCountRef.current >= 2) {
          setBackendOnline(false);
        }
      }
    };

    poll(); // Check immediately
    const interval = setInterval(poll, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-primary">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-secondary">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-text-primary">
              Vault — <span className="font-mono text-xs text-text-muted">{vaultId.slice(0, 8)}…</span>
            </h1>
            <p className="text-xs text-text-muted">
              KuratorMind AI Workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Backend status badge */}
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
            backendOnline === null
              ? "bg-elevated border-border-default text-text-muted"
              : backendOnline
              ? "bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald"
              : "bg-accent-rose/10 border-accent-rose/20 text-accent-rose"
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              backendOnline === null ? "bg-current opacity-50" :
              backendOnline ? "bg-accent-emerald agent-working" :
              "bg-accent-rose"
            )} />
            {backendOnline === null ? "Checking…" : backendOnline ? "Agent Online" : "Agent Offline"}
          </div>
          <div className="w-8 h-8 rounded-full bg-elevated border border-border-default flex items-center justify-center text-sm font-medium text-text-secondary">
            K
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
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

      {/* Tab Content */}
      <main className="flex-1 overflow-hidden">
        {/* Keep Sources and Chat mounted to preserve state (like chat history and UI scrolls) */}
        <div className={activeTab === "sources" ? "h-full" : "hidden"}>
          <SourcesTab vaultId={vaultId} />
        </div>
        
        {activeTab === "chat" && (
          <div className="h-full">
            <ChatTab
              vaultId={vaultId}
              onViewSource={(citation, index) => setSelectedCitation({ citation, index })}
            />
          </div>
        )}

        {activeTab === "claims" && (
          <div className="h-full px-6 py-6 bg-primary overflow-y-auto">
            <ClaimsTab 
              vaultId={vaultId} 
              onViewEvidence={(claim) => {
                // For now, if there's evidence, we show the first supporting document
                if (claim.supporting_documents && claim.supporting_documents.length > 0) {
                  const docId = claim.supporting_documents[0];
                  // Use a placeholder citation to trigger the SourceDrawer
                  setSelectedCitation({
                    citation: {
                      chunk_id: "",
                      document_id: docId,
                      page: 1,
                      text_snippet: `Evidence for claim by ${claim.creditor_name}`,
                    },
                    index: 0
                  });
                }
              }}
            />
          </div>
        )}

        {activeTab === "audit" && (
          <div className="h-full px-6 py-6 bg-primary overflow-y-auto">
            <AuditTab 
              vaultId={vaultId} 
              onViewEvidence={(citation) => {
                setSelectedCitation({ citation, index: 0 });
              }}
            />
          </div>
        )}
        {activeTab === "outputs" && <PlaceholderTab name="Outputs" phase="1C" Icon={FileOutput} />}
      </main>

      {/* Source Drawer */}
      {selectedCitation && (
        <SourceDrawer
          isOpen={!!selectedCitation}
          citation={selectedCitation.citation}
          index={selectedCitation.index}
          onClose={() => setSelectedCitation(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources Tab
// ---------------------------------------------------------------------------

function SourcesTab({ vaultId }: { vaultId: string }) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await getDocuments(vaultId);
      setDocuments(res.documents);
      setError(null);
    } catch (err) {
      setError("Failed to load documents. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  // Initial load
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll for status changes when any document is processing
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.status === "processing" || d.status === "pending"
    );

    if (hasProcessing) {
      pollRef.current = setInterval(fetchDocuments, 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [documents, fetchDocuments]);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of fileArr) {
      try {
        const res = await uploadDocument(vaultId, file);
        setDocuments((prev) => [res.document, ...prev]);
      } catch (err) {
        setError(`Failed to upload "${file.name}": ${(err as Error).message}`);
      }
    }

    setUploading(false);
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      setError("Failed to delete document.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6 overflow-y-auto">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-sm">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Upload Zone */}
      <div
        id="upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 group",
          dragOver
            ? "border-accent-blue bg-accent-blue/10 scale-[1.01]"
            : "border-border-default hover:border-accent-blue hover:bg-accent-blue/5"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="file-input"
          className="hidden"
          multiple
          accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-elevated border border-border-default flex items-center justify-center text-text-muted group-hover:text-accent-blue group-hover:border-accent-blue/50 transition-colors">
          {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
        </div>
        <p className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
          {uploading ? "Uploading…" : "Drop files here or click to upload"}
        </p>
        <p className="text-xs text-text-muted mt-1">
          PDF, Excel, CSV, Images — Max 50MB per file
        </p>
      </div>

      {/* Document List */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Vault Documents ({documents.length})
          </h3>
          <button
            id="refresh-documents"
            onClick={fetchDocuments}
            disabled={loading}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-elevated transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-card border border-border-subtle animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText size={32} className="text-text-muted mb-3 opacity-40" />
            <p className="text-sm text-text-muted">No documents in this vault yet.</p>
            <p className="text-xs text-text-muted mt-1">Upload a PDF or Excel file to get started.</p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: VaultDocument;
  onDelete: (id: string) => void;
}) {
  const isExcel = doc.file_type.includes("spreadsheet") || doc.file_type.includes("excel") || doc.file_name.endsWith(".xlsx") || doc.file_name.endsWith(".xls");

  const statusConfig = {
    ready: { label: "Ready", color: "emerald", Icon: CheckCircle2 },
    processing: { label: "Processing…", color: "amber", Icon: Loader2 },
    pending: { label: "Pending", color: "amber", Icon: Loader2 },
    error: { label: "Error", color: "rose", Icon: AlertCircle },
  } as const;

  const st = statusConfig[doc.status];

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border-subtle hover:border-border-default transition-colors group">
      <div className={cn(
        "w-9 h-9 rounded-md flex items-center justify-center text-xs font-bold shrink-0",
        isExcel
          ? "bg-accent-emerald/10 text-accent-emerald"
          : "bg-accent-rose/10 text-accent-rose"
      )}>
        {isExcel ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {doc.file_name}
        </p>
        <p className="text-xs text-text-muted">
          {doc.page_count ? `${doc.page_count} pages` : "Processing"}
          {doc.summary && ` · ${doc.summary.slice(0, 60)}…`}
        </p>
      </div>
      <div className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        doc.status === "ready" ? "bg-accent-emerald/10 text-accent-emerald" :
        doc.status === "error" ? "bg-accent-rose/10 text-accent-rose" :
        "bg-accent-amber/10 text-accent-amber"
      )}>
        <st.Icon
          size={11}
          className={doc.status === "processing" || doc.status === "pending" ? "animate-spin" : ""}
        />
        {st.label}
      </div>
      <button
        id={`delete-doc-${doc.id}`}
        onClick={() => onDelete(doc.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-accent-rose hover:bg-accent-rose/10 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Tab
// ---------------------------------------------------------------------------

interface LocalMessage {
  role: "user" | "assistant";
  content: string;
  agent?: string;
  citations?: Citation[];
  streaming?: boolean;
}

// We use the vaultId directly as the sessionId to create a global, shared workspace chat per Vault.

function ChatTab({ 
  vaultId, 
  onViewSource 
}: { 
  vaultId: string;
  onViewSource: (citation: Citation, index: number) => void;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>([
    {
      role: "assistant",
      content:
        "Selamat datang di KuratorMind AI. Saya siap membantu Anda menganalisis dokumen vault ini.\n\nAnda dapat bertanya tentang:\n• Verifikasi dan detail klaim kreditur\n• Analisis laporan keuangan\n• Status dokumen yang telah diunggah\n• Regulasi kepailitan Indonesia\n\nApa yang ingin Anda periksa?",
      agent: "lead_orchestrator",
    },
  ]);
  const [message, setMessage] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>("");

  // Initialize session + load history
  useEffect(() => {
    if (!vaultId) return;
    sessionId.current = vaultId;

    getChatHistory(sessionId.current)
      .then((res) => {
        if (res.messages.length > 0) {
          setMessages(
            res.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
              agent: m.agent_name ?? undefined,
              citations: m.citations,
            }))
          );
        }
      })
      .catch((err) => {
        console.error("Failed to load history:", err);
      })
      .finally(() => setHistoryLoaded(true));
  }, [vaultId]);

  // Auto-scroll on new messages or history load
  useEffect(() => {
    if (historyLoaded) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, historyLoaded]);

  const handleSend = async () => {
    if (!message.trim() || streaming) return;

    const userText = message.trim();
    setMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setStreaming(true);
    setAgentStatus("Analyzing request…");

    // Add empty assistant placeholder
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", agent: "lead_orchestrator", streaming: true },
    ]);

    try {
      await streamChat(
        {
          vault_id: vaultId,
          session_id: sessionId.current,
          message: userText,
        },
        {
          onToken: (text) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + text,
                };
              }
              return updated;
            });
          },
          onStatus: (_, msg) => setAgentStatus(msg),
          onDone: (content, citations) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content,
                  citations,
                  streaming: false,
                };
              }
              return updated;
            });
            setAgentStatus("");
          },
          onError: (err) => {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: `⚠️ Error: ${err}`,
                agent: "system",
              };
              return updated;
            });
          },
        }
      );
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "⚠️ Agent backend tidak dapat dihubungi. Pastikan server berjalan di `localhost:8000`.\n\n```\ncd apps/agents\nsource .venv/bin/activate\nuvicorn kuratormind.api.main:app --reload\n```",
          agent: "system",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      setAgentStatus("");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-elevated border border-border-default flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Bot size={13} className="text-accent-cyan" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "bg-accent-blue text-white rounded-tr-sm"
                  : "bg-card border border-border-subtle text-text-primary rounded-tl-sm"
              )}
            >
              {msg.role === "assistant" && msg.agent && msg.agent !== "system" && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                  <span className="text-xs text-accent-cyan font-mono">
                    {msg.agent}
                  </span>
                </div>
              )}
              <div className="text-sm leading-relaxed text-text-primary">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-accent-blue pl-3 italic opacity-90 my-2">{children}</blockquote>,
                    code: ({ children }) => <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                    pre: ({ children }) => <pre className="bg-black/10 dark:bg-white/10 p-3 rounded-lg overflow-x-auto my-2 text-xs">{children}</pre>,
                    a: ({ href, children }) => {
                      if (href?.startsWith("#cite-")) {
                        const index = parseInt(href.replace("#cite-", ""));
                        const citation = msg.citations?.find((_, i) => i + 1 === index);
                        return (
                          <CitationBadge
                            index={index}
                            citation={citation}
                            onViewSource={onViewSource}
                          />
                        );
                      }
                      return <a href={href} className="text-accent-blue hover:underline" target="_blank" rel="noreferrer">{children}</a>;
                    }
                  }}
                >
                  {msg.content.replace(/\[(\d+)\]/g, "[[$1]](#cite-$1)")}
                </ReactMarkdown>
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-3.5 bg-accent-cyan ml-1 animate-pulse rounded-sm align-middle" />
                )}
              </div>
            </div>
          </div>
        ))}

        {streaming && agentStatus && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-elevated border border-border-default flex items-center justify-center shrink-0 mr-2">
              <Bot size={13} className="text-accent-cyan" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-sm bg-card border border-border-subtle">
              <Loader2 size={12} className="animate-spin text-accent-cyan" />
              <span className="text-xs text-text-muted">{agentStatus}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border-default bg-secondary">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            id="chat-input"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Tanyakan tentang kasus ini…"
            disabled={streaming}
            className="flex-1 px-4 py-3 rounded-xl bg-card border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/40 transition-all text-sm disabled:opacity-60"
          />
          <button
            id="send-button"
            onClick={handleSend}
            disabled={!message.trim() || streaming}
            className="p-3 rounded-xl bg-accent-blue text-white hover:bg-accent-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder Tab
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Citation Components
// ---------------------------------------------------------------------------

function CitationBadge({
  index,
  citation,
  onViewSource,
}: {
  index: number;
  citation?: Citation;
  onViewSource: (citation: Citation, index: number) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span className="relative inline-block mx-0.5 align-baseline">
      <button
        onClick={() => citation && onViewSource(citation, index)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-sm bg-elevated border border-border-default text-accent-cyan hover:bg-accent-cyan hover:text-white transition-colors cursor-help"
      >
        {index}
      </button>

      {showTooltip && citation && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-card border border-border-default shadow-xl z-50 animate-in fade-in slide-in-from-bottom-1">
          <div className="flex items-start gap-2 mb-2 pb-1.5 border-b border-border-subtle">
            <span className="p-1 rounded bg-accent-cyan/10 text-accent-cyan">
              <FileText size={12} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-text-primary">
                [{citation.file_name}, p.{citation.page}]
              </p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">
                Standard Forensic Citation
              </p>
            </div>
          </div>
          <p className="text-[11px] text-text-secondary italic line-clamp-4 leading-relaxed">
            "{citation.text_snippet}"
          </p>
          <div className="mt-2 flex justify-between items-center">
             <span className="text-[9px] text-text-muted italic">Click to view source</span>
            <span className="text-[9px] font-mono text-accent-cyan opacity-70 uppercase tracking-wider">
              Verification Required
            </span>
          </div>
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Source Drawer
// ---------------------------------------------------------------------------

function SourceDrawer({
  isOpen,
  citation,
  index,
  onClose,
}: {
  isOpen: boolean;
  citation: Citation;
  index: number;
  onClose: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!citation.document_id) return;
      try {
        const res = await getDocumentSignedUrl(citation.document_id);
        // Add page jump for PDFs
        const url = res.file_type.includes("pdf") 
          ? `${res.signed_url}#page=${citation.page}` 
          : res.signed_url;
        setSignedUrl(url);
      } catch (err) {
        console.error("Failed to load source URL:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUrl();
  }, [citation]);

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 w-[45%] bg-primary border-l border-border-default shadow-2xl z-[100] flex flex-col transition-all duration-300 ease-in-out",
      isOpen ? "translate-x-0" : "translate-x-full"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border-default flex items-center justify-between bg-secondary">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-cyan/10 text-accent-cyan">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary truncate max-w-[300px]">
              {citation.file_name}
            </h3>
            <p className="text-xs text-text-muted">
              Reference [{index}] — Page {citation.page}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-tertiary text-text-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Snippet Context */}
        <div className="p-6 bg-elevated border-b border-border-subtle">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-accent-cyan rounded-full" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Forensic Excerpt
            </span>
          </div>
          <p className="text-sm text-text-primary leading-relaxed italic border-l-2 border-accent-blue/30 pl-4 py-1">
            "{citation.text_snippet}"
          </p>
        </div>

        {/* File Viewer */}
        <div className="flex-1 bg-black/5 dark:bg-white/5 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
              <Loader2 className="animate-spin text-accent-cyan" size={32} />
              <span className="text-xs text-text-muted">Loading forensic document…</span>
            </div>
          ) : signedUrl ? (
            <iframe 
              src={signedUrl} 
              className="w-full h-full border-none"
              title="Forensic Source Viewer"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center flex-col gap-4">
              <AlertCircle size={48} className="text-border-default opacity-40" />
              <p className="text-sm text-text-muted max-w-xs">
                Could not load the original document view. 
                The forensic excerpt above is still verifiable.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceholderTab({
  name,
  phase,
  Icon,
}: {
  name: string;
  phase: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-elevated border border-border-default flex items-center justify-center">
          <Icon size={24} className="text-text-muted opacity-40" />
        </div>
        <h2 className="text-lg font-semibold text-text-secondary">
          {name} — Coming in Phase {phase}
        </h2>
        <p className="text-sm text-text-muted max-w-md">
          This feature will be available once the current phase is complete.
          The agent brain takes priority first.
        </p>
        <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
          <ChevronRight size={12} />
          <span>Phase 1A → 1B → 1C</span>
        </div>
      </div>
    </div>
  );
}
