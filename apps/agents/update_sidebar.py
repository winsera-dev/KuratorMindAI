import os

file_path = '../web/src/components/layout/Sidebar.tsx'

content = """\"use client\";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  ShieldCheck,
  ChevronRight,
  User,
  RefreshCw,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Cases", href: "/cases", icon: Briefcase },
  { name: "Case Sync", href: "/case-sync", icon: RefreshCw },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
      }
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="w-64 bg-secondary border-r border-border-subtle flex flex-col h-full sticky top-0">
      {/* Brand Header */}
      <div className="p-6">
        <Link href="/dashboard" className="block transform hover:scale-[1.02] transition-transform">
          <span className="text-2xl font-black tracking-tighter text-text-primary leading-none">
            KuratorMind <span className="text-accent-blue">AI</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-accent-blue/10 text-accent-blue shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                  : "text-text-secondary hover:text-text-primary hover:bg-elevated/50"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-accent-blue" : "text-text-muted group-hover:text-text-secondary"
                )} />
                {item.name}
              </div>
              {isActive && <ChevronRight className="w-3 h-3 text-accent-blue/50" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Context: Protocol Status */}
      <div className="p-4 mx-4 mb-4 rounded-xl bg-primary/50 border border-border-subtle">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted">
            Protocol Secured
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary font-mono">NODE-07X</span>
          <ShieldCheck className="w-3 h-3 text-accent-blue" />
        </div>
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-border-subtle bg-secondary/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-elevated border border-border-subtle flex items-center justify-center">
            <User className="w-5 h-5 text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {userEmail ? userEmail.split("@")[0] : "Agent"}
            </p>
            <p className="text-[10px] text-text-muted truncate">Level 3 Access</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-text-muted hover:text-accent-rose hover:bg-accent-rose/10 rounded-lg transition-all group/logout"
            title="Logout"
          >
            <LogOut className="w-4 h-4 group-hover/logout:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </aside>
  );
}
"""

with open(file_path, 'w') as f:
    f.write(content)
