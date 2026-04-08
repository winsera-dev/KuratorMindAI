"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Plus, 
  Briefcase, 
  Building2, 
  Hash, 
  Scale, 
  Calendar, 
  Activity,
  Loader2,
  Save,
  FileText,
  AlertCircle
} from "lucide-react";
import { createCase, updateCase, deleteCase } from "@/lib/api";
import { Case, CaseStage } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";

const caseSchema = z.object({
  name: z.string().min(3, "Workspace Name must be at least 3 characters"),
  debtor_entity: z.string().min(3, "Debtor Entity must be at least 3 characters"),
  case_number: z.string()
    .min(5, "Case Number is too short")
    .regex(
      /^\d+\/Pdt\.Sus-(PKPU|Pailit)\/\d{4}\/PN\s.*$/i, 
      "Invalid format. Use standard: [No]/Pdt.Sus-[Type]/[Year]/PN [Court]"
    ),
  court_name: z.string().min(3, "Court Name is required"),
  stage_started_at: z.string().min(1, "Stage Start Date is required"),
  stage: z.string(),
  description: z.string().optional(),
});

const STAGE_OPTIONS: Record<CaseStage, string> = {
  petition: "Petition (Filing)",
  pkpu_temp: "PKPU Temporary (45d)",
  pkpu_permanent: "PKPU Permanent (270d)",
  bankrupt: "Bankruptcy (Pailit)",
  liquidation: "Liquidation",
  homologasi: "Homologasi (Resolved)",
  closed: "Closed",
  terminated: "Terminated",
};

interface CaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (caseData?: Case) => void;
  mode: "create" | "edit";
  initialData?: Case;
  userId?: string;
}

