import { NextResponse } from "next/server";
import { serviceClient } from "@/server/supabase";

/**
 * Flags every delivery past its promise, across every shop.
 *
 * This is the backstop, not the main path. Vercel's Hobby tier runs cron
 * once a day, which is useless against a 30 minute promise, so the board
 * endpoints sweep their own shop on every load. This exists for the quiet
 * hours when nobody has a screen open and a delivery still goes past its
 * time -- the event should be written then, not backdated later.
 *
 * Idempotent: a partial unique index means a second sweep writes nothing.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  // Vercel sends `Authorization: Bearer $CRON_SECRET`. Without the secret
  // set, refuse rather than run: an open endpoint that writes events is not
  // something to leave on by accident.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { data, error } = await serviceClient().rpc("sweep_late", {
    p_shop_id: null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flagged: data ?? 0 });
}
