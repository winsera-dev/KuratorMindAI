"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  FileText, 
  FileSpreadsheet, 
  Loader2, 
  Upload, 
  Trash2, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { 
  getDocuments, 
  uploadDocument, 
  deleteDocument,
  type CaseDocument 
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SourcesTabProps {
  caseId: string;
}

export function SourcesTab({ caseId }: SourcesTabProps) {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await getDocuments(caseId);
      setDocuments(res.documents);
      setError(null);
    } catch (err) {
      setError("Failed to load documents. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

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
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchDocuments, 3000);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [documents, fetchDocuments]);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    setUploading(true);
    setError(null);

    let successCount = 0;
    for (const file of fileArr) {
      let retries = 0;
      const MAX_RETRIES = 3;
      let uploaded = false;

      while (retries <= MAX_RETRIES && !uploaded) {
        try {
          if (retries > 0) {
            const delay = Math.pow(2, retries) * 1000;
            console.log(`Retrying upload for ${file.name} in ${delay}ms... (Attempt ${retries}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const res = await uploadDocument(caseId, file);
          setDocuments((prev) => [res.document, ...prev]);
          successCount++;
          uploaded = true;
        } catch (err: any) {
          retries++;
          if (retries > MAX_RETRIES) {
            const msg = err.message || "Unknown error";
            setError(`Failed to upload "${file.name}" after ${MAX_RETRIES} retries: ${msg}`);
            toast.error(`Upload failed permanently: ${msg}`);
          }
        }
      }
    }
    
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} document(s)`);
    }

    setUploading(false);
  };

  const handleDelete = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    const fileName = doc?.file_name || "this document";

    const confirmed = window.confirm(
      `PERMANENT DELETION WARNING\n\n` +
      `You are about to delete: ${fileName}\n\n` +
      `This action will automatically PURGE all derived data from this case, including:\n` +
      `• All Creditor Claims extracted from this file\n` +
      `• All Audit Flags and Contradictions linked to this evidence\n\n` +
      `This is required to maintain the systemic integrity of the legal workspace. Do you wish to proceed?`
    );

    if (!confirmed) return;

    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document and derived data deleted");
    } catch {
      setError("Failed to delete document.");
      toast.error("Failed to delete document");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6 overflow-y-auto pr-2 scrollbar-none">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-sm animate-in fade-in duration-300">
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
          "border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-300 group relative overflow-hidden",
          dragOver
            ? "border-accent-blue bg-accent-blue/5 scale-[1.01]"
            : "border-border-default hover:border-accent-blue/50 hover:bg-secondary/50"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-accent-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <input
          ref={fileInputRef}
          type="file"
          id="file-input"
          className="hidden"
          multiple
          accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="relative z-10">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-card border border-border-default flex items-center justify-center text-text-muted group-hover:text-accent-blue group-hover:border-accent-blue/50 group-hover:scale-110 transition-all shadow-sm">
            {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
            </div>
            <p className="text-base font-black text-text-primary uppercase tracking-tight">
            {uploading ? "Ingesting Evidence…" : "Drop Case Files Here"}
            </p>
            <p className="text-xs text-text-muted font-medium mt-1">
            Or click to browse — Support PDF, Excel, & CSV (Max 50MB)
            </p>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 space-y-3 pb-10">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted opacity-60">
            Secure Repository — {documents.length} Items
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-card border border-border-subtle animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-secondary/20 rounded-3xl border border-dashed border-border-default">
            <FileText size={40} className="text-text-muted mb-4 opacity-20" />
            <p className="text-sm font-bold text-text-muted uppercase tracking-widest">Workspace is Empty</p>
            <p className="text-xs text-text-muted mt-1 opacity-60">Start by uploading supporting evidence documents.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: CaseDocument;
  onDelete: (id: string) => void;
}) {
  const isExcel = doc.file_type.includes("spreadsheet") || doc.file_type.includes("excel") || doc.file_name.endsWith(".xlsx") || doc.file_name.endsWith(".xls");

  const statusConfig = {
    ready: { label: "Ingested", color: "emerald", Icon: CheckCircle2 },
    processing: { label: "Extracting…", color: "amber", Icon: Loader2 },
    pending: { label: "Pending", color: "amber", Icon: Loader2 },
    error: { label: "Error", color: "rose", Icon: AlertCircle },
  } as const;

  const st = (statusConfig as any)[doc.status] || statusConfig.pending;

  return (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-card border border-border-subtle hover:border-accent-blue/30 transition-all group shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className={cn(
        "w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border",
        isExcel
          ? "bg-accent-emerald/5 border-accent-emerald/20 text-accent-emerald"
          : "bg-accent-rose/5 border-accent-rose/20 text-accent-rose"
      )}>
        {isExcel ? <FileSpreadsheet size={20} /> : <FileText size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black text-text-primary truncate uppercase tracking-tight">
            {doc.file_name}
          </p>
          {!!doc.metadata?.low_confidence && (
            <div className="group/warn relative">
              <AlertCircle size={14} className="text-accent-rose animate-pulse cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-900 border border-accent-rose/30 rounded-lg text-[10px] font-bold text-accent-rose opacity-0 group-hover/warn:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                FORENSIC WARNING: Low OCR Confidence. High risk of character misinterpretation. Manual verification required.
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-bold text-text-muted opacity-60">
            {doc.page_count ? `${doc.page_count} PAGES` : "SERIALIZING"}
          </span>
            <span className="w-1 h-1 rounded-full bg-border-default" />
            <span className="text-[10px] font-bold text-text-muted opacity-60 uppercase">
                {isExcel ? "Structured Data" : "Forensic OCR"}
            </span>
        </div>
      </div>
      
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
        doc.status === "ready" ? "bg-accent-emerald/5 border-accent-emerald/20 text-accent-emerald" :
        doc.status === "error" ? "bg-accent-rose/5 border-accent-rose/20 text-accent-rose" :
        "bg-accent-amber/5 border-accent-amber/20 text-accent-amber"
      )}>
        <st.Icon
          size={10}
          className={doc.status === "processing" || doc.status === "pending" ? "animate-spin" : ""}
        />
        {st.label}
      </div>

      <button
        id={`delete-doc-${doc.id}`}
        onClick={() => onDelete(doc.id)}
        className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-text-muted hover:text-accent-rose hover:bg-accent-rose/10 transition-all shrink-0 active:scale-90"
        title="Remove Document"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
