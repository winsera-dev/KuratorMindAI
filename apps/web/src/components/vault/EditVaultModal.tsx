"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  Gavel, 
  Building2, 
  Hash, 
  Scale, 
  FileText,
  Calendar,
  Clock,
  AlertCircle,
  Pencil,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Vault, VaultStage } from "@/types";
import { updateVault } from "@/lib/api";

const STAGE_OPTIONS: Record<VaultStage, string> = {
  petition: "Petition (Filing)",
  pkpu_temp: "PKPU Temporary (45d)",
  pkpu_permanent: "PKPU Permanent (270d)",
  bankrupt: "Bankruptcy (Pailit)",
  liquidation: "Liquidation",
  homologasi: "Homologasi (Resolved)",
  closed: "Closed",
  terminated: "Terminated",
};

interface EditVaultModalProps {
  vault: Vault;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedVault: Vault) => void;
}

export function EditVaultModal({ vault, isOpen, onClose, onUpdate }: EditVaultModalProps) {
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: vault.name,
    debtor_entity: vault.debtor_entity || "",
    case_number: vault.case_number || "",
    court_name: vault.court_name || "",
    description: vault.description || "",
    stage: vault.stage,
    stage_started_at: vault.stage_started_at ? vault.stage_started_at.split("T")[0] : new Date().toISOString().split("T")[0],
  });

  // Handle slide-in animation exactly like ForensicSidebar
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const handleStageChange = (newStage: VaultStage) => {
    setFormData(prev => ({
      ...prev,
      stage: newStage,
      stage_started_at: new Date().toISOString().split("T")[0]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await updateVault(vault.id, formData);
      onUpdate(updated);
      onClose();
    } catch (err) {
      console.error("Failed to update vault:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end pointer-events-none">
      {/* 1. Backdrop (Matches exactly) */}
      <div 
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* 2. Side Panel (Matches ForensicSidebar structure) */}
      <aside 
        className={cn(
          "relative w-full max-w-md h-full bg-card border-l border-border-default shadow-2xl transition-transform duration-500 ease-out pointer-events-auto flex flex-col",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header - Matching ForensicSidebar style */}
        <header className="p-5 border-b border-border-default flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center text-accent-blue border border-accent-blue/20">
              <Scale size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-tight">Case Intelligence</h2>
              <p className="text-[10px] font-bold text-text-muted opacity-60 uppercase tracking-widest mt-0.5">Workspace Metadata Refactor</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-full transition-colors text-text-muted"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content Area - Scrollable */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* Identity Cards - Exact rounded card style from Screenshot */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-1">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">Display Name</span>
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-transparent border-none p-0 text-sm font-bold text-text-primary focus:ring-0 outline-none"
                  placeholder="Workspace Name"
                />
              </div>
              <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-1">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">Debtor Entity</span>
                <input 
                  type="text"
                  value={formData.debtor_entity}
                  onChange={e => setFormData(p => ({ ...p, debtor_entity: e.target.value }))}
                  className="w-full bg-transparent border-none p-0 text-sm font-bold text-text-primary focus:ring-0 outline-none"
                  placeholder="PT / Individual Name"
                />
              </div>
            </div>

            {/* Legal References Section (Matches Excerpt Box style) */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5 px-1">
                <FileText size={12} className="text-accent-blue" /> Legal Reference Data
              </h3>
              
              <div className="space-y-4">
                {/* Case Number Card */}
                <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-1">
                   <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">Case Number</span>
                   <input 
                    type="text"
                    value={formData.case_number}
                    onChange={e => setFormData(p => ({ ...p, case_number: e.target.value }))}
                    className="w-full bg-transparent border-none p-0 text-sm font-mono font-bold text-text-primary focus:ring-0 outline-none"
                    placeholder="Reference Code"
                   />
                </div>

                {/* Court Name Card */}
                <div className="p-4 bg-secondary/50 rounded-2xl border border-border-default space-y-1">
                   <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block">Commercial Court</span>
                   <input 
                    type="text"
                    value={formData.court_name}
                    onChange={e => setFormData(p => ({ ...p, court_name: e.target.value }))}
                    className="w-full bg-transparent border-none p-0 text-sm font-bold text-text-primary focus:ring-0 outline-none"
                    placeholder="Jurisdiction"
                   />
                </div>
              </div>
            </section>

            {/* Lifecycle Excerpt - Matching the "Original Excerpt" gradient feel but for inputs */}
            <section className="space-y-4">
               <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">Forensic Lifecycle Status</h3>
               <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-blue/10 to-accent-cyan/10 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-1000"></div>
                  <div className="relative p-5 bg-black/40 border border-border-default rounded-2xl space-y-5 shadow-inner">
                    
                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Active Case Stage</label>
                       <select 
                        value={formData.stage}
                        onChange={e => handleStageChange(e.target.value as VaultStage)}
                        className="w-full bg-secondary/30 border border-border-default rounded-xl py-2.5 px-4 text-xs font-bold text-text-primary outline-none transition-all cursor-pointer appearance-none"
                       >
                         {Object.entries(STAGE_OPTIONS).map(([id, label]) => (
                           <option key={id} value={id}>{label}</option>
                         ))}
                       </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">
                         {formData.stage === 'bankrupt' ? 'Bankruptcy Proclamation' : 'Activation Date'}
                       </label>
                       <input 
                        type="date"
                        value={formData.stage_started_at}
                        onChange={e => setFormData(p => ({ ...p, stage_started_at: e.target.value }))}
                        className="w-full bg-secondary/30 border border-border-default rounded-xl py-2.5 px-4 text-xs font-mono font-bold text-text-primary outline-none [color-scheme:dark]"
                       />
                    </div>
                  </div>
               </div>
            </section>

            {/* Notes Section */}
            <section className="space-y-2 px-1">
               <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block italic opacity-60 italic">Audit Notes (Optional)</span>
               <textarea 
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full bg-secondary/20 border border-border-default rounded-xl p-4 text-xs font-medium text-text-secondary outline-none focus:border-accent-blue/50 transition-all resize-none"
                placeholder="Enter case context or intelligence findings..."
               />
            </section>
          </div>

          {/* Footer - Consistent with ForensicSidebar "Maximize Document" button */}
          <footer className="p-6 border-t border-border-default bg-secondary/20 flex items-center justify-end gap-4">
             <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest hover:text-text-primary transition-colors"
             >
               Cancel
             </button>
             <button 
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-black text-sm font-bold uppercase tracking-tight rounded-xl hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50 shadow-xl"
              >
                {loading ? (
                    <Loader2 className="animate-spin" size={18} />
                ) : (
                    <>
                        <Save size={18} />
                        <span>Update Case Data</span>
                    </>
                )}
              </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
