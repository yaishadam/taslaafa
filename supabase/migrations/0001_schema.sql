-- Taslaafa 0001: core schema
-- All timestamps are timestamptz, stored UTC. Rendering in +05 is a client concern.

create extension if not exists pgcrypto;

create type public.user_role as enum ('owner', 'staff', 'driver');

create type public.event_type as enum (
  'created',          -- order taken at the shop
  'sent_out',         -- left the shop
  'link_opened',      -- customer opened /d/[token] (written once)
  'code_attempted',   -- driver typed a code; payload.ok true/false
  'code_confirmed',   -- handed over
  'marked_late',      -- swept past sent_at + promise_minutes
  'problem_reported', -- customer tapped "Report a problem": preset reason + optional note
  'code_reissued'     -- owner minted a fresh code after a lock
);

create type public.actor_kind as enum ('owner', 'staff', 'driver', 'customer', 'system');


-- ---------------------------------------------------------------- shop
create table public.shop (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (length(btrim(name)) > 0),
  branch                  text,
  timezone                text not null default 'Indian/Maldives',
  default_promise_minutes smallint not null default 30
                            check (default_promise_minutes in (15, 30, 45, 60)),
  created_at              timestamptz not null default now()
);


-- ------------------------------------------------------------ app_user
-- PK is the Supabase auth user id: one auth identity, one shop, one role.
create table public.app_user (
  id         uuid primary key references auth.users (id) on delete cascade,
  shop_id    uuid not null references public.shop (id) on delete restrict,
  role       public.user_role not null,
  full_name  text not null check (length(btrim(full_name)) > 0),
  phone      text check (phone ~ '^\+960[0-9]{7}$'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index app_user_shop_idx on public.app_user (shop_id) where is_active;


-- ------------------------------------------------------------ customer
-- Addresses here are house names, not street numbers. Free text, never parsed.
create table public.customer (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shop (id) on delete restrict,
  name       text not null check (length(btrim(name)) > 0),
  phone      text not null check (phone ~ '^\+960[0-9]{7}$'),
  address    text not null check (length(btrim(address)) > 0),
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create index customer_shop_name_idx on public.customer (shop_id, lower(name));


-- ------------------------------------------------------------ delivery
create table public.delivery (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shop (id) on delete restrict,
  customer_id     uuid not null references public.customer (id) on delete restrict,
  order_ref       text,
  promise_minutes smallint not null check (promise_minutes in (15, 30, 45, 60)),
  driver_id       uuid references public.app_user (id) on delete restrict,
  created_by      uuid references public.app_user (id) on delete restrict,
  public_token    text not null unique check (public_token ~ '^[A-Za-z0-9_-]{22,64}$'),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  -- Written at send time. Not a generated column: timestamptz + interval is
  -- STABLE, not IMMUTABLE, so Postgres will not store it for us.
  due_at          timestamptz,
  confirmed_at    timestamptz,
  confirmed_by    uuid references public.app_user (id) on delete restrict,
  constraint delivery_due_with_sent check ((sent_at is null) = (due_at is null)),
  constraint delivery_confirmed_after_sent check (confirmed_at is null or sent_at is not null)
);

create index delivery_board_idx on public.delivery (shop_id, created_at desc);
create index delivery_open_idx  on public.delivery (shop_id, due_at)
  where confirmed_at is null and sent_at is not null;
create index delivery_driver_idx on public.delivery (driver_id, created_at desc);


-- ------------------------------------------------------- delivery_code
-- Rule 2: nobody at the shop can read a code.
--   code_hash = HMAC-SHA256(mac_key, code)     -> used to verify an attempt
--   code_ct   = AES-256-GCM(enc_key, code)     -> decrypted ONLY by /d/[token]
-- Both keys are HKDF-derived from TASLAAFA_CODE_KEY, which lives in the app
-- environment and never enters the database. A full DB dump therefore reveals
-- no code and cannot brute-force one, despite there being only 10,000.
create table public.delivery_code (
  delivery_id uuid primary key references public.delivery (id) on delete restrict,
  code_hash   text not null,
  code_ct     text not null,
  key_version smallint not null default 1,
  attempts    smallint not null default 0 check (attempts between 0 and 3),
  locked      boolean not null default false,
  reissues    smallint not null default 0,
  created_at  timestamptz not null default now()
);


-- ------------------------------------------------------ delivery_event
-- Rule 1: append-only. See 0002 for the enforcement.
create table public.delivery_event (
  id            bigint generated always as identity primary key,
  delivery_id   uuid not null references public.delivery (id) on delete restrict,
  shop_id       uuid not null references public.shop (id) on delete restrict,
  type          public.event_type not null,
  actor_kind    public.actor_kind not null,
  actor_user_id uuid references public.app_user (id) on delete restrict,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  -- a staff/driver/owner event must name its actor; customer and system never do
  constraint delivery_event_actor_shape check (
    (actor_kind in ('owner', 'staff', 'driver')) = (actor_user_id is not null)
  )
);

create index delivery_event_timeline_idx on public.delivery_event (delivery_id, created_at, id);
create index delivery_event_shop_idx     on public.delivery_event (shop_id, created_at desc);

-- One link_opened per delivery, enforced by the database rather than by a check
-- in the route handler.
create unique index delivery_event_one_open_idx
  on public.delivery_event (delivery_id)
  where type = 'link_opened';
