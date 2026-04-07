"use client";

import React from "react";
import { 
  ShieldAlert, 
  Key, 
  Fingerprint, 
  History, 
  Lock,
  Smartphone,
  Globe,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SecurityForm() {
  return (
    <div className="space-y-10 max-w-4xl">
      {/* Active Session Monitoring */}
      <section className="bg-primary/20 rounded-[2rem] border border-border-subtle/30 overflow-hidden">
        <div className="p-8 border-b border-border-subtle/30 bg-secondary/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-accent-rose" />
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Active Protocol Monitoring</h2>
                <p className="text-xs text-text-muted">Real-time session authorization tracking</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-accent-emerald/10 text-accent-emerald text-[10px] font-black uppercase tracking-widest rounded-full border border-accent-emerald/20">
              No Anomalies
            </span>
          </div>
        </div>

        <div className="divide-y divide-border-subtle/20">
          {[
            { device: "MacBook Pro M3", location: "Jakarta, ID", status: "Current", icon: Smartphone },
            { device: "iPad Pro (Forensic Node)", location: "Singapore", status: "Authorized", icon: Globe },
          ].map((session, i) => (
            <div key={i} className="p-5 flex items-center hover:bg-white/5 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center border border-border-subtle/50 group-hover:border-accent-blue/50 transition-all">
                <session.icon className="w-5 h-5 text-text-muted group-hover:text-accent-blue" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-sm font-bold text-text-primary">{session.device}</h3>
                <p className="text-[10px] text-text-muted">{session.location} • Last active 2m ago</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] font-bold text-text-muted hover:text-accent-rose">
                REVOKE
              </Button>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Two-Factor Auth */}
        <section className="p-8 rounded-[2rem] border border-border-subtle/30 bg-secondary/30 space-y-6">
          <div className="flex items-center gap-3">
            <Fingerprint className="w-5 h-5 text-accent-blue" />
            <h2 className="text-lg font-bold text-white">Biometric Authorization</h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Require Passkeys or hardware security keys (YubiKey) for document deletion and case sealing.
          </p>
          <div className="flex items-center gap-4">
            <Button className="flex-1 bg-accent-blue text-white rounded-xl h-11 font-bold">
              Setup Passkey
            </Button>
            <div className="w-12 h-6 bg-accent-blue/10 rounded-full flex items-center px-1 border border-accent-blue/20">
              <div className="w-4 h-4 bg-accent-blue rounded-full shadow-lg ml-auto" />
            </div>
          </div>
        </section>

        {/* API Secrets */}
        <section className="p-8 rounded-[2rem] border border-border-subtle/30 bg-secondary/30 space-y-6">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-accent-cyan" />
            <h2 className="text-lg font-bold text-white">Node API Keys</h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Manage keys for automated Kurator agent deployment and external database sync.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 px-4 h-11 bg-primary/50 border border-border-subtle rounded-xl flex items-center font-mono text-[10px] text-text-muted overflow-hidden">
              km_node_live_************************
            </div>
            <Button variant="outline" className="h-11 rounded-xl border-border-subtle text-text-primary px-4 font-bold">
              Reveal
            </Button>
          </div>
        </section>
      </div>

      {/* Protocol Lockdown (Emergency) */}
      <section className="p-8 rounded-[2rem] border border-accent-rose/30 bg-accent-rose/5 space-y-4">
        <div className="flex items-center gap-3 text-accent-rose">
          <AlertTriangle className="w-6 h-6" />
          <h2 className="text-xl font-bold italic tracking-tighter uppercase">PROTOCOL LOCKDOWN</h2>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          In case of suspected node breach, trigger an immediate global session revocation. All case data remaining in transient memory will be wiped and vectors will be temporarily offline.
        </p>
        <Button className="w-full bg-accent-rose hover:bg-red-600 text-white rounded-2xl h-14 font-black text-base shadow-[0_0_30px_rgba(244,63,94,0.3)] transition-all active:scale-95">
          INITIATE EMERGENCY LOCKDOWN
        </Button>
      </section>

      {/* Audit Logs Link */}
      <div className="flex justify-center flex-col items-center gap-4 text-center pt-6">
        <Button variant="link" className="text-text-muted hover:text-accent-blue text-xs flex items-center gap-2">
          <History className="w-3 h-3" />
          View Full Immutable Audit Logs
        </Button>
        <div className="flex items-center gap-1.5 grayscale opacity-30">
          <Lock className="w-3 h-3" />
          <span className="text-[10px] font-black uppercase tracking-widest">Quantum-Resistant Layer Active</span>
        </div>
      </div>
    </div>
  );
}
