import { existsSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { serviceClient, signedInAs } from "./supabase-clients";

/**
 * RULE 1: delivery_event is append-only.
 *
 * If a shop owner can edit a delivery record, the product is worthless -- the
 * whole proposition is that the log is not a story anyone can retell. So this
 * is tested against a real Postgres, as the most privileged client the
 * application ever holds.
 *
 * service_role has BYPASSRLS, which is exactly why policies are not the
 * mechanism here. Triggers are. A trigger does not care what role you are.
 *
 * Honest limit: a superuser at psql can ALTER TABLE ... DISABLE TRIGGER, as
 * supabase/dev_reset.sql does. What is proven below is that no application
 * path can rewrite history, which is the threat that matters.
 */

const db = serviceClient();

/**
 * A write to the log is refused by one of two independent layers:
 *
 *   "permission denied"  the REVOKE in 0002. Fires first, so this is what is
 *                        normally seen.
 *   "append-only"        the trigger. The one that matters, because it is the
 *                        layer a future migration cannot accidentally undo by
 *                        re-granting privileges -- something Supabase setup
 *                        snippets do freely.
 *
 * Asserting on either is honest about which is doing the work today, while
 * still failing loudly if a write ever succeeds.
 */
function expectRefused(error: { message: string } | null, what: string): void {
  expect(error, `${what} was NOT refused -- the log is writable`).not.toBeNull();
  expect(
    error!.message,
    `${what} failed for an unexpected reason: ${error!.message}`,
  ).toMatch(/append-only|permission denied/i);
}

let eventId: number;
let deliveryId: string;

beforeAll(async () => {
  const { data, error } = await db
    .from("delivery_event")
    .select("id, delivery_id")
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(
      `No delivery_event rows to test against (${error?.message ?? "empty"}). ` +
        `Run 'npm run seed' first.`,
    );
  }

  eventId = data.id as number;
  deliveryId = data.delivery_id as string;
});

describe("delivery_event cannot be rewritten", () => {
  it("refuses an UPDATE from service_role", async () => {
    const { error } = await db
      .from("delivery_event")
      .update({ type: "code_confirmed" })
      .eq("id", eventId);

    expectRefused(error, "UPDATE of a delivery_event type");
  });

  it("refuses an UPDATE to the payload, not just the type", async () => {
    const { error } = await db
      .from("delivery_event")
      .update({ payload: { tampered: true } })
      .eq("id", eventId);

    expectRefused(error, "UPDATE of a delivery_event payload");
  });

  it("refuses a DELETE from service_role", async () => {
    const { error } = await db.from("delivery_event").delete().eq("id", eventId);

    expectRefused(error, "DELETE of one delivery_event");
  });

  it("refuses a DELETE that matches every row", async () => {
    // The shape someone reaches for when they want the whole log gone.
    const { error } = await db
      .from("delivery_event")
      .delete()
      .gte("id", 0);

    expectRefused(error, "DELETE of the whole log");
  });

  it("leaves the row exactly as it was after all of that", async () => {
    const { data, error } = await db
      .from("delivery_event")
      .select("id, type, payload")
      .eq("id", eventId)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.payload).not.toHaveProperty("tampered");
  });

  it("still accepts an INSERT, because corrections are new rows", async () => {
    const { data: delivery } = await db
      .from("delivery")
      .select("shop_id")
      .eq("id", deliveryId)
      .single();

    const { error } = await db.from("delivery_event").insert({
      delivery_id: deliveryId,
      shop_id: delivery!.shop_id,
      type: "problem_reported",
      actor_kind: "customer",
      payload: { reason: "guard test", note: "written by append-only.test.ts" },
    });

    expect(error).toBeNull();
  });
});

describe("delivery cannot be deleted either", () => {
  it("refuses a DELETE, because it would take the proof with it", async () => {
    const { error } = await db.from("delivery").delete().eq("id", deliveryId);

    expectRefused(error, "DELETE of a delivery");
  });
});

describe("the shop's own clients cannot write to the log at all", () => {
  it.each(["owner", "staff", "driver"] as const)(
    "%s cannot INSERT an event",
    async (role) => {
      const client = await signedInAs(role);
      const { error } = await client.from("delivery_event").insert({
        delivery_id: deliveryId,
        shop_id: "00000000-0000-0000-0000-000000000000",
        type: "code_confirmed",
        actor_kind: "customer",
        payload: {},
      });

      expect(error).not.toBeNull();
    },
  );

  it.each(["owner", "staff", "driver"] as const)(
    "%s cannot UPDATE an event",
    async (role) => {
      const client = await signedInAs(role);
      const { error } = await client
        .from("delivery_event")
        .update({ payload: { tampered: true } })
        .eq("id", eventId);

      expect(error).not.toBeNull();
    },
  );

  it.each(["owner", "staff", "driver"] as const)(
    "%s cannot DELETE an event",
    async (role) => {
      const client = await signedInAs(role);
      const { error } = await client
        .from("delivery_event")
        .delete()
        .eq("id", eventId);

      expect(error).not.toBeNull();
    },
  );
});

describe("the guard set is intact", () => {
  // Mutual attestation: removing the tripwire has to be done deliberately,
  // in a diff that also touches this file.
  it("guards-intact.test.ts is still present", () => {
    expect(
      existsSync(path.resolve(import.meta.dirname, "guards-intact.test.ts")),
    ).toBe(true);
  });
});
