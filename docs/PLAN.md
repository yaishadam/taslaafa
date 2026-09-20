# Taslaafa — build plan

Status: **built.** Every screen in the brief exists and has been walked
through in a browser against the real database. Sections 1 to 6 describe
what was planned; section 7 what was decided at review; section 8 what is
still open.

## 1. Shape of the thing

One Next.js app, App Router, three authenticated surfaces (shop phone, driver
phone, owner desktop) and one public page. Supabase for Postgres + auth + RLS.
Deployed to Vercel, database in Singapore.

```
src/
  app/
    (shop)/today, /new, /delivery/[id]          phone width
    (driver)/drops, /drops/[id]/code            phone width
    (owner)/dashboard                           desktop
    d/[token]/                                  public, no auth
    api/
      deliveries/route.ts                       POST create + send
      deliveries/[id]/confirm/route.ts          POST code attempt
      deliveries/[id]/problem/route.ts          POST from the public page
      board/route.ts                            GET live board, sweeps late
      cron/late/route.ts                        GET, Vercel cron
  server/
    codes.ts        the ONLY module that can mint, verify or reveal a code
    supabase.ts     anon client (reads, RLS) + service client (writes)
    events.ts       typed event writers
    time.ts         UTC in, +05 out
    phone.ts        7 digits -> +960 E.164
  ui/               design-system primitives, Logo.tsx
tests/guards/       the two rules, plus the tripwire that protects them
supabase/migrations/
scripts/seed.ts
```

## 2. The two rules

### Append-only `delivery_event`

RLS is not the mechanism. `service_role` has `BYPASSRLS` and every write in this
app goes through it, so a policy would be theatre. Three things instead:

1. `BEFORE UPDATE / DELETE / TRUNCATE` triggers that raise `42501`. Triggers are
   not bypassed by `BYPASSRLS`.
2. `REVOKE UPDATE, DELETE, TRUNCATE ... FROM service_role`.
3. `delivery` itself is undeletable by the same means — a deleted delivery would
   take its proof with it.

Honest limit: a superuser at `psql` can always `ALTER TABLE ... DISABLE TRIGGER`.
What this guarantees is that **no application path can mutate the log**, which is
the threat that matters. Corrections are new rows.

### Nobody at the shop can read a code

The code must be verifiable by the driver's phone *and* displayable on the
customer's page, so a one-way hash alone is not sufficient. Design:

- `TASLAAFA_CODE_KEY` (32 random bytes) lives in the app environment, **never in
  the database**. HKDF derives a `mac` subkey and an `enc` subkey.
- `delivery_code.code_hash` = HMAC-SHA256(mac, code) — used to verify attempts.
- `delivery_code.code_ct` = AES-256-GCM(enc, code) — decrypted only when
  rendering `/d/[token]`.

Consequences worth stating: a full database dump reveals no code and cannot
brute-force one, even though there are only 10,000 possibilities, because the
key is absent. And `delivery_code` is granted to no Postgres role but
`service_role`, with RLS enabled and **zero policies**, so a stray `select *`
from an authenticated client returns nothing even if someone adds a grant later.

In the app layer, `src/server/codes.ts` is the only module that touches the
table. `revealCode()` is importable by exactly one file. `mintCode()` returns the
plaintext once, to the caller that immediately puts it in the share message.

### The tests, and making them awkward to delete

`tests/guards/` holds three files:

- `no-code-in-authenticated-responses.test.ts` — seeds a delivery with a known
  code, signs in as owner, staff and driver in turn, walks **every** route under
  `src/app/api/**` that is not under `/api/public`, and deep-scans each response
  body for the plaintext. Plus a static pass asserting no file outside the
  allowlist imports `revealCode`.
- `delivery-event-append-only.test.ts` — as `service_role`, attempts UPDATE,
  DELETE and TRUNCATE on a real event row and asserts all three raise `42501`.
- `guards-intact.test.ts` — reads `GUARDS.lock.json` (sha256 per guard file) and
  asserts each file is present, unmodified, and that the lock lists exactly the
  files in the directory.

Each of the first two also asserts `guards-intact.test.ts` exists. Deleting any
one guard fails another; weakening one changes its hash and fails the third.
Removing the protection means deleting all three in a single visible diff.
Backed by a `guards` CI job and a CODEOWNERS entry on the directory.

## 3. Schema

Written: `supabase/migrations/0001_schema.sql`, `0002_append_only_and_grants.sql`,
`0003_functions.sql`. Points that are decisions rather than transcription:

