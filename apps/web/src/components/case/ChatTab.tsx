"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Info,
  FileText,
  FileSearch,
  Network
} from "lucide-react";
import { streamChat, getChatHistory, type Citation } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatTabProps {
  caseId: string;
  onViewSource: (citation: Citation, index: number) => void;
}

interface LocalMessage {
  role: "user" | "assistant";
  content: string;
  agent?: string;
  citations?: Citation[];
  streaming?: boolean;
}

export function ChatTab({ caseId, onViewSource }: ChatTabProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([
    {
      role: "assistant",
      content:
        "Selamat datang di KuratorMind AI. Saya Lead Orchestrator, spesialis forensik PKPU Anda. Saya mengoordinasikan tim agen (Regulatory Scholar, Forensic Accountant, Claim Auditor) untuk membantu Anda.\n\nAnda dapat bertanya tentang:\n• Verifikasi dan detail klaim kreditur\n• Laporan dan analisis rasio keuangan\n• Status dokumen yang telah diunggah\n• Interpretasi UU 37/2004",
      agent: "lead_orchestrator",
    },
  ]);
  const [message, setMessage] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [agentConfidence, setAgentConfidence] = useState<number | undefined>(undefined);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>("");

  // Initialize session + load history
  useEffect(() => {
    if (!caseId) return;
    sessionId.current = caseId; // Global shared workspace chat per Case

    getChatHistory(sessionId.current)
      .then((res) => {
        if (res.messages && res.messages.length > 0) {
          setMessages(
            res.messages.map((m: any) => ({
              role: m.role,
              content: m.content || "",
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
  }, [caseId]);

  useEffect(() => {
    if (historyLoaded) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, historyLoaded]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || streaming) return;

    const userText = message.trim();
    setMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setStreaming(true);
    setAgentStatus("Contextualizing evidence…");

    // Add empty assistant placeholder
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", agent: "lead_orchestrator", streaming: true },
    ]);

    try {
      await streamChat(
        {
          case_id: caseId,
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
          onStatus: (_, msg, confidence) => {
            setAgentStatus(msg);
            if (confidence !== undefined) {
                setAgentConfidence(confidence);
            }
          },
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
            setAgentConfidence(undefined);
          },
          onError: (err) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                    ...last,
                    content: `⚠️ Error: ${err}`,
                    agent: "system",
                    streaming: false
                };
              }
              return updated;
            });
          },
        }
      );
    } catch (err) {
        console.error("Chat fetch fail:", err);
    } finally {
      setStreaming(false);
      setAgentStatus("");
      setAgentConfidence(undefined);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-sm rounded-3xl border border-border-default overflow-hidden shadow-2xl">
      {/* 1. Chat Header */}
      <div className="px-6 py-4 border-b border-border-default bg-elevated/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-blue/10 flex items-center justify-center text-accent-blue shadow-inner shadow-accent-blue/20">
            <Network size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">KuratorMind AI Swarm</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                <span className="text-[10px] font-bold text-accent-emerald uppercase tracking-widest">{agentStatus ? "Agent Working..." : "Swarm Engine Ready"}</span>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest leading-none">Security Protocol</p>
                <p className="text-[10px] font-black text-accent-blue uppercase tracking-tight mt-1">Grounding Activated</p>
            </div>
            <div className="w-px h-8 bg-border-default opacity-50" />
            <div className="p-2 rounded-xl bg-secondary text-text-muted hover:text-text-primary transition-colors cursor-help">
                <ShieldCheck size={18} />
            </div>
        </div>
      </div>

      {/* 2. Messages Core */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
        {!historyLoaded ? (
          <div className="space-y-8">
            {/* Assistant Skeleton */}
            <div className="flex gap-4 max-w-[80%] animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-accent-blue/10 shrink-0" />
              <div className="space-y-3 w-full">
                <div className="h-4 bg-secondary/60 rounded-full w-[40%]" />
                <div className="h-20 bg-secondary/40 rounded-3xl rounded-tl-none border border-border-subtle/50" />
              </div>
            </div>
            {/* User Skeleton */}
            <div className="flex gap-4 max-w-[70%] ml-auto flex-row-reverse animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-text-muted/10 shrink-0" />
              <div className="space-y-3 w-full flex flex-col items-end">
                <div className="h-4 bg-secondary/60 rounded-full w-[30%]" />
                <div className="h-12 bg-accent-blue/10 rounded-3xl rounded-tr-none w-full" />
              </div>
            </div>
            {/* Assistant Skeleton 2 */}
            <div className="flex gap-4 max-w-[85%] animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-accent-blue/10 shrink-0" />
              <div className="space-y-3 w-full">
                <div className="h-4 bg-secondary/60 rounded-full w-[50%]" />
                <div className="h-32 bg-secondary/40 rounded-3xl rounded-tl-none border border-border-subtle/50" />
              </div>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <ChatMessage key={i} m={m} onViewSource={onViewSource} />
          ))
        )}
        {streaming && agentStatus && (
          <div className="flex justify-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-accent-blue/5 border border-accent-blue/20 flex items-center justify-center shrink-0 animate-pulse">
              <Bot size={18} className="text-accent-blue" />
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-4 py-2 bg-secondary/50 rounded-2xl border border-border-subtle shadow-sm">
                    <div className="flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin text-accent-blue" />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{agentStatus}</span>
                    </div>
                    
                    {agentConfidence !== undefined && agentConfidence > 0 && (
                        <>
                        <div className="w-px h-3 bg-border-subtle" />
                        <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                            agentConfidence >= 0.8 ? 'bg-accent-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                            agentConfidence >= 0.5 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                            'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                            }`} />
                            <span className={`text-[10px] font-black tabular-nums tracking-tight ${
                            agentConfidence >= 0.8 ? 'text-accent-emerald' : 
                            agentConfidence >= 0.5 ? 'text-amber-500' : 
                            'text-rose-500'
                            }`}>
                            {Math.round(agentConfidence * 100)}% ({agentConfidence >= 0.8 ? 'HIGH' : agentConfidence >= 0.5 ? 'MEDIUM' : 'LOW'}) CONFIDENCE
                            </span>
                        </div>
                        </>
                    )}
                </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 3. Input Console */}
      <div className="p-4 bg-elevated/30 border-t border-border-default">
          <form onSubmit={handleSend} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-blue/20 via-accent-cyan/20 to-accent-blue/20 rounded-[22px] blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
            <div className="relative flex items-center bg-card border border-border-default rounded-3xl px-5 py-2.5 transition-all shadow-sm focus-within:shadow-lg focus-within:border-accent-blue/50">
                <input 
                    type="text" 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask anything about this case..."
                    className="flex-1 bg-transparent border-none text-sm focus:outline-none placeholder:text-text-muted font-medium"
                />
                <button 
                    type="submit"
                    disabled={streaming || !message.trim()}
                    className="p-2.5 bg-accent-blue text-white rounded-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-accent-blue/20"
                >
                    <Send size={16} />
                </button>
            </div>
          </form>
          <div className="mt-2.5 flex items-center gap-4 px-2">
            <p className="text-[10px] font-bold text-text-muted flex items-center gap-1.5 opacity-60">
                <Zap size={10} className="text-accent-blue" /> Deep Forensic Inference
            </p>
            <p className="text-[10px] font-bold text-text-muted flex items-center gap-1.5 opacity-60">
                <FileSearch size={10} className="text-accent-blue" /> Case-Specific Grounding
            </p>
          </div>
      </div>
    </div>
  );
}

function ChatMessage({ m, onViewSource }: { m: LocalMessage, onViewSource: any }) {
    const isBot = m.role === "assistant";
    
    return (
      <div className={cn(
        "flex gap-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
        !isBot && "ml-auto flex-row-reverse"
      )}>
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
          isBot 
            ? "bg-accent-blue/5 border-accent-blue/20 text-accent-blue shadow-sm" 
            : "bg-secondary border-border-default text-text-secondary"
        )}>
          {isBot ? <Bot size={18} /> : <User size={18} />}
        </div>
        
        <div className="space-y-2 flex-1 min-w-0">
          <div className={cn(
            "px-5 py-4 rounded-3xl text-sm leading-relaxed shadow-sm",
            isBot 
              ? "bg-card border border-border-default text-text-primary rounded-tl-none" 
              : "bg-accent-blue text-white rounded-tr-none font-medium"
          )}>
            <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                    components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-accent-cyan">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                        a: ({ href, children }) => {
                            if (href?.startsWith("#cite-")) {
                                const index = parseInt(href.replace("#cite-", ""));
                                const citation = m.citations?.find((_, i) => i + 1 === index);
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
                    {m.content.replace(/\[(\d+)\]/g, "[[$1]](#cite-$1)")}
                </ReactMarkdown>
            </div>

            {isBot && m.streaming && (
                <span className="inline-block w-1.5 h-3.5 bg-accent-blue ml-1 animate-pulse rounded-sm align-middle" />
            )}
          </div>
          
          {isBot && (
              <div className="flex items-center gap-4 px-2 mt-1">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-emerald/5 border border-accent-emerald/10">
                      <ShieldCheck size={10} className="text-accent-emerald" />
                      <span className="text-[9px] font-black text-accent-emerald uppercase tracking-widest">Grounded Evidence</span>
                  </div>
                  {m.agent && (
                      <div className="flex items-center gap-1 opacity-70">
                          <Zap size={10} className="text-accent-blue" />
                          <span className="text-[9px] font-black text-accent-blue uppercase tracking-widest font-mono">{m.agent.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                      </div>
                  )}
                  {isBot && !m.streaming && (
                      <div className="ml-auto flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity cursor-help">
                          <Info size={10} />
                          <span className="text-[8px] font-bold uppercase tracking-tighter">AI Analysis</span>
                      </div>
                  )}
              </div>
          )}
        </div>
      </div>
    );
}

function CitationBadge({ index, citation, onViewSource }: any) {
    const [showTooltip, setShowTooltip] = useState(false);
    return (
        <span className="relative inline-block mx-0.5 align-baseline">
            <button
                type="button"
                onClick={() => citation && onViewSource(citation, index)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-black rounded-md bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue hover:text-white transition-all cursor-crosshair shadow-sm"
            >
                {index}
            </button>
            {showTooltip && citation && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 rounded-2xl bg-card border border-border-default shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-subtle">
                        <div className="p-1.5 rounded-lg bg-accent-blue/10 text-accent-blue">
                            <FileText size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-text-primary uppercase tracking-tight truncate">
                                {citation.file_name}
                            </p>
                            <p className="text-[9px] font-bold text-accent-blue uppercase tracking-widest">
                                Page Reference {citation.page}
                            </p>
                        </div>
                    </div>
                    <p className="text-[11px] text-text-secondary italic line-clamp-3 leading-relaxed bg-secondary/30 p-2 rounded-lg border border-border-subtle/50">
                        "{citation.text_snippet}"
                    </p>
                    <div className="mt-3 flex justify-between items-center">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter italic">Click to Inspect Source</span>
                        <span className="text-[8px] font-black text-accent-blue bg-accent-blue/10 px-1.5 py-0.5 rounded uppercase">Forensic Trace</span>
                    </div>
                </div>
            )}
        </span>
    );
}
