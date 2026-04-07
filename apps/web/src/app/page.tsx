import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root page — Phase 1B redirect to the central dashboard.
 * Unauthenticated users will be intercepted by the middleware and sent to /login.
 */
export default async function Page() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirect("/login");
    }

    return redirect("/dashboard");
  } catch (error) {
    console.error("[Root Page Error]:", error);
    return redirect("/login");
  }
  return null;
}
