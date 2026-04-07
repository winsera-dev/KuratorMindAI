"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsTabs() {
  const pathname = usePathname();

  const tabs = [
    { href: "/settings/profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { href: "/settings/forensic", label: "Workspace", icon: <Briefcase className="w-4 h-4" /> },
    { href: "/settings/security", label: "Security", icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <nav className="flex items-center p-1 bg-secondary rounded-2xl w-fit border border-border-default/50 self-start shadow-inner">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all relative group",
              isActive 
                ? "bg-card text-white shadow-lg shadow-black/20" 
                : "text-text-muted hover:text-text-primary"
            )}
          >
            <span className={cn(
              "transition-colors",
              isActive ? "text-accent-blue" : "group-hover:text-text-secondary"
            )}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {isActive && (
              <div className="absolute inset-0 rounded-xl border border-white/5 pointer-events-none" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
