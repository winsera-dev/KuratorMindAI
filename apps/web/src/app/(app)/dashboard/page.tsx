"use client";

import React from "react";
import { 
  ShieldCheck, 
  Activity, 
  Clock,
  Database,
  AlertTriangle,
  Fingerprint,
  TrendingUp,
  Search,
  ShieldAlert,
  Zap,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Final Refined Forensic Dashboard
 * Vibe: Calm, Cold, Secure. 
 */
export default function DashboardPage() {
  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto w-full space-y-10">
      {/* 1. Technical Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
              <span className="w-6 h-1 bg-accent-blue rounded-full" />
              <h1 className="text-2xl font-black tracking-tight text-text-primary uppercase italic">
              Intelligence <span className="text-accent-blue not-italic">Overview</span>
              </h1>
          </div>
          <p className="text-text-muted text-sm font-medium max-w-2xl">
            Real-time forensic monitoring and case metrics.
          </p>
        </div>

        <div className="px-4 py-2 bg-secondary border border-border-default rounded-lg">
          <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-0.5">Global Sync Epoch</p>
          <p className="text-xs font-mono text-text-secondary tracking-tighter">2026-04-08 // 14:22:01.082</p>
        </div>
      </header>

      {/* 2. Precision Vitals - Horizontal Row */}
      <section className="flex flex-row items-center gap-4 w-full mt-6">
        {[
          { label: "Active Nodes", value: "12", icon: Database, color: "text-accent-blue" },
          { label: "Anomaly Count", value: "48", icon: AlertTriangle, color: "text-accent-rose" },
          { label: "Scan Velocity", value: "94.2", unit: "D/M", icon: Activity, color: "text-accent-cyan" },
          { label: "System Uptime", value: "99.9", unit: "%", icon: ShieldCheck, color: "text-accent-emerald" },
        ].map((stat, i) => (
          <div key={i} className="flex-1 bg-card border border-border-subtle p-4 rounded-xl flex items-center gap-4 group hover:border-border-default transition-colors min-w-0">
            <div className={cn("p-2 rounded-lg bg-secondary shrink-0", stat.color)}>
              <stat.icon size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-text-muted text-[9px] font-black uppercase tracking-widest truncate">{stat.label}</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-lg font-black text-text-primary tracking-tight">{stat.value}</h3>
                {stat.unit && <span className="text-[10px] font-bold text-text-muted">{stat.unit}</span>}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 3. High-Density Intelligence Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0">
        
        {/* Left: Forensic Analytics Chart */}
        <div className="lg:col-span-2 flex flex-col">
          <section className="bg-card border border-border-subtle rounded-xl p-6 flex-1 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black text-text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <TrendingUp size={14} className="text-accent-blue" />
                  Audit Progression Trend
                </h3>
                <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1.5 opacity-60">Forensic Scan Velocity // 30 Day Analytical Window</p>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-mono font-bold uppercase text-text-muted">
                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-sm bg-accent-blue" /> Cluster Scans</span>
                <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-sm bg-accent-rose" /> Anomalies</span>
              </div>
            </div>
            
            {/* Chart Area with Mock Data */}
            <div className="flex-1 w-full border-l border-b border-border-default/50 relative mt-6 flex items-end gap-1.5 px-2 pb-2">
              {[35, 50, 45, 80, 65, 75, 40, 95, 55, 70, 45, 88, 60, 82, 50, 92].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end gap-1 group">
                  <div 
                    className="w-full bg-accent-blue/10 group-hover:bg-accent-blue/30 transition-all rounded-sm relative" 
                    style={{ height: `${h}%` }}
                  >
                    {/* Data Point Label on Hover */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary border border-border-default px-1.5 py-0.5 rounded text-[8px] font-mono text-accent-blue z-10 whitespace-nowrap">
                      {Math.floor(h * 1.2)} SCANS
                    </div>
                  </div>
                  {i % 4 === 0 && (
                    <div 
                      className="w-full bg-accent-rose/30 rounded-sm animate-pulse" 
                      style={{ height: `${h/3}%` }}
                    />
                  )}
                </div>
              ))}
              
              {/* Scale Labels */}
              <div className="absolute -left-8 top-0 h-full flex flex-col justify-between text-[8px] font-mono text-text-muted/50 py-2">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-3 gap-6 pt-6 border-t border-border-subtle/50">
              <div>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Avg Confidence</p>
                <p className="text-base font-mono font-bold text-accent-emerald tracking-tighter">0.9824 <span className="text-[10px] text-accent-emerald/50">σ</span></p>
              </div>
              <div>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-widest">Cross-Case Matches</p>
                <p className="text-base font-mono font-bold text-text-primary tracking-tighter">14 <span className="text-[10px] text-text-muted">ENTITIES</span></p>
              </div>
              <div className="flex flex-col items-end">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border-default rounded-lg text-[9px] font-black text-accent-blue uppercase tracking-widest hover:bg-tertiary transition-all">
                  Export Dataset <Zap size={10} />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Chronological Activity Feed - Promoting Product Capability */}
        <div className="flex flex-col">
          <section className="bg-card border border-border-subtle rounded-xl p-6 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted mb-8 flex items-center gap-2">
              <Clock size={14} className="text-accent-cyan" />
              Recent Activity
            </h3>
            
            <div className="space-y-12 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {[
                { 
                  type: "ASSET", 
                  title: "Asset Hideout Detected", 
                  case: "CASE-882", 
                  desc: "AI identified shell entity linked to Debtor's offshore account via invoice mismatch.",
                  time: "02m ago", 
                  status: "High Priority", 
                  color: "bg-accent-rose",
                  icon: Target
                },
                { 
                  type: "ENTITY", 
                  title: "Cross-Case Entity Match", 
                  case: "GLOBAL", 
                  desc: "Same creditor identified in 3 active insolvencies with conflicting claim amounts.",
                  time: "18m ago", 
                  status: "System Match", 
                  color: "bg-accent-cyan",
                  icon: Search
                },
                { 
                  type: "LOGIC", 
                  title: "Contradiction Found", 
                  case: "CASE-441", 
                  desc: "Debtor testimony contradicts provided bank statements from Q3 2025.",
                  time: "45m ago", 
                  status: "Verified", 
                  color: "bg-accent-amber",
                  icon: ShieldAlert
                },
                { 
                  type: "SYNC", 
                  title: "Node Sync Successful", 
                  case: "NODE-01", 
                  desc: "Court schedule successfully synchronized with forensic timeline.",
                  time: "02h ago", 
                  status: "Healthy", 
                  color: "bg-accent-blue",
                  icon: Zap
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 group cursor-default">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={cn("p-1.5 rounded-lg bg-secondary", item.color.replace('bg-', 'text-'))}>
                      <item.icon size={12} />
                    </div>
                    <div className="w-px flex-1 bg-border-subtle/50 mt-2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className="text-[8px] font-mono font-bold text-text-muted uppercase tracking-tighter">{item.type} // {item.case}</span>
                      <span className="text-[8px] text-text-muted font-bold whitespace-nowrap">{item.time}</span>
                    </div>
                    <h4 className="text-[11px] font-black text-text-primary group-hover:text-accent-blue transition-colors uppercase tracking-tight">{item.title}</h4>
                    <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed font-medium">
                      {item.desc}
                    </p>
                    <div className="mt-2.5">
                      <div className={cn("inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", item.color.replace('bg-', 'text-'), item.color.replace('bg-', 'bg-') + '/10')}>
                        {item.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-8 py-3 bg-secondary border border-border-subtle rounded-lg text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary hover:border-border-default transition-all shrink-0">
              Access Intelligence Log
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
