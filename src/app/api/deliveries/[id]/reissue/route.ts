import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { mintCode } from "@/server/codes";
import { reissueCode } from "@/server/deliveryCodes";
import { serviceClient } from "@/server/supabase";

/**
 * Issue a fresh code after three wrong tries locked the old one.
 *
 * Owner only. A driver who has just failed three times is the last person
 * who should be able to hand himself a new code, and staff at the counter
 * are not in a position to judge what went wrong at the door.
 *
 * This route mints and stores; it cannot read a code back, and neither can
 * the owner. The customer's link starts showing the new digits on their next
 * refresh.
 */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/deliveries/[id]/reissue">,
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can issue a new code" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const { data: delivery } = await serviceClient()
    .from("delivery")
    .select("id, shop_id")
    .eq("id", id)
    .maybeSingle();

  if (!delivery || delivery.shop_id !== user.shop.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { codeHash, codeCt } = mintCode();
  const { result, error } = await reissueCode(id, user.id, codeHash, codeCt);

  if (error) return NextResponse.json({ error }, { status: 500 });
  if (result === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result === "already_confirmed") {
    return NextResponse.json(
      { error: "This delivery is already confirmed" },
      { status: 409 },
    );
  }

  return NextResponse.json({ result });
}