- **`app_user.id` *is* the `auth.users` id.** One identity, one shop, one role.
- **`delivery.due_at` is a stored column, not generated.** `timestamptz +
  interval` is `STABLE`, not `IMMUTABLE`, so Postgres refuses a stored generated
  column. It is written at send time and indexed for the late sweep.
- **Authenticated clients are read-only.** RLS governs reads; every write goes
  through a server route that checks the session then uses `service_role`. One
  reviewable write surface instead of a policy matrix, and it is what makes rule
  2 checkable by a test.
- **Drivers are scoped by policy, not by query.** `delivery`, `customer` and
  `delivery_event` policies all narrow to `driver_id = auth.uid()` for the driver
  role. Forgetting a `.eq('driver_id', ...)` in a query leaks nothing.
- **A partial unique index gives `link_opened` its "once" guarantee** rather than
  a read-then-write check in the route handler. Same trick for `marked_late`.
- **`attempt_code()` is one transaction** that locks the code row, compares,
  increments, locks at 3, and writes the event. Two taps on a slow connection
  cannot double-count an attempt or confirm twice.
- Phone stored as `+960` + 7 digits, enforced by a check constraint.

## 4. Lateness

`sent_at + promise_minutes` is `due_at`. `sweep_late()` writes one durable
`marked_late` event per delivery.

Vercel's Hobby tier caps cron at once per day, which is useless here, so the
sweep is called from two places: the cron route (for quiet shops with nobody
looking at a screen) and the `/api/board` poll endpoint that the Today view and
the dashboard hit every 10 seconds. It is idempotent, so double-calling is free.
No websockets.

## 5. Build order

All done, in this order, one or two commits each.

1. ~~Scaffold, Tailwind tokens, `Logo.tsx`, design primitives.~~
2. ~~Migrations + seed + the two guard tests.~~
3. ~~Auth: sign-in, session, role routing.~~
4. ~~**Spine:** new delivery -> mint code -> share sheet -> `/d/[token]` ->
   keypad -> `attempt_code` -> confirmed.~~
5. ~~Proof screen.~~
6. ~~Today view + late flags + the sweep.~~
7. ~~Owner dashboard.~~

The guards grew a third file along the way. `code-unreachable.test.ts`
walks the import graph and proves no route, page or layout can reach the
module that decrypts a code, at any depth. That is the "no authenticated
API route can return it" requirement, answered more strongly than a
response scan would and without needing a live server.

## 6. Assumptions I am making unless told otherwise

- Sign-in is email + password. Drivers may not have working email, so magic
  links are a poor fit.
- "Send out & share the link" is one action: `created` and `sent_out` are written
  back to back, and `sent_at` is set immediately. A save-without-sending draft
  state can come later; the timeline already supports the two steps being apart.
- Only the **assigned driver** can enter a code. Not staff, not the owner.
- The share sheet uses `navigator.share()` where available, with explicit Viber
  and WhatsApp buttons as the fallback.

## 7. Decisions from review (2026-09-21)

**Distance is gone.** Driver cards show customer, address, status — no geo
anything. Timing data (elapsed, door-to-door duration, beat-the-promise) is a
*shop-side* concern: it belongs on the proof screen, the Today counters and the
dashboard, and is **not shown to the customer**. `/d/[token]` shows the arrival
estimate it was promised and the status timeline, with no running clock and no
duration.

**A locked code is reissued by the owner.** Owner only, via
`/api/deliveries/[id]/reissue` -> `reissue_code()`. The public token is
unchanged, so the customer's existing link starts showing the new digits. The
old code's three failures stay in the log; `code_reissued` is added to it, never
a reset of it. Staff and drivers cannot reissue.

**A delivery "needs a look" when any of:** it is running late, its code is
locked, or its link was never opened. Drives the Problems filter, the header
alert dot and the dashboard's fourth stat card, all from one predicate. A
customer-reported problem is deliberately *not* in this set (see below).

**Report a problem** is preset reasons plus an optional note. Reasons, unless
you want different words: Hasn't arrived / Wrong items / Wrong address / Driver
asked for the code over the phone. Stored as
`payload: { reason, note }` on a `problem_reported` event.

## 8. Still open

1. **Does the driver see timing?** You said time is for the shop manager, not
   the customer — but the spec puts "time taken and on-time status" on the
   driver's success state after a correct code. Keeping it there unless you say
   otherwise; it is the moment it means something to him.
2. **"Link never opened" needs a number.** Using **sent more than 10 minutes ago
   and still unopened** until told another figure.
3. **Customer-reported problems.** Not selected as a "problem", so as it stands a
   report lands in the timeline and the proof screen but does not light the
   alert dot. Flagging in case that was not deliberate — it is the one signal
   that comes from outside the shop.
