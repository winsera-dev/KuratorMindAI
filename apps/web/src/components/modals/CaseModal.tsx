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
  FileText
} from "lucide-react";
import { createCase, updateCase, deleteCase } from "@/lib/api";
import { Case, CaseStage } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

    try {
      if (mode === "create") {
        if (!userId) throw new Error("User ID is required for creation");
        const res = await createCase({
          ...formData,
          user_id: userId,
        });
        onSuccess(res);
        toast.success("Workspace created successfully");
      } else {
        if (!initialData?.id) throw new Error("Case ID is required for update");
        const res = await updateCase(initialData.id, formData);
        onSuccess(res);
        toast.success("Workspace updated successfully");
      }
      onClose();
    } catch (err: any) {
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
        window.location.href = '/dashboard';
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
            className="fixed inset-0 w-screen h-screen bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 transition-all"
          >
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border-default w-full max-w-2xl rounded-2xl shadow-elevated overflow-hidden flex flex-col max-h-[90vh] relative z-[110]"
            >
              {/* Header */}
              <div className="p-6 border-b border-border-subtle bg-secondary/80 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 flex items-center justify-center text-accent-blue border border-accent-blue/20">
                      {mode === "create" ? <Plus size={24} /> : <Scale size={24} />}
                   </div>
                   <div>
                      <h2 className="text-xl font-black tracking-tight text-text-primary">
                        {mode === "create" ? "Initialize Workspace" : "Workspace Intelligence"}
                      </h2>
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                        {mode === "create" ? "New Forensic Evidence Environment" : "Update Legal Metadata & Lifecycle"}
                      </p>
                   </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-tertiary rounded-xl transition-all text-text-muted hover:text-text-primary border border-transparent hover:border-border-default"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                {error && (
                  <div className="p-4 bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-xs font-bold rounded-xl flex items-center gap-2">
                    <X size={14} className="shrink-0" />
                    {error}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Case Name */}
                  <div className="space-y-2 col-span-full">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2 ml-1">
                      <Briefcase className="w-3.5 h-3.5" /> Workspace Title
                    </label>
                    <input
                      required
                      placeholder="e.g. PT Maju Jaya Rescheduling"
                      className="w-full bg-primary border border-border-default rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/40 outline-none transition-all placeholder:text-text-muted/40"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  {/* Debtor Entity */}
                  <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-2">
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
                  </div>

                  {/* Case Number */}
                  <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5" /> Case Number
                    </label>
                    <input
                      placeholder="e.g. 15/Pdt.Sus-PKPU/2024"
                      className="w-full bg-transparent border-none p-0 text-sm font-mono font-bold text-text-primary focus:ring-0 outline-none placeholder:text-text-muted/40"
                      value={formData.case_number}
                      onChange={(e) => setFormData({...formData, case_number: e.target.value})}
                    />
                  </div>

                  {/* Court Name */}
                  <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Scale className="w-3.5 h-3.5" /> Commercial Court
                    </label>
                    <input
                      placeholder="e.g. PN Jakarta Pusat"
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-text-primary focus:ring-0 outline-none placeholder:text-text-muted/40"
                      value={formData.court_name}
                      onChange={(e) => setFormData({...formData, court_name: e.target.value})}
                    />
                  </div>

                  {/* Stage Start Date */}
                  <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" /> Decision / Start Date
                    </label>
                    <input
                      type="date"
                      className="w-full bg-transparent border-none p-0 text-sm font-mono font-bold text-text-primary focus:ring-0 outline-none [color-scheme:dark]"
                      value={formData.stage_started_at}
                      onChange={(e) => setFormData({...formData, stage_started_at: e.target.value})}
                    />
                  </div>

                  {/* Case Stage */}
                  <div className="space-y-2 col-span-full">
                     <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2 ml-1">
                      <Activity className="w-3.5 h-3.5" /> Current Lifecycle Stage
                    </label>
                    <div className="relative group">
                       <select
                        className="w-full bg-primary border border-border-default rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/40 outline-none transition-all appearance-none cursor-pointer"
                        value={formData.stage}
                        onChange={(e) => {
                          const newStage = e.target.value as CaseStage;
                          const today = new Date().toISOString().split("T")[0];
                          const stageChanged = newStage !== (initialData?.stage ?? "pkpu_temp");
                          setFormData({
                            ...formData,
                            stage: newStage,
                            // Auto-fill date: in create mode, only if empty; in edit mode, if stage changed
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
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                         <Plus size={14} className="rotate-45" />
                      </div>
                    </div>
                  </div>
                </div>

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

                {/* Footer Actions */}
                <div className="pt-6 flex gap-4 justify-between items-center border-t border-border-subtle mt-8">
                  {mode === "edit" ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-6 py-3 rounded-xl text-accent-rose hover:text-white hover:bg-accent-rose transition-all text-xs font-black uppercase tracking-widest border border-accent-rose/20"
                      disabled={loading}
                    >
                      Delete Workspace
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-4 items-center">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-3 rounded-xl text-text-muted hover:text-text-primary hover:bg-tertiary transition-all text-xs font-black uppercase tracking-widest"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 min-w-[200px] flex items-center justify-center gap-2 py-4 bg-white text-black rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-xl shadow-white/5 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : mode === "create" ? (
                        <>
                          <Plus className="w-5 h-5" />
                          <span className="text-sm font-black uppercase tracking-tight">Create Workspace</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          <span className="text-sm font-black uppercase tracking-tight">Update Intelligence</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
