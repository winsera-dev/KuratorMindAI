"use client";

import React, { useEffect, useState, useCallback } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  Scale, 
  Loader2,
  RefreshCw
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CreateVaultModal from "@/components/modals/CreateVaultModal";
import VaultCard from "@/components/VaultCard";

export default function DashboardPage() {
  const [vaults, setVaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const supabase = createClient();

  const fetchVaults = useCallback(async () => {
    setLoading(true);
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      setUserId(session.user.id);

      const { data, error } = await supabase
        .from("vaults")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setVaults(data || []);
    } catch (err) {
      console.error("Error fetching vaults:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults, refreshKey]);

  // Filtered vaults based on search
  const filteredVaults = vaults.filter(v => 
    v.name?.toLowerCase().includes(search.toLowerCase()) || 
    v.case_number?.toLowerCase().includes(search.toLowerCase()) ||
    v.debtor_entity?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forensic Vaults</h1>
          <p className="text-text-secondary mt-1">
            Active insolvency cases and automated debt tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
             onClick={() => setRefreshKey(prev => prev + 1)}
             className="p-2.5 rounded-lg border border-border-default hover:border-accent-blue/30 text-text-muted hover:text-accent-blue transition-all"
             title="Refresh Dashboard"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent-blue hover:bg-accent-blue-hover text-white font-bold transition-all shadow-lg hover:shadow-glow-blue whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            New Workspace
          </button>
        </div>
      </header>

      {/* Filters & Search */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex-1 min-w-[300px] relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-accent-blue transition-colors" />
          <input
            type="text"
            placeholder="Search by case number or debtor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border-default rounded-xl py-2.5 pl-12 pr-4 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-all text-sm placeholder:text-text-muted flex-1"
          />
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border-default text-text-secondary hover:text-text-primary hover:border-border-accent/50 transition-all text-sm font-medium">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Vault Grid */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-12">
        {loading && vaults.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-[280px] w-full" />
            ))}
          </div>
        ) : filteredVaults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-border-default rounded-3xl opacity-60 bg-secondary/20">
             <div className="p-5 bg-card border border-border-subtle rounded-full mb-6">
                <Scale className="w-12 h-12 text-text-muted" />
             </div>
             <p className="text-text-primary font-bold text-lg">No active workspaces found</p>
             <p className="text-sm text-text-muted mt-2 max-w-xs text-center">
               Initiate a new forensic investigation by clicking the "New Workspace" button above.
             </p>
             <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-6 text-accent-blue text-sm font-bold hover:underline"
             >
               Create your first case
             </button>
          </div>
        )}
      </div>

      {/* Create Vault Modal */}
      {userId && (
        <CreateVaultModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => setRefreshKey(prev => prev + 1)}
          userId={userId}
        />
      )}
    </div>
  );
}
