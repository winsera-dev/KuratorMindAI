"use client";

import React from "react";
import { 
  Zap, 
  Target, 
  FileText, 
  Cpu, 
  Settings2,
  HardDrive
} from "lucide-react";
import { Button } from "@/components/ui/button";

const models = [
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Complex reasoning & massive context", speed: "High", badge: "default" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Ultra-fast document processing", speed: "Ultra", badge: "optimized" },
];

export default function ForensicDefaultsForm() {
  return (
    <div className="space-y-12 max-w-3xl">
      {/* Analysis Thresholds */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-xl font-bold text-white tracking-tight">Analysis Thresholds</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl bg-primary/30 border border-border-subtle/50 space-y-4">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-medium text-text-secondary">Confidence Cutoff</label>
              <span className="text-xs font-mono text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-full">0.85</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              defaultValue="0.85"
              className="w-full accent-accent-cyan h-1.5 bg-elevated rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[10px] text-text-muted italic px-1">
              Minimum reliability score required for legal citations.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-primary/30 border border-border-subtle/50 space-y-4">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-medium text-text-secondary">Context Depth</label>
              <span className="text-xs font-mono text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full">High</span>
            </div>
            <div className="flex gap-2">
              {['Low', 'Mid', 'High'].map((level) => (
                <button 
                  key={level}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    level === 'High' 
                      ? 'bg-accent-blue text-white shadow-lg' 
                      : 'bg-elevated text-text-muted hover:text-text-primary'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-muted italic px-1">
              RAG retrieval scope per query. Higher depth = more tokens.
            </p>
          </div>
        </div>
      </section>

      {/* Model Selection */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Cpu className="w-5 h-5 text-accent-blue" />
          <h2 className="text-xl font-bold text-white tracking-tight">Intelligence Engine</h2>
        </div>

        <div className="space-y-4">
          {models.map((model) => (
            <div 
              key={model.id}
              className={`group flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer ${
                model.id === 'gemini-1.5-pro'
                  ? 'bg-accent-blue/5 border-accent-blue/30 shadow-[0_0_20px_rgba(59,130,246,0.05)]'
                  : 'bg-primary/30 border-border-default/50 hover:border-accent-blue/20 hover:bg-primary/50'
              }`}
            >
              <div className={`p-3 rounded-xl ${
                model.id === 'gemini-1.5-pro' ? 'bg-accent-blue text-white' : 'bg-elevated text-text-muted group-hover:text-text-primary'
              }`}>
                <Zap className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white">{model.name}</h3>
                  <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded leading-none ${
                    model.badge === 'default' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-accent-emerald/20 text-accent-emerald'
                  }`}>
                    {model.badge}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{model.description}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter mb-1">Latency</p>
                <div className="flex gap-0.5">
                  {[1,2,3].map((i) => (
                    <div key={i} className={`w-3 h-1 rounded-full ${
                      model.speed === 'Ultra' ? 'bg-accent-emerald' : i <= 2 ? 'bg-accent-blue' : 'bg-elevated'
                    }`} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Global Persistence */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <HardDrive className="w-5 h-5 text-accent-rose" />
          <h2 className="text-xl font-bold text-white tracking-tight">Retention Policy</h2>
        </div>
        <div className="p-6 rounded-2xl bg-gradient-to-br from-accent-rose/5 to-transparent border border-accent-rose/20">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-text-primary">E2E Session Encryption</span>
            <div className="w-10 h-5 bg-accent-rose rounded-full relative">
              <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md" />
            </div>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            All transient chat data and forensic chunk mappings are protected via platform-wide HSM-backed keys. This setting cannot be disabled for Level 3 users.
          </p>
        </div>
      </section>

      <div className="flex justify-end pt-4">
        <Button className="bg-accent-blue hover:bg-accent-blue-hover text-white px-10 rounded-xl h-12 font-bold shadow-xl shadow-accent-blue/20 transition-all active:scale-[0.98]">
          <Settings2 className="w-4 h-4 mr-2" />
          Sync Workspace Protocols
        </Button>
      </div>
    </div>
  );
}
