import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mintCode } from "@/server/codes";
import { anonClient, serviceClient, signedInAs } from "./supabase-clients";

/**
 * RULE 2: nobody at the shop can read a code.
 *
 * Not the driver who is about to be told it at the door, not the staff member
 * who created the delivery, not the owner. The code exists so that possession
 * of it proves the customer was there; a shop that can read it can confirm a
 * delivery it never made.
 *
 * Three layers are checked here, weakest last:
 *
 *  1. The database refuses. delivery_code is granted to no role and has RLS
 *     enabled with zero policies, so there is no query that reaches it.
 *  2. Nothing a signed-in client CAN read contains a plaintext code -- in
 *     particular no event payload, which is the easy place to leak one.
 *  3. Source-level: revealCode has an allowlist of importers, and no route
 *     outside the public customer page touches the code columns.
 *
 * Layer 3 is static analysis, which is a proxy for "no authenticated API
 * route can return it". Once the API routes exist, the right addition is to
 * call each one and scan its response body. Until then the allowlist is what
 * holds, and it fails closed: a new importer breaks the build.
 */

const SRC = path.resolve(import.meta.dirname, "..", "..", "src");

/** The only files permitted to turn a stored code back into digits. */
const REVEAL_ALLOWLIST = ["app/d/[token]/page.tsx", "server/codes.ts"];

/** The only files permitted to touch the delivery_code table at all. */
const CODE_TABLE_ALLOWLIST = [
  "app/d/[token]/page.tsx",
  "server/deliveryCodes.ts",
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Comments describe the rules; they should not trip the checks that enforce
 * them. codes.ts documents the code_ct column in its header and would
 * otherwise flag itself.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function sourceFiles(): { rel: string; text: string }[] {
  return walk(SRC)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => ({
      rel: path.relative(SRC, f).split(path.sep).join("/"),
      text: stripComments(readFileSync(f, "utf8")),
    }));
}

/** Every string in a nested structure, however deeply buried. */
function deepStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) value.forEach((v) => deepStrings(v, into));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => deepStrings(v, into));
  }
  return into;
}

describe("the database refuses to hand over a code", () => {
  it("anon cannot read delivery_code", async () => {
    const { data, error } = await anonClient().from("delivery_code").select("*");
    expect(error ?? { message: "" }).toBeTruthy();
    expect(data ?? []).toHaveLength(0);
  });

  it.each(["owner", "staff", "driver"] as const)(
    "%s cannot read delivery_code",
    async (role) => {
      const client = await signedInAs(role);
      const { data, error } = await client.from("delivery_code").select("*");

      // Either a hard permission error or zero rows. Both mean nothing leaked.
      if (!error) expect(data ?? []).toHaveLength(0);
      expect(data ?? []).toHaveLength(0);
    },
  );

  it.each(["owner", "staff", "driver"] as const)(
    "%s cannot reach a code by embedding it in a delivery query",
    async (role) => {
      const client = await signedInAs(role);
      const { data, error } = await client
        .from("delivery")
        .select("id, delivery_code(code_hash, code_ct)")
        .limit(5);

      if (!error) {
        const codes = deepStrings(data).filter((s) => s.length > 20);
        expect(codes).toHaveLength(0);
      }
    },
  );
});

