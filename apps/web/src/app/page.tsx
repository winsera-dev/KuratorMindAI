import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root page — Phase 1B redirect to the central dashboard.
 * Unauthenticated users will be intercepted by the middleware and sent to /login.
 */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  // If somehow not caught by middleware, redirect anyway 
  // (Landing page will be implemented in Phase 1C)
  redirect("/login");

  return null;
}
