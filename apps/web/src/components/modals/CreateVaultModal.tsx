"use client";

import React, { useState } from "react";
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
  Loader2
} from "lucide-react";
import { createVault } from "@/lib/api";
import { VaultStage } from "@/types";

interface CreateVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

export default function CreateVaultModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  userId 
}: CreateVaultModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    debtor_entity: "",
    case_number: "",
    court_name: "",
    bankruptcy_date: "",
    stage: "pkpu_temp",
    description: "",
  });

  const handleDemoData = () => {
    setFormData({
      name: "PT Dirgantara Sukses Refactoring",
      debtor_entity: "PT Dirgantara Sukses Pratama",
      case_number: "24/Pdt.Sus-PKPU/2024/PN Niaga Jkt.Pst",
      court_name: "Pengadilan Niaga Jakarta Pusat",
      bankruptcy_date: "",
      stage: "pkpu_permanent",
      description: "Forensic audit for restructuring plan verification. Debtor claims complex cross-border liabilities.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createVault({
        ...formData,
        stage: formData.stage as VaultStage,
        user_id: userId,
        // Only include date if it's set
        bankruptcy_date: formData.bankruptcy_date || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create vault");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border-default w-full max-w-2xl rounded-xl shadow-elevated overflow-hidden flex flex-col max-h-[90vh] relative z-[60]"
            >
              {/* Header */}
              <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-secondary/80 backdrop-blur-md">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Plus className="w-5 h-5 text-accent-blue" />
                    New Forensic Vault
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">Initiate a new insolvency or PKPU case Workspace.</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-tertiary rounded-lg transition-colors text-text-muted hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
                {error && (
                  <div className="p-3 bg-accent-rose/10 border border-accent-rose/20 text-accent-rose text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={handleDemoData}
                    className="text-[10px] uppercase tracking-wider font-bold text-accent-blue hover:text-accent-blue-hover flex items-center gap-1.5 px-2 py-1 rounded bg-accent-blue/5 border border-accent-blue/20 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    Fill Demo Data
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Case Name */}
                  <div className="space-y-2 col-span-full">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      <Briefcase className="w-4 h-4" /> Case Title
                    </label>
                    <input
                      required
                      placeholder="e.g. PT Maju Jaya Rescheduling"
                      className="w-full bg-primary border border-border-default rounded-lg px-4 py-2.5 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  {/* Debtor Entity */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Debtor Entity
                    </label>
                    <input
                      required
                      placeholder="Full Legal Name"
                      className="w-full bg-primary border border-border-default rounded-lg px-4 py-2.5 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all"
                      value={formData.debtor_entity}
                      onChange={(e) => setFormData({...formData, debtor_entity: e.target.value})}
                    />
                  </div>

                  {/* Case Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      <Hash className="w-4 h-4" /> Case Number
                    </label>
                    <input
                      placeholder="e.g. 15/Pdt.Sus-PKPU/2024"
                      className="w-full bg-primary border border-border-default rounded-lg px-4 py-2.5 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all"
                      value={formData.case_number}
                      onChange={(e) => setFormData({...formData, case_number: e.target.value})}
                    />
                  </div>

                  {/* Court Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      <Scale className="w-4 h-4" /> Commercial Court
                    </label>
                    <input
                      placeholder="e.g. PN Jakarta Pusat"
                      className="w-full bg-primary border border-border-default rounded-lg px-4 py-2.5 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all"
                      value={formData.court_name}
                      onChange={(e) => setFormData({...formData, court_name: e.target.value})}
                    />
                  </div>

                  {/* Bankruptcy Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Declaration Date
                    </label>
                    <input
                      type="date"
                      className="w-full bg-primary border border-border-default rounded-lg px-4 py-2.5 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all [color-scheme:dark]"
                      value={formData.bankruptcy_date}
                      onChange={(e) => setFormData({...formData, bankruptcy_date: e.target.value})}
                    />
                  </div>

                  {/* Case Stage */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Initial Stage
                    </label>
                    <select
                      className="w-full bg-primary border border-border-default rounded-lg px-4 py-2.5 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all"
                      value={formData.stage}
                      onChange={(e) => setFormData({...formData, stage: e.target.value})}
                    >
                      <option value="pkpu_temp">PKPU Tetap (Temporary)</option>
                      <option value="pkpu_permanent">PKPU Tetap (Permanent)</option>
                      <option value="bankrupt">Bankrupt (Pailit)</option>
                      <option value="liquidation">Liquidation</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-sm font-medium text-text-secondary">Summary/Internal Notes</label>
                   <textarea
                    rows={3}
                    placeholder="Brief overview of the scope or firm-specific notes..."
                    className="w-full bg-primary border border-border-default rounded-lg px-4 py-2.5 focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                   />
                </div>

                <div className="pt-4 flex gap-3 justify-end items-center border-t border-border-subtle mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-tertiary transition-all text-sm font-medium"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-lg bg-accent-blue hover:bg-accent-blue-hover text-white transition-all text-sm font-bold shadow-glow-blue flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Create Workspace
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
