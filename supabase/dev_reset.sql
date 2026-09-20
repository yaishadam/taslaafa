-- DEVELOPMENT ONLY. Never run this against a shop's real data.
--
-- The whole point of this product is that the delivery log cannot be erased,
-- so wiping it deliberately takes more than a DELETE: the append-only
-- triggers have to be switched off first, which needs database-owner access.
-- An application key cannot do this, and that is the design working.
--
-- Run in the Supabase SQL Editor, then re-run `npm run seed`.

begin;

alter table public.delivery_event disable trigger delivery_event_no_update;
alter table public.delivery_event disable trigger delivery_event_no_delete;
alter table public.delivery_event disable trigger delivery_event_no_truncate;
alter table public.delivery        disable trigger delivery_no_delete;
alter table public.delivery        disable trigger delivery_no_truncate;

truncate
  public.delivery_event,
  public.delivery_code,
  public.delivery,
  public.customer,
  public.app_user,
  public.shop
cascade;

alter table public.delivery_event enable trigger delivery_event_no_update;
alter table public.delivery_event enable trigger delivery_event_no_delete;
alter table public.delivery_event enable trigger delivery_event_no_truncate;
alter table public.delivery        enable trigger delivery_no_delete;
alter table public.delivery        enable trigger delivery_no_truncate;

-- app_user rows are gone with the truncate; drop the auth identities too so
-- the seed can recreate them with the same addresses.
delete from auth.users;

commit;
