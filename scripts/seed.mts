/**
 * Seeds one shop with a realistic day behind it.
 *
 * Run with: npm run seed
 *
 * Not idempotent, and deliberately so. delivery and delivery_event cannot be
 * deleted through any application path, so a second run would stack a second
 * day on top of the first rather than replacing it. If you need a clean
 * slate, run supabase/dev_reset.sql in the SQL Editor first -- that needs
 * database-owner access, which is the point.
 */

import { mintCode, mintToken } from "../src/server/codes";
import { serviceClient } from "../src/server/supabase";

const db = serviceClient();

// Never hard-coded. The repository is public; a password in it is a
// password anyone can use against the deployed app, because the Supabase
// URL and public key are necessarily in the browser bundle.
const DEV_PASSWORD = process.env.SEED_PASSWORD;
if (!DEV_PASSWORD) {
  console.error(
    "\n  SEED_PASSWORD is not set. Put one in .env -- it is the password " +
      "every seeded account shares.\n",
  );
  process.exit(1);
}

const MINUTE = 60_000;
const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * MINUTE).toISOString();
const after = (iso: string, minutes: number) =>
  new Date(Date.parse(iso) + minutes * MINUTE).toISOString();

function die(where: string, error: { message: string } | null): void {
  if (!error) return;
  console.error(`\n  failed at ${where}:\n  ${error.message}\n`);
  process.exit(1);
}

// --------------------------------------------------------------- guard rail

const { data: existing } = await db.from("shop").select("id, name").limit(1);
if (existing?.length) {
  console.error(
    `\n  "${existing[0].name}" is already seeded.\n` +
      `  Run supabase/dev_reset.sql in the Supabase SQL Editor first.\n`,
  );
  process.exit(1);
}

// --------------------------------------------------------------------- shop

const { data: shop, error: shopErr } = await db
  .from("shop")
  .insert({
    name: "Fiyavathi Mart",
    branch: "Maafannu",
    timezone: "Indian/Maldives",
    default_promise_minutes: 30,
  })
  .select()
  .single();
die("creating the shop", shopErr);
const shopId = shop!.id as string;

// -------------------------------------------------------------------- users

type SeedUser = {
  email: string;
  name: string;
  role: "owner" | "staff" | "driver";
};

const PEOPLE: SeedUser[] = [
  { email: "owner@taslaafa.mv", name: "Ibrahim Nasheed", role: "owner" },
  { email: "reem@taslaafa.mv", name: "Aishath Reem", role: "staff" },
  { email: "shifau@taslaafa.mv", name: "Mohamed Shifau", role: "staff" },
  { email: "hassan@taslaafa.mv", name: "Hassan Rasheed", role: "driver" },
  { email: "ali@taslaafa.mv", name: "Ali Waheed", role: "driver" },
];

const userIds: Record<string, string> = {};

