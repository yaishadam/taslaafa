import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { hashCode } from "@/server/codes";
import { serviceClient } from "@/server/supabase";

/**
 * The driver types the code at the door.
 *
 * Nothing here can read the code. It hashes what was typed and hands the
 * digest to attempt_code() in Postgres, which compares, counts, locks at
 * three and writes the event -- all inside one transaction, so two taps on
 * a slow connection cannot double-count an attempt or confirm twice.
 *
 * The HMAC key never reaches the database, so the function cannot be used
 * as an oracle by anyone holding only database access.
 */

type Result =
  | "confirmed"
  | "wrong"
  | "locked"
  | "already_confirmed"
  | "not_found";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/deliveries/[id]/confirm">,
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = String(body.code ?? "").trim();

  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json(
      { error: "A code is four digits" },
      { status: 400 },
    );
  }

  const db = serviceClient();

  const { data: delivery } = await db
    .from("delivery")
    .select("id, shop_id, driver_id")
    .eq("id", id)
    .maybeSingle();

  if (!delivery || delivery.shop_id !== user.shop.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the rider carrying it. Staff and the owner cannot confirm from
  // behind the counter -- the code is proof that someone stood at the door,
  // and that proof is worth nothing if the shop can enter it itself.
  if (delivery.driver_id !== user.id) {
    return NextResponse.json(
      { error: "Only the rider carrying this delivery can confirm it" },
      { status: 403 },
    );
  }

  const { data, error } = await db.rpc("attempt_code", {
    p_delivery_id: id,
    p_actor_id: user.id,
    p_code_hash: hashCode(code),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as {
    result: Result;
    attempts?: number;
    attempts_left?: number;
    locked?: boolean;
    seconds_to_door?: number;
    beat_promise?: boolean;
    confirmed_at?: string;
  };

  const status =
    result.result === "confirmed" || result.result === "already_confirmed"
      ? 200
      : result.result === "not_found"
        ? 404
        : result.result === "locked"
          ? 423
          : 422;

  return NextResponse.json(result, { status });
}
