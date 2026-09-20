import { NextResponse } from "next/server";
import { deliveryUrl, shareMessage } from "@/lib/share";
import { currentUser } from "@/server/auth";
import { mintCode, mintToken } from "@/server/codes";
import { storeNewCode } from "@/server/deliveryCodes";
import { normalisePhone } from "@/server/phone";
import { serviceClient } from "@/server/supabase";

/**
 * Create a delivery and send it out in one action.
 *
 * The staff member taps one button. Behind it: the customer is found or
 * created, a code is minted, the delivery is written, and two events land --
 * `created` and `sent_out`. The response carries the link and the message to
 * share, and never the code.
 *
 * Writes use the service client because RLS gives authenticated clients read
 * access only. The session check below is what stands in for the policy, and
 * it is the reason every write in this app lives in a route handler rather
 * than being scattered across components.
 */

const PROMISES = [15, 30, 45, 60] as const;
type Promise_ = (typeof PROMISES)[number];

type Body = {
  customerName?: unknown;
  phone?: unknown;
  address?: unknown;
  promiseMinutes?: unknown;
  orderRef?: unknown;
  driverId?: unknown;
};

function bad(message: string, field?: string) {
  return NextResponse.json({ error: message, field }, { status: 400 });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.role === "driver") {
    return NextResponse.json(
      { error: "Drivers cannot create deliveries" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  const customerName = String(body.customerName ?? "").trim();
  const address = String(body.address ?? "").trim();
  const orderRef = String(body.orderRef ?? "").trim() || null;
  const driverId = body.driverId ? String(body.driverId) : null;
  const promiseMinutes = Number(body.promiseMinutes);

  if (!customerName) return bad("Who is this for?", "customerName");
  if (!address) return bad("Where is it going?", "address");
  if (!PROMISES.includes(promiseMinutes as Promise_)) {
    return bad("Pick a promise time", "promiseMinutes");
  }
  if (!driverId) return bad("Who is taking it?", "driverId");

  const phone = normalisePhone(String(body.phone ?? ""));
  if (!phone) return bad("That is not a 7-digit number", "phone");

  const db = serviceClient();

  // The driver must belong to this shop. Without this check a staff member
  // could assign a delivery to someone at another shop by guessing an id.
  const { data: driver } = await db
    .from("app_user")
    .select("id, full_name, role, shop_id")
    .eq("id", driverId)
    .eq("shop_id", user.shop.id)
    .maybeSingle();

  if (!driver || driver.role !== "driver") {
    return bad("That rider is not at this shop", "driverId");
  }

  // One customer per number per shop. Staff retype the name and address
  // every time, so take the latest as the truth -- people move.
  const { data: customer, error: customerError } = await db
    .from("customer")
    .upsert(
      {
        shop_id: user.shop.id,
        name: customerName,
        phone,
        address,
      },
      { onConflict: "shop_id,phone" },
    )
    .select()
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: `Could not save the customer: ${customerError?.message}` },
      { status: 500 },
    );
  }

  const now = new Date();
  const dueAt = new Date(now.getTime() + promiseMinutes * 60_000);
  const token = mintToken();

  // mintCode returns the plaintext exactly once. It is not stored, not
  // logged, and not put in the response -- it goes into the ciphertext and
  // nowhere else.
  const { codeHash, codeCt } = mintCode();

  const { data: delivery, error: deliveryError } = await db
    .from("delivery")
    .insert({
      shop_id: user.shop.id,
      customer_id: customer.id,
      order_ref: orderRef,
      promise_minutes: promiseMinutes,
      driver_id: driver.id,
      created_by: user.id,
      public_token: token,
      created_at: now.toISOString(),
      sent_at: now.toISOString(),
      due_at: dueAt.toISOString(),
    })
    .select()
    .single();

  if (deliveryError || !delivery) {
    return NextResponse.json(
      { error: `Could not create the delivery: ${deliveryError?.message}` },
      { status: 500 },
    );
  }

  const { error: codeError } = await storeNewCode(
    delivery.id,
    codeHash,
    codeCt,
  );

  if (codeError) {
    // A delivery with no code can never be confirmed, and it cannot be
    // deleted either. Say so loudly rather than handing back a link that
    // leads to a dead end.
    return NextResponse.json(
      { error: `The delivery was created but has no code: ${codeError}` },
      { status: 500 },
    );
  }

  const actorKind = user.role === "owner" ? "owner" : "staff";

  await db.from("delivery_event").insert([
    {
      delivery_id: delivery.id,
      shop_id: user.shop.id,
      type: "created",
      actor_kind: actorKind,
      actor_user_id: user.id,
      payload: { order_ref: orderRef, promise_minutes: promiseMinutes },
    },
    {
      delivery_id: delivery.id,
      shop_id: user.shop.id,
      type: "sent_out",
      actor_kind: actorKind,
      actor_user_id: user.id,
      payload: { driver: driver.full_name, due_at: dueAt.toISOString() },
    },
  ]);

  const origin =
    process.env.NEXT_PUBLIC_APP_ORIGIN ?? new URL(request.url).origin;
  const url = deliveryUrl(token, origin);

  return NextResponse.json({
    id: delivery.id,
    url,
    phone,
    customerName: customer.name,
    message: shareMessage({
      shopName: user.shop.branch
        ? `${user.shop.name}, ${user.shop.branch}`
        : user.shop.name,
      orderRef,
      driverName: driver.full_name,
      promiseMinutes,
      url,
    }),
  });
}