for (const person of PEOPLE) {
  const { data: created, error } = await db.auth.admin.createUser({
    email: person.email,
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  die(`creating the login for ${person.email}`, error);

  const id = created!.user!.id;
  userIds[person.email] = id;

  const { error: rowErr } = await db.from("app_user").insert({
    id,
    shop_id: shopId,
    role: person.role,
    full_name: person.name,
  });
  die(`creating the app_user row for ${person.email}`, rowErr);
}

const reem = userIds["reem@taslaafa.mv"];
const shifau = userIds["shifau@taslaafa.mv"];
const hassan = userIds["hassan@taslaafa.mv"];
const ali = userIds["ali@taslaafa.mv"];

// ---------------------------------------------------------------- customers

// House names, not street numbers. That is how addresses work here.
const CUSTOMERS = [
  {
    name: "Aminath Shifa",
    phone: "+9607712233",
    address: "Rihiveli, Majeedhee Magu",
  },
  {
    name: "Hussain Latheef",
    phone: "+9607789012",
    address: "Blue Villa, Chaandhanee Magu",
  },
  {
    name: "Fathimath Nazima",
    phone: "+9609912345",
    address: "Sea Breeze, Ameenee Magu",
  },
  {
    name: "Ahmed Zahir",
    phone: "+9607745566",
    address: "Hikifinolhu, Buruzu Magu",
  },
  {
    name: "Mariyam Saeeda",
    phone: "+9609923344",
    address: "Fehi Villa, Orchid Magu",
  },
  {
    name: "Ismail Rasheed",
    phone: "+9607766778",
    address: "Night Star, Sosun Magu",
  },
];

const { data: customers, error: custErr } = await db
  .from("customer")
  .insert(CUSTOMERS.map((c) => ({ ...c, shop_id: shopId })))
  .select();
die("creating customers", custErr);

const customerId = (name: string) =>
  customers!.find((c) => c.name === name)!.id as string;

// --------------------------------------------------------------- deliveries

type EventType =
  | "created"
  | "sent_out"
  | "link_opened"
  | "code_attempted"
  | "code_confirmed"
  | "marked_late"
  | "problem_reported";

type EventSpec = {
  type: EventType;
  actorKind: "owner" | "staff" | "driver" | "customer" | "system";
  actorId?: string;
  at: string;
  payload?: Record<string, unknown>;
};

type DeliverySpec = {
  label: string;
  customer: string;
  orderRef: string;
  promiseMinutes: 15 | 30 | 45 | 60;
  driverId: string;
  createdBy: string;
  sentMinutesAgo: number;
  /** minutes after sent_at, if it was confirmed at all */
  confirmedAfter?: number;
  attempts?: number;
  locked?: boolean;
  linkOpenedAfter?: number;
  markedLate?: boolean;
};

const SPECS: DeliverySpec[] = [
  {
    label: "confirmed, beat the promise",
    customer: "Aminath Shifa",
    orderRef: "A-1041",
    promiseMinutes: 30,
    driverId: hassan,
    createdBy: reem,
    sentMinutesAgo: 95,
    linkOpenedAfter: 2,
    confirmedAfter: 18,
  },
  {
    label: "confirmed, but late",
    customer: "Hussain Latheef",
    orderRef: "A-1042",
    promiseMinutes: 30,
    driverId: ali,
    createdBy: shifau,
    sentMinutesAgo: 180,
    linkOpenedAfter: 4,
    markedLate: true,
    confirmedAfter: 47,
  },
  {
    label: "out now, inside the promise",
    customer: "Fathimath Nazima",
    orderRef: "A-1043",
    promiseMinutes: 30,
    driverId: hassan,
    createdBy: reem,
    sentMinutesAgo: 8,
    linkOpenedAfter: 1,
  },
  {
    label: "running late",
    customer: "Ahmed Zahir",
    orderRef: "A-1044",
    promiseMinutes: 30,
    driverId: ali,
    createdBy: reem,
    sentMinutesAgo: 55,
    linkOpenedAfter: 3,
    markedLate: true,
  },
  {
    label: "code locked after three wrong attempts",
    customer: "Mariyam Saeeda",
    orderRef: "A-1045",
    promiseMinutes: 45,
    driverId: hassan,
    createdBy: shifau,
    sentMinutesAgo: 40,
    linkOpenedAfter: 2,
    attempts: 3,
    locked: true,
  },
  {
    label: "link never opened, not yet late",
    customer: "Ismail Rasheed",
    orderRef: "A-1046",
    promiseMinutes: 60,
    driverId: ali,
    createdBy: reem,
    sentMinutesAgo: 25,
  },
];

for (const spec of SPECS) {
  // The order is taken a few minutes before it leaves the shop.
  const createdAt = ago(spec.sentMinutesAgo + 3);
  const sentAt = ago(spec.sentMinutesAgo);
  const dueAt = after(sentAt, spec.promiseMinutes);
  const confirmedAt =
    spec.confirmedAfter === undefined
      ? null
      : after(sentAt, spec.confirmedAfter);

  const { data: delivery, error: delErr } = await db
    .from("delivery")
    .insert({
      shop_id: shopId,
      customer_id: customerId(spec.customer),
      order_ref: spec.orderRef,
      promise_minutes: spec.promiseMinutes,
      driver_id: spec.driverId,
      created_by: spec.createdBy,
      public_token: mintToken(),
      created_at: createdAt,
      sent_at: sentAt,
      due_at: dueAt,
      confirmed_at: confirmedAt,
      confirmed_by: confirmedAt ? spec.driverId : null,
    })
    .select()
    .single();
  die(`creating delivery ${spec.orderRef}`, delErr);

  const deliveryId = delivery!.id as string;

  const { codeHash, codeCt } = mintCode();
  const { error: codeErr } = await db.from("delivery_code").insert({
    delivery_id: deliveryId,
    code_hash: codeHash,
    code_ct: codeCt,
    attempts: spec.locked ? 3 : spec.confirmedAfter !== undefined ? 1 : 0,
    locked: spec.locked ?? false,
  });
  die(`creating the code for ${spec.orderRef}`, codeErr);

  const events: EventSpec[] = [
    {
      type: "created",
      actorKind: "staff",
      actorId: spec.createdBy,
      at: createdAt,
    },
    {
      type: "sent_out",
      actorKind: "staff",
      actorId: spec.createdBy,
      at: sentAt,
    },
  ];

  if (spec.linkOpenedAfter !== undefined) {
    events.push({
      type: "link_opened",
      actorKind: "customer",
      at: after(sentAt, spec.linkOpenedAfter),
    });
  }

  if (spec.markedLate) {
    events.push({
      type: "marked_late",
      actorKind: "system",
      at: after(dueAt, 1),
      payload: { due_at: dueAt, minutes_over: 1 },
    });
  }

  if (spec.attempts) {
    for (let n = 1; n <= spec.attempts; n++) {
      events.push({
        type: "code_attempted",
        actorKind: "driver",
        actorId: spec.driverId,
        at: after(sentAt, 20 + n),
        payload: {
          ok: false,
          attempt: n,
          locked: n === spec.attempts && !!spec.locked,
        },
      });
    }
  }

  if (confirmedAt) {
    const seconds = spec.confirmedAfter! * 60;
    const beat = Date.parse(confirmedAt) <= Date.parse(dueAt);
    events.push({
      type: "code_attempted",
      actorKind: "driver",
      actorId: spec.driverId,
      at: confirmedAt,
      payload: { ok: true, attempt: 1, locked: false },
    });
    events.push({
      type: "code_confirmed",
      actorKind: "driver",
      actorId: spec.driverId,
      at: confirmedAt,
      payload: { attempt: 1, seconds_to_door: seconds, beat_promise: beat },
    });
  }

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const { error: evErr } = await db.from("delivery_event").insert(
    events.map((e) => ({
      delivery_id: deliveryId,
      shop_id: shopId,
      type: e.type,
      actor_kind: e.actorKind,
      actor_user_id: e.actorId ?? null,
      payload: e.payload ?? {},
      created_at: e.at,
    })),
  );
  die(`writing the log for ${spec.orderRef}`, evErr);

  console.log(`  ${spec.orderRef}  ${spec.label}`);
}

console.log(`
  Seeded "Fiyavathi Mart, Maafannu" with ${SPECS.length} deliveries.

  Sign in with any of these. Password for all: ${DEV_PASSWORD}

    owner    owner@taslaafa.mv     Ibrahim Nasheed
    staff    reem@taslaafa.mv      Aishath Reem
    staff    shifau@taslaafa.mv    Mohamed Shifau
    driver   hassan@taslaafa.mv    Hassan Rasheed
    driver   ali@taslaafa.mv       Ali Waheed
`);
