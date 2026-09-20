import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service client bypasses row-level security.
 *
 * Every write in this app goes through it, from a route handler that has
 * already checked the session. Reads for the shop's own screens should use
 * the session client instead, so RLS -- not a forgotten .eq() -- is what
 * keeps one shop out of another's data, and a driver out of everything but
 * his own drops.
 *
 * It is still bound by the append-only triggers on delivery_event and
 * delivery. BYPASSRLS is not bypass-everything.
 */

let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
