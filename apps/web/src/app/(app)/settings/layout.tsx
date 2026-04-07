import React from "react";
import SettingsTabs from "@/components/settings/SettingsTabs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full bg-background p-6 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto w-full">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
            <span className="w-8 h-1 bg-accent-blue rounded-full" />
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">
            Control Center
            </h1>
        </div>
        <p className="text-text-muted text-base font-medium max-w-2xl">
          Authorized personnel only. Configure your forensic identity, global workspace preferences, and security protocols.
        </p>
      </header>

      <SettingsTabs />

      <main className="flex-1 min-h-0">
        <div className="h-full bg-card/40 backdrop-blur-sm rounded-[2rem] border border-border-default/50 p-6 md:p-10 shadow-2xl shadow-indigo-900/10 transition-all hover:bg-card/50 overflow-y-auto scrollbar-none">
          {children}
        </div>
      </main>
    </div>
  );
}
