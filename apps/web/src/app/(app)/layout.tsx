import { ReactNode } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, Settings, ShieldCheck, Database } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-primary text-text-primary">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border-default bg-card flex flex-col">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">KuratorMind</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-elevated text-accent-blue font-medium"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
            Infrastructure
          </div>
        </nav>

        <div className="p-4 border-t border-border-default">
          <Link
            href="/case-sync"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-elevated transition-colors text-text-secondary w-full"
          >
            <Database className="w-5 h-5 transition-colors" />
            <span className="text-sm font-medium">Case Sync</span>
          </Link>
          <button
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-elevated transition-colors text-text-secondary w-full text-left mt-1"
          >
            <Settings className="w-5 h-5 transition-colors" />
            <span className="text-sm font-medium">Settings</span>
          </button>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors text-red-400 mt-1"
            >
              <LogOut className="w-5 h-5 shadow-sm" />
              <span className="text-sm font-medium">Log out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}
