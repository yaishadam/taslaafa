import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * Reads go through the signed-in user's own session, so row-level security is
 * what keeps one shop out of another's data and a driver out of everything
 * but his own drops. Forgetting a .eq() in a query leaks nothing.
 *
 * Writes do not go through here. They go through a route handler that checks
 * the session and then uses the service client, which is one reviewable
 * surface rather than a policy matrix.
 */

export type Role = "owner" | "staff" | "driver";

export type Shop = {
  id: string;
  name: string;
  branch: string | null;
  timezone: string;
  defaultPromiseMinutes: number;
};

export type AppUser = {
  id: string;
  role: Role;
  fullName: string;
  shop: Shop;
};

/** Where each role belongs when they land on the app with nowhere in mind. */
export const HOME_FOR: Record<Role, string> = {
  owner: "/dashboard",
  staff: "/today",
  driver: "/drops",
};

export async function sessionClient(): Promise<SupabaseClient> {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) {
              store.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session instead, so this is safe
            // to swallow rather than crash a page render over.
          }
        },
      },
    },
  );
}

/**
 * The signed-in person and their shop, or null.
 *
 * Wrapped in React's cache() so a layout and the page inside it share one
 * answer. Without it every screen paid for the same two round trips twice,
 * and from Male to Singapore that is most of a second of staring at
 * nothing.
 *
 * getClaims(), not getUser(): getUser() is a network call to the auth server
 * on every single request. getClaims() verifies the token's signature
 * locally against the project's public keys, which it fetches once and
 * caches. It is not the getSession() shortcut -- that one trusts the cookie
 * without checking anything. This checks the signature, it just does not
 * need a round trip to do it.
 */
export const currentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await sessionClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("app_user")
    .select(
      "id, role, full_name, is_active, shop:shop_id (id, name, branch, timezone, default_promise_minutes)",
    )
    .eq("id", userId)
    .single();

  if (!data || !data.is_active) return null;

  // Supabase types an embedded one-to-one as a possible array.
  const shop = (Array.isArray(data.shop) ? data.shop[0] : data.shop) as {
    id: string;
    name: string;
    branch: string | null;
    timezone: string;
    default_promise_minutes: number;
  };

  return {
    id: data.id as string,
    role: data.role as Role,
    fullName: data.full_name as string,
    shop: {
      id: shop.id,
      name: shop.name,
      branch: shop.branch,
      timezone: shop.timezone,
      defaultPromiseMinutes: shop.default_promise_minutes,
    },
  };
});

export async function requireUser(): Promise<AppUser> {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}

/**
 * Requires one of the given roles, and sends anyone else to their own home
 * rather than to an error. A driver who taps a stale link to the dashboard
 * should land on his drops, not on a wall.
 */
export async function requireRole(...roles: Role[]): Promise<AppUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(HOME_FOR[user.role]);
  return user;
}
