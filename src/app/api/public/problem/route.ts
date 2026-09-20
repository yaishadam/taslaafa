import { NextResponse } from "next/server";
import { serviceClient } from "@/server/supabase";

/**
 * The customer's "Report a problem", from a page with no account behind it.
 *
 * Authorisation is the token: knowing it means you were sent the link. That
 * is the same standing the page itself has, and the worst a guessed token
 * buys is one event on a stranger's delivery, which the shop reads as a
 * report and can ignore.
 */

const REASONS = new Set([
  "Hasn't arrived",
  "Wrong items",
  "Wrong address",
  "Driver asked for the code over the phone",
]);

const MAX_NOTE = 500;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: unknown;
    reason?: unknown;
    note?: unknown;
  };

  const token = String(body.token ?? "");
  const reason = String(body.reason ?? "");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  // Only the presets. An open reason field on an unauthenticated endpoint is
  // a way to write arbitrary text into a shop's screens.
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: "Unknown reason" }, { status: 400 });
  }

  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, MAX_NOTE)
      : null;

  const db = serviceClient();

  const { data: delivery } = await db
    .from("delivery")
    .select("id, shop_id")
    .eq("public_token", token)
    .maybeSingle();

  if (!delivery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await db.from("delivery_event").insert({
    delivery_id: delivery.id,
    shop_id: delivery.shop_id,
    type: "problem_reported",
    actor_kind: "customer",
    payload: { reason, note },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
