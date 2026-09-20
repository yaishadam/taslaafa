import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The password every seeded account shares, read from the environment.
 *
 * Not a constant in here. This repository is public, and once the app is
 * deployed its Supabase URL and public key are in the browser bundle by
 * necessity -- so a password committed alongside them is a working login
 * for anyone who reads the source.
 */
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "";

export const SEED_USERS = {
  owner: "owner@taslaafa.mv",
  staff: "reem@taslaafa.mv",
  driver: "hassan@taslaafa.mv",
} as const;

export type SeedRole = keyof typeof SEED_USERS;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. The guard tests run against a real database on ` +
        `purpose -- a mock cannot prove that Postgres refuses a write. ` +
        `Fill in .env and run 'npm run seed'.`,
    );
  }
  return value;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function anonClient(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * One sign-in per role per test file, reused.
 *
 * Signing in inside every `it` hits Supabase's auth rate limit within a
 * single run, which then fails the guards for a reason that has nothing to
 * do with the rules they protect -- the worst kind of flake, because it
 * teaches you to ignore a red guard.
 */
const sessions = new Map<SeedRole, Promise<SupabaseClient>>();

/** A client carrying a real signed-in session, so RLS applies as it would live. */
export function signedInAs(role: SeedRole): Promise<SupabaseClient> {
  const existing = sessions.get(role);
  if (existing) return existing;

  const pending = (async () => {
    const client = anonClient();
    if (!SEED_PASSWORD) {
      throw new Error(
        "SEED_PASSWORD is not set. The guards sign in as real seeded users; " +
          "put the value from .env into the environment.",
      );
    }
    const { error } = await client.auth.signInWithPassword({
      email: SEED_USERS[role],
      password: SEED_PASSWORD,
    });
    if (error) {
      throw new Error(
        `Could not sign in as ${role} (${SEED_USERS[role]}): ${error.message}. ` +
          `Has 'npm run seed' been run against this database?`,
      );
    }
    return client;
  })();

  sessions.set(role, pending);
  return pending;
}
