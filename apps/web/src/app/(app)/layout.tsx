import { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[AppLayout Error]:", error);
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-primary text-text-primary overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative bg-[#0A0E1A]">
        {/* subtle gradient overlay for the main content area */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 pt-6 px-8 pb-8 h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
