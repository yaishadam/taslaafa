/**
 * Where the customer links point.
 *
 * This is the one value that, if wrong, breaks the product silently: every
 * link shared into a Viber thread would point somewhere the customer cannot
 * reach, and nobody at the shop would notice until someone complained. It
 * had a `?? ""` fallback on the proof screen, which would have produced
 * "/d/abc123" with no host at all -- a copied link that goes nowhere.
 *
 * Order of preference:
 *   1. NEXT_PUBLIC_APP_ORIGIN   what you set deliberately, e.g. the real domain
 *   2. VERCEL_PROJECT_PRODUCTION_URL  the production deployment, even when
 *      this code is running in a preview -- a link handed to a customer
 *      should outlive the preview it was created on
 *   3. VERCEL_URL               this deployment, as a last resort
 *   4. localhost                development
 */

function withScheme(host: string): string {
  return host.startsWith("http") ? host : `https://${host}`;
}

export function appOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return withScheme(production);

  const deployment = process.env.VERCEL_URL;
  if (deployment) return withScheme(deployment);

  return "http://localhost:3000";
}