export default function CaseModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  mode,
  initialData,
  userId 
}: CaseModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    debtor_entity: "",
    case_number: "",
    court_name: "",
    stage_started_at: "",
    stage: "pkpu_temp" as CaseStage,
    description: "",
  });

  // Sync form data when initialData changes (for edit mode)
  useEffect(() => {
    if (mode === "edit" && initialData) {
      setFormData({
        name: initialData.name || "",
        debtor_entity: initialData.debtor_entity || "",
        case_number: initialData.case_number || "",
        court_name: initialData.court_name || "",
        stage_started_at: initialData.stage_started_at ? initialData.stage_started_at.split("T")[0] : "",
        stage: initialData.stage || "pkpu_temp",
        description: initialData.description || "",
      });
    } else if (mode === "create") {
      setFormData({
        name: "",
        debtor_entity: "",
        case_number: "",
        court_name: "",
        stage_started_at: "",
        stage: "pkpu_temp",
        description: "",
      });
    }
  }, [mode, initialData, isOpen]);

  const handleDemoData = () => {
    setFormData({
      name: "PT Dirgantara Sukses Refactoring",
      debtor_entity: "PT Dirgantara Sukses Pratama",
      case_number: "24/Pdt.Sus-PKPU/2024/PN Niaga Jkt.Pst",
      court_name: "Pengadilan Niaga Jakarta Pusat",
      stage_started_at: new Date().toISOString().split("T")[0],
      stage: "pkpu_permanent",
      description: "Forensic audit for restructuring plan verification. Debtor claims complex cross-border liabilities.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      caseSchema.parse(formData);

      if (mode === "create") {
        if (!userId) throw new Error("User ID is required for creation");
        const res = await createCase({
          ...formData,
          user_id: userId,
        });
        onSuccess(res);
        toast.success("Workspace initialized");
      } else {
        if (!initialData?.id) throw new Error("Case ID is required for update");
        
        // Pass the concurrency token (the last known updated_at)
        const res = await updateCase(initialData.id, {
          ...formData,
          expected_updated_at: initialData.updated_at
        });
        
        onSuccess(res);
        toast.success("Intelligence updated");
      }
      onClose();
    } catch (err: any) {
      if (err.message === "CONCURRENCY_CONFLICT") {
        setError("Forensic Conflict: This case has been updated by another user since you opened this dialogue. Please refresh the page to ensure data integrity.");
        return;
      }
      if (err.message === "PRECONDITION_REQUIRED") {
        setError("Security Error: Data versioning token is missing. Please contact support.");
        return;
      }
      if (err instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0].toString()] = issue.message;
          }
        });
        setFieldErrors(errors);
        setError("Validation failed. Please correct the highlighted fields.");
        toast.error("Forensic check failed: Invalid metadata");
        setLoading(false);
        return;
      }
      setError(err.message || `Failed to ${mode} case`);
      toast.error(err.message || `Failed to ${mode} case`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    const confirmed = window.confirm(
      "PERMANENT DELETION WARNING\n\n" +
      "You are about to delete this case and all associated evidence, claims, and AI reports. This action cannot be undone.\n\n" +
      "Are you sure you want to proceed?"
    );
    if (!confirmed) return;
    
    setLoading(true);
    try {
      await deleteCase(initialData.id);
      toast.success("Workspace deleted permanently");
      // Let the parent know to refresh
      onSuccess();
      onClose();
      // Redirect to dashboard if we are on the case page
      if (window.location.pathname.includes('/case/')) {
        window.location.href = '/cases';
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete case");
      toast.error(err.message || "Failed to delete case");
    } finally {
      setLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 w-full h-full bg-slate-950/50 backdrop-blur-[1px] z-[9999] flex items-center justify-center p-6 transition-all"
          >
            {/* Modal Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border-default w-full max-w-2xl rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] flex flex-col z-[10000]"
              style={{ maxHeight: "min(92vh, 780px)" }}
            >
              {/* ── STICKY HEADER ── */}
              <div className="shrink-0 px-8 py-6 border-b border-border-subtle bg-secondary/60 backdrop-blur-lg flex items-center justify-between rounded-t-3xl">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-accent-blue/10 flex items-center justify-center text-accent-blue border border-accent-blue/20">
                    {mode === "create" ? <Plus size={22} /> : <Scale size={22} />}
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-text-primary">
                      {mode === "create" ? "Initialize Workspace" : "Workspace Intelligence"}
                    </h2>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                      {mode === "create" ? "New Forensic Evidence Environment" : "Update Legal Metadata & Lifecycle"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-tertiary rounded-xl transition-all text-text-muted hover:text-text-primary border border-transparent hover:border-border-default"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ── SCROLLABLE FORM BODY ── */}
              <form
                id="case-modal-form"
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto px-8 py-7 space-y-6 custom-scrollbar"
              >
                {error && (
                  <div className="p-4 bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs font-bold rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle size={18} className="shrink-0 animate-pulse" />
                    <div className="space-y-0.5">
                      <p>{error}</p>
                      {error.includes("conflict") || error.includes("412") ? (
                        <p className="text-[10px] opacity-70">A newer version of this case exists. Refreshing is required to prevent data loss.</p>
                      ) : null}
                    </div>
                  </div>
                )}

                {mode === "create" && (
                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={handleDemoData}
                      className="text-[10px] uppercase tracking-widest font-black text-accent-blue hover:text-white hover:bg-accent-blue/80 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-blue/5 border border-accent-blue/20 transition-all active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                      Fill Demo Architecture
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Case Name */}
                  <div className="space-y-2 col-span-full">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2 ml-1">
                      <Briefcase className="w-3.5 h-3.5" /> Workspace Title
                    </label>
                    <input
                      required
                      placeholder="e.g. PT Maju Jaya Rescheduling"
                      className={cn(
                        "w-full bg-primary border rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/40 outline-none transition-all placeholder:text-text-muted/40",
                        fieldErrors.name ? "border-accent-rose bg-accent-rose/5" : "border-border-default"
                      )}
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                    {fieldErrors.name && (
                      <p className="text-[10px] font-bold text-accent-rose ml-1 uppercase">{fieldErrors.name}</p>
                    )}
                  </div>

                  {/* Debtor Entity */}
                  <div className={cn(
                    "p-4 rounded-2xl border transition-all space-y-2",
                    fieldErrors.debtor_entity ? "border-accent-rose bg-accent-rose/5" : "border-border-default bg-secondary/50"
                  )}>
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5" /> Debtor Entity
                    </label>
                    <input
                      required
                      placeholder="Full Legal Name"
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-text-primary focus:ring-0 outline-none placeholder:text-text-muted/40"
                      value={formData.debtor_entity}
                      onChange={(e) => setFormData({...formData, debtor_entity: e.target.value})}
                    />
                    {fieldErrors.debtor_entity && (
                      <p className="text-[9px] font-bold text-accent-rose leading-tight">{fieldErrors.debtor_entity}</p>
                    )}
                  </div>

                  {/* Case Number */}
                  <div className={cn(
                    "p-4 rounded-2xl border transition-all space-y-2",
                    fieldErrors.case_number ? "border-accent-rose bg-accent-rose/5" : "border-border-default bg-secondary/50"
                  )}>
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5" /> Case Number
                    </label>
                    <input
                      placeholder="e.g. 15/Pdt.Sus-PKPU/2024/PN Jkt.Pst"
                      className="w-full bg-transparent border-none p-0 text-sm font-mono font-bold text-text-primary focus:ring-0 outline-none placeholder:text-text-muted/40"
                      value={formData.case_number}
                      onChange={(e) => setFormData({...formData, case_number: e.target.value})}
                    />
                    {fieldErrors.case_number && (
                      <p className="text-[9px] font-bold text-accent-rose leading-tight">{fieldErrors.case_number}</p>
                    )}
                  </div>

                  {/* Case Stage */}
                  <div className="space-y-2 p-4 bg-primary/50 border border-border-default rounded-2xl">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2 ml-1">
                      <Activity className="w-3.5 h-3.5 text-accent-blue" /> Case Stage
                    </label>
                    <div className="relative group">
                      <select
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-text-primary focus:ring-0 outline-none appearance-none cursor-pointer"
                        value={formData.stage}
                        onChange={(e) => {
                          const newStage = e.target.value as CaseStage;
                          const today = new Date().toISOString().split("T")[0];
                          const stageChanged = newStage !== (initialData?.stage ?? "pkpu_temp");
                          setFormData({
                            ...formData,
                            stage: newStage,
                            stage_started_at:
                              mode === "create"
                                ? formData.stage_started_at || today
                                : stageChanged
                                ? today
                                : formData.stage_started_at,
                          });
                        }}
                      >
                        {Object.entries(STAGE_OPTIONS).map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted opacity-40">
                        <Plus size={12} className="rotate-45" />
                      </div>
                    </div>
                  </div>

                  {/* Stage Start Date */}
                  <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-accent-blue" /> Start Date
                    </label>
                    <input
                      type="date"
                      className="w-full bg-transparent border-none p-0 text-sm font-mono font-bold text-text-primary focus:ring-0 outline-none [color-scheme:dark]"
                      value={formData.stage_started_at}
                      onChange={(e) => setFormData({...formData, stage_started_at: e.target.value})}
                    />
                  </div>

                  {/* Court Name */}
                  <div className={cn(
                    "p-4 rounded-2xl border transition-all space-y-2",
                    fieldErrors.court_name ? "border-accent-rose bg-accent-rose/5" : "border-border-default bg-secondary/50"
                  )}>
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Scale className="w-3.5 h-3.5" /> Commercial Court
                    </label>
                    <input
                      placeholder="e.g. PN Jakarta Pusat"
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-text-primary focus:ring-0 outline-none placeholder:text-text-muted/40"
                      value={formData.court_name}
                      onChange={(e) => setFormData({...formData, court_name: e.target.value})}
                    />
                    {fieldErrors.court_name && (
                      <p className="text-[9px] font-bold text-accent-rose leading-tight">{fieldErrors.court_name}</p>
                    )}
                  </div>

                  {/* Empty spacer — keeps Court half-width, right column empty */}
                  <div className="hidden md:block" />
                </div>

                {/* Audit Notes */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 italic opacity-60">
                    Audit Notes / Intelligence Overview
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief overview of the scope or firm-specific notes..."
                    className="w-full bg-secondary/20 border border-border-default rounded-2xl px-4 py-3 text-sm font-medium text-text-secondary outline-none focus:border-accent-blue/50 transition-all resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </form>

              {/* ── STICKY FOOTER ── */}
              <div className="shrink-0 px-8 py-5 border-t border-border-subtle bg-secondary/40 backdrop-blur-lg rounded-b-3xl flex gap-4 justify-between items-center">
                {mode === "edit" ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-5 py-2.5 rounded-xl text-accent-rose hover:text-white hover:bg-accent-rose transition-all text-xs font-black uppercase tracking-widest border border-accent-rose/20"
                    disabled={loading}
                  >
                    Delete Workspace
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-3 items-center">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-tertiary transition-all text-xs font-black uppercase tracking-widest"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="case-modal-form"
                    disabled={loading}
                    className="min-w-[180px] flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-xl shadow-white/5 disabled:opacity-50 font-black text-sm uppercase tracking-tight"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : mode === "create" ? (
                      <>
                        <Plus className="w-4 h-4" />
                        Create Workspace
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Update Intelligence
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}


