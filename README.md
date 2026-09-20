# Taslaafa

Proof of delivery for shops in the Maldives that deliver their own orders.

The shop sends a link into the Viber or WhatsApp thread the order came in on.
Behind that link is a 4-digit code only the customer can see. The delivery is
not confirmed until the driver types that code at the door. Every step is
timestamped and permanent.

Taslaafa does not deliver anything and is not a marketplace.

## Status

All seven screens are built and working against a real database. See
[docs/PLAN.md](docs/PLAN.md) for what was decided and what is still open.

| Surface | Screens |
| --- | --- |
| Shop, phone | Today, New delivery, Delivery proof, Proof log |
| Driver, phone | My drops, Enter the code |
| Customer, public | `/d/[token]` |
| Owner, desktop | Dashboard, Proof log, Riders, Settings |

Not built, by instruction: signup and onboarding, editable settings,
payments, maps or distance, offline support, dark mode, customer accounts.

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