describe("nothing readable contains a plaintext code", () => {
  it("no value a signed-in client can select equals a real code", async () => {
    const db = serviceClient();

    // One fixture row, reused forever, with a fresh code rotated into it on
    // every run.
    //
    // It has to be reused rather than recreated because a delivery cannot be
    // deleted through any application path -- that is rule 1 working. A test
    // that inserted one per run would pile undeletable junk into the board
    // until someone ran dev_reset.sql.
    //
    // Dated 2020 and already confirmed so it stays off Today and off the
    // open list. It is still a real row and will appear in the proof log,
    // which is honest: it is a delivery that happened to a test.
    const FIXTURE_REF = "GUARD-FIXTURE";
    const FIXTURE_TOKEN = "guardfixture0000000000";

    const { data: shop } = await db.from("shop").select("id").limit(1).single();
    const { data: customer } = await db
      .from("customer")
      .select("id")
      .limit(1)
      .single();
    const { data: driver } = await db
      .from("app_user")
      .select("id")
      .eq("role", "driver")
      .limit(1)
      .single();

    const { code, codeHash, codeCt } = mintCode();

    const { data: found } = await db
      .from("delivery")
      .select("id")
      .eq("public_token", FIXTURE_TOKEN)
      .maybeSingle();

    let deliveryId = found?.id as string | undefined;

    if (!deliveryId) {
      const long_ago = "2020-01-01T00:00:00Z";
      const { data: created, error: delErr } = await db
        .from("delivery")
        .insert({
          shop_id: shop!.id,
          customer_id: customer!.id,
          promise_minutes: 30,
          driver_id: driver!.id,
          order_ref: FIXTURE_REF,
          public_token: FIXTURE_TOKEN,
          created_at: long_ago,
          sent_at: long_ago,
          due_at: "2020-01-01T00:30:00Z",
          confirmed_at: "2020-01-01T00:10:00Z",
          confirmed_by: driver!.id,
        })
        .select()
        .single();
      expect(delErr).toBeNull();
      deliveryId = created!.id as string;

      await db.from("delivery_code").insert({
        delivery_id: deliveryId,
        code_hash: codeHash,
        code_ct: codeCt,
      });

      await db.from("delivery_event").insert({
        delivery_id: deliveryId,
        shop_id: shop!.id,
        type: "created",
        actor_kind: "staff",
        actor_user_id: driver!.id,
        payload: { order_ref: FIXTURE_REF },
      });
    } else {
      // delivery_code is not append-only -- only the log is -- so the code
      // can be rotated in place without leaving a trail of rows.
      const { error } = await db
        .from("delivery_code")
        .update({ code_hash: codeHash, code_ct: codeCt })
        .eq("delivery_id", deliveryId);
      expect(error).toBeNull();
    }

    const READABLE = [
      "shop",
      "app_user",
      "customer",
      "delivery",
      "delivery_event",
    ] as const;

    for (const role of ["owner", "staff", "driver"] as const) {
      const client = await signedInAs(role);

      for (const table of READABLE) {
        const { data } = await client.from(table).select("*");
        const strings = deepStrings(data ?? []);

        expect(
          strings,
          `${role} found the plaintext code in ${table}`,
        ).not.toContain(code);
      }
    }
  });
});

describe("the source itself", () => {
  it("revealCode is imported only by the files allowed to show a code", () => {
    const importers = sourceFiles()
      .filter(
        ({ rel, text }) =>
          /\brevealCode\b/.test(text) && rel !== "server/codes.ts",
      )
      .map(({ rel }) => rel);

    const unexpected = importers.filter((f) => !REVEAL_ALLOWLIST.includes(f));

    expect(
      unexpected,
      `revealCode reached a file that must never show a code. ` +
        `If this is deliberate, the allowlist in this test is the place to ` +
        `argue for it -- and the argument has to be that the file serves the ` +
        `customer, not the shop.`,
    ).toEqual([]);
  });

  it("only the public customer page touches the delivery_code table", () => {
    const touchers = sourceFiles()
      .filter(({ text }) => /["'`]delivery_code["'`]|\bcode_ct\b/.test(text))
      .map(({ rel }) => rel);

    const unexpected = touchers.filter(
      (f) => !CODE_TABLE_ALLOWLIST.includes(f),
    );

    expect(unexpected).toEqual([]);
  });

  it("no API route outside the public one reads a code", () => {
    const routes = sourceFiles().filter(
      ({ rel }) => rel.startsWith("app/api/") && rel.endsWith("route.ts"),
    );

    const leaking = routes
      .filter(({ text }) => /\brevealCode\b|\bcode_ct\b/.test(text))
      .map(({ rel }) => rel);

    expect(leaking).toEqual([]);
  });

  it("no code is ever written into a log line", () => {
    // console.log(code) would put a plaintext code in Vercel's log drain,
    // which is readable by everyone at the shop with dashboard access.
    const logging = sourceFiles()
      .filter(({ text }) =>
        /console\.(log|info|warn|error|debug)\([^)]*\bcode\b(?!Hash|Ct|_hash|_ct)/.test(
          text,
        ),
      )
      .map(({ rel }) => rel);

    expect(logging).toEqual([]);
  });
});

describe("the guard set is intact", () => {
  it("guards-intact.test.ts is still present", () => {
    expect(
      existsSync(path.resolve(import.meta.dirname, "guards-intact.test.ts")),
    ).toBe(true);
  });
});
