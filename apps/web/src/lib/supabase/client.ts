import { createBrowserClient } from "@supabase/ssr";
import { config } from "@/config";

/**
 * Creates a Supabase client for use in browser/client components.
 * This client respects RLS policies based on the authenticated user.
 */
export function createClient() {
  return createBrowserClient(
    config.supabase.url,
    config.supabase.anonKey
  );
}
