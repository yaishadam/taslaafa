"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * The browser client exists for exactly one job: signing in and out.
 *
 * Everything the shop reads is rendered on the server, and everything it
 * writes goes through a route handler. Nothing here should ever grow a query.
 */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
