# Taslaafa

Proof of delivery for shops in the Maldives that deliver their own orders.

The shop sends a link into the Viber or WhatsApp thread the order came in on.
Behind that link is a 4-digit code only the customer can see. The delivery is
not confirmed until the driver types that code at the door. Every step is
timestamped and permanent.

Taslaafa does not deliver anything and is not a marketplace.

## Status

Schema and plan only. See [docs/PLAN.md](docs/PLAN.md).

## Two rules

1. `delivery_event` is append-only, enforced by database triggers that
   `service_role` cannot bypass. Corrections are new rows.
2. Nobody at the shop can read a delivery code. The key that verifies and
   decrypts codes lives in the app environment and never enters the database.

Both are covered by tests in `tests/guards/`, which are built to be awkward to
delete by accident.

## Setup

```bash
cp .env.example .env    # then fill it in
npm install
supabase db reset       # applies supabase/migrations/
npm run seed
npm run dev
```
