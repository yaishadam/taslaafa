import { NextResponse } from "next/server";

/**
 * Is this deployment configured?
 *
 * Reports which variables are present, never their values. When the site is
 * throwing MIDDLEWARE_INVOCATION_FAILED on every URL, the cause is almost
 * always one of these missing, and there is otherwise no way to tell from
 * outside which one.
 *
 * Safe to leave public: a boolean saying "this app expects a Supabase key"
 * tells an attacker nothing they could not guess from the source, which is
 * on GitHub anyway.
 */
export const dynamic = "force-dynamic";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TASLAAFA_CODE_KEY",
  "CRON_SECRET",
] as const;

export async function GET() {
  const present: Record<string, boolean> = {};
  for (const name of REQUIRED) present[name] = Boolean(process.env[name]);

  const missing = REQUIRED.filter((n) => !present[n]);

  return NextResponse.json(
    {
      ok: missing.length === 0,
      missing,
      present,
      region: process.env.VERCEL_REGION ?? "local",
      origin_resolves_to:
        process.env.NEXT_PUBLIC_APP_ORIGIN ??
        process.env.VERCEL_PROJECT_PRODUCTION_URL ??
        "localhost",
    },
    { status: missing.length === 0 ? 200 : 503 },
  );
}
