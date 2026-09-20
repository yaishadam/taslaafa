import "server-only";
import { revealCode } from "@/server/codes";
import { serviceClient } from "@/server/supabase";

/**
 * The customer's view of a delivery, and the ONLY path in the application
 * that turns a stored code back into four digits.
 *
 * Split from server/deliveryCodes.ts on purpose. That module WRITES codes,
 * which any route creating a delivery legitimately needs to do. This one
 * READS them, and is reachable from exactly one file:
 * src/app/d/[token]/page.tsx.
 *
 * tests/guards/code-visibility.test.ts fails the build if a second importer
 * appears. If you are here to use this from a shop screen, that is the rule
 * you are about to break -- the whole product rests on the shop not being
 * able to read a code.
 *
 * It runs on the service client because the customer has no account and no
 * database access at all: anon is granted nothing.
 */

export type CustomerView = {
  deliveryId: string;
  code: string;
  shopName: string;
  orderRef: string | null;
  driverName: string | null;
  promiseMinutes: number;
  sentAt: string | null;
  dueAt: string | null;
  confirmedAt: string | null;
  markedLateAt: string | null;
  reportedAt: string | null;
};

function one<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  return (Array.isArray(value) ? (value[0] ?? null) : value) as T | null;
}

export async function customerView(
  token: string,
): Promise<CustomerView | null> {
  const db = serviceClient();

  const { data, error } = await db
    .from("delivery")
    .select(
      `
      id, order_ref, promise_minutes, sent_at, due_at, confirmed_at,
      shop:shop_id ( name, branch ),
      driver:driver_id ( full_name ),
      code:delivery_code ( code_ct ),
      events:delivery_event ( type, created_at )
    `,
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error || !data) return null;

  const shop = one<{ name: string; branch: string | null }>(data.shop);
  const driver = one<{ full_name: string }>(data.driver);
  const code = one<{ code_ct: string }>(data.code);

  // A delivery with no code row cannot be confirmed and the page would be
  // meaningless. Treat it as not found rather than rendering an empty box.
  if (!shop || !code) return null;

  const events = (data.events ?? []) as unknown as {
    type: string;
    created_at: string;
  }[];

  const latest = (type: string) =>
    events
      .filter((e) => e.type === type)
      .map((e) => e.created_at)
      .sort()
      .at(-1) ?? null;

  return {
    deliveryId: data.id as string,
    code: revealCode(code.code_ct),
    shopName: shop.branch ? `${shop.name}, ${shop.branch}` : shop.name,
    orderRef: (data.order_ref as string | null) ?? null,
    driverName: driver?.full_name ?? null,
    promiseMinutes: data.promise_minutes as number,
    sentAt: (data.sent_at as string | null) ?? null,
    dueAt: (data.due_at as string | null) ?? null,
    confirmedAt: (data.confirmed_at as string | null) ?? null,
    markedLateAt: latest("marked_late"),
    reportedAt: latest("problem_reported"),
  };
}

/** Records the first open, and only the first. Safe to call on every load. */
export async function recordLinkOpened(deliveryId: string): Promise<void> {
  const { error } = await serviceClient().rpc("record_link_opened", {
    p_delivery_id: deliveryId,
  });
  // The customer's page must render even if this fails. Losing one open
  // event is bad; showing a broken page to the person waiting is worse.
  if (error) console.error("record_link_opened failed:", error.message);
}
