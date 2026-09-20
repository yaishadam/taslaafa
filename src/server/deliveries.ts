import "server-only";
import { sessionClient } from "@/server/auth";
import { serviceClient } from "@/server/supabase";
import type { Delivery, DeliveryEvent, EventType } from "@/lib/status";
import { shopDayStart } from "@/lib/time";

/**
 * Reads for the shop's own screens.
 *
 * Every query here runs as the signed-in user, so RLS decides what comes
 * back. There is no shop_id filter in this file and there should not be one:
 * if a driver could see another driver's drops, that would be a policy bug,
 * and a filter here would only hide it.
 */

const SELECT = `
  id,
  order_ref,
  promise_minutes,
  created_at,
  sent_at,
  due_at,
  confirmed_at,
  public_token,
  customer:customer_id ( id, name, phone, address ),
  driver:driver_id ( id, full_name ),
  events:delivery_event (
    id, type, actor_kind, created_at, payload,
    actor:actor_user_id ( full_name )
  )
`;

/** Supabase types a to-one embed as possibly an array. Unwrap it. */
function one<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type RawRow = Record<string, unknown>;

function toDelivery(row: RawRow): Delivery {
  const customer = one(
    row.customer as { id: string; name: string; phone: string; address: string },
  )!;
  const driver = one(row.driver as { id: string; full_name: string } | null);

  const events: DeliveryEvent[] = ((row.events as RawRow[]) ?? [])
    .map((e) => ({
      id: e.id as number,
      type: e.type as EventType,
      actorKind: e.actor_kind as DeliveryEvent["actorKind"],
      actorName:
        one(e.actor as { full_name: string } | null)?.full_name ?? null,
      createdAt: e.created_at as string,
      payload: (e.payload as Record<string, unknown>) ?? {},
    }))
    .sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id,
    );

  return {
    id: row.id as string,
    orderRef: (row.order_ref as string | null) ?? null,
    promiseMinutes: row.promise_minutes as number,
    createdAt: row.created_at as string,
    sentAt: (row.sent_at as string | null) ?? null,
    dueAt: (row.due_at as string | null) ?? null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    publicToken: row.public_token as string,
    customer,
    driver: driver ? { id: driver.id, name: driver.full_name } : null,
    events,
  };
}

/**
 * Flags everything past its promise.
 *
 * Called from the screens that show lateness rather than only from cron,
 * because Vercel's Hobby tier caps cron at once a day, which is useless for
 * a 30 minute promise. It is idempotent -- a partial unique index makes the
 * second call a no-op -- so calling it on every board load costs nothing.
 */
export async function sweepLate(shopId: string): Promise<void> {
  const { error } = await serviceClient().rpc("sweep_late", {
    p_shop_id: shopId,
  });
  // A failed sweep must not blank the screen. The board still renders, and
  // lateness is recomputed from due_at anyway -- the event is the durable
  // record, not the source of the red pill.
  if (error) console.error("sweep_late failed:", error.message);
}

/** Everything taken today, in the shop's timezone. */
export async function loadToday(timezone: string): Promise<Delivery[]> {
  const supabase = await sessionClient();
  const since = shopDayStart(new Date(), timezone).toISOString();

  const { data, error } = await supabase
    .from("delivery")
    .select(SELECT)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load today: ${error.message}`);
  return (data ?? []).map(toDelivery);
}

/** Everything still out, whatever day it was taken. */
export async function loadOpen(): Promise<Delivery[]> {
  const supabase = await sessionClient();

  const { data, error } = await supabase
    .from("delivery")
    .select(SELECT)
    .is("confirmed_at", null)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: true });

  if (error) throw new Error(`Could not load open deliveries: ${error.message}`);
  return (data ?? []).map(toDelivery);
}

export async function loadDelivery(id: string): Promise<Delivery | null> {
  const supabase = await sessionClient();

  const { data, error } = await supabase
    .from("delivery")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load delivery: ${error.message}`);
  return data ? toDelivery(data as RawRow) : null;
}

/** The proof log: everything, newest first. */
export async function loadProofLog(limit = 100): Promise<Delivery[]> {
  const supabase = await sessionClient();

  const { data, error } = await supabase
    .from("delivery")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load the proof log: ${error.message}`);
  return (data ?? []).map(toDelivery);
}

export async function loadDrivers(): Promise<{ id: string; name: string }[]> {
  const supabase = await sessionClient();

  const { data, error } = await supabase
    .from("app_user")
    .select("id, full_name, role")
    .eq("role", "driver")
    .order("full_name");

  if (error) throw new Error(`Could not load drivers: ${error.message}`);
  return (data ?? []).map((u) => ({
    id: u.id as string,
    name: u.full_name as string,
  }));
}
