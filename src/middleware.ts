import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request, and keeps signed-out
 * people out of the shop.
 *
 * Server Components cannot write cookies, so without this a session would
 * expire mid-shift and the next page load would bounce someone to sign-in for
 * no reason they could see.
 *
 * Role routing is NOT done here. Roles live in the database, and reaching for
 * them in middleware means a query on every request including every asset.
 * Each route group checks its own role in a Server Component instead.
 */

/** Paths a signed-out person is allowed to reach. */
const PUBLIC_PREFIXES = ["/signin", "/d/", "/api/public/", "/api/cron/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() verifies the token's signature locally against the project's
  // public keys, so a valid session costs no network at all. That matters
  // here more than anywhere: this runs on every request, and the round trip
  // to Singapore was showing up as a fixed ~200ms tax on every page.
  //
  // Not getSession(), which trusts the cookie without checking it. When the
  // token is missing or past its hour, fall through to getUser(), which does
  // talk to the auth server and refreshes it.
  const { data: claims } = await supabase.auth.getClaims();
  let user: { id: string } | null = claims?.claims?.sub
    ? { id: claims.claims.sub }
    : null;

  if (!user) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const signin = request.nextUrl.clone();
    signin.pathname = "/signin";
    // So a shared link to a proof screen survives the detour through sign-in.
    if (pathname !== "/") signin.searchParams.set("next", pathname);
    return NextResponse.redirect(signin);
  }

  if (user && pathname === "/signin") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and the favicon. Images are
     * excluded by extension so the session check does not run per icon.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
