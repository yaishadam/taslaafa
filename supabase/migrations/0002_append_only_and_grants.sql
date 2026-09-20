-- Taslaafa 0002: rule 1 (append-only log) and the privilege baseline.

-- ------------------------------------------- append-only delivery_event
-- RLS alone is not enough: service_role has BYPASSRLS, and every write in this
-- app goes through service_role. A trigger does not get bypassed, so that is
-- what actually holds the line.
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; % is not permitted', tg_table_name, tg_op
    using errcode = '42501',
          hint = 'Record the correction as a new delivery_event row.';
end;
$$;

create trigger delivery_event_no_update
  before update on public.delivery_event
  for each row execute function public.forbid_mutation();

create trigger delivery_event_no_delete
  before delete on public.delivery_event
  for each row execute function public.forbid_mutation();

create trigger delivery_event_no_truncate
  before truncate on public.delivery_event
  for each statement execute function public.forbid_mutation();

-- A delete on delivery would orphan its proof, so delivery is immutable in the
-- same way for DELETE only. UPDATE stays allowed (sent_at, confirmed_at...).
create trigger delivery_no_delete
  before delete on public.delivery
  for each row execute function public.forbid_mutation();

create trigger delivery_no_truncate
  before truncate on public.delivery
  for each statement execute function public.forbid_mutation();


-- --------------------------------------------------------------- grants
-- Supabase grants broadly by default. Start from nothing.
revoke all on all tables in schema public from anon, authenticated;

-- The customer has no account and never touches Postgres directly: /d/[token]
-- is served by a route handler. anon keeps zero table access.

-- Authenticated clients are READ-ONLY. Every write goes through a server route
-- that checks the session and then uses service_role, so the write path is one
-- reviewable surface instead of a policy matrix.
grant select on public.shop, public.app_user, public.customer,
                public.delivery, public.delivery_event
  to authenticated;

-- delivery_code is granted to no one. Not anon, not authenticated. It is
-- reachable only by service_role, and only from src/server/codes.ts.

-- Even service_role cannot rewrite history.
revoke update, delete, truncate on public.delivery_event from service_role;
revoke delete, truncate on public.delivery from service_role;


-- ------------------------------------------------------------- RLS base
alter table public.shop           enable row level security;
alter table public.app_user       enable row level security;
alter table public.customer       enable row level security;
alter table public.delivery       enable row level security;
alter table public.delivery_code  enable row level security;
alter table public.delivery_event enable row level security;

-- FORCE so the table owner is subject to policies too.
alter table public.shop           force row level security;
alter table public.app_user       force row level security;
alter table public.customer       force row level security;
alter table public.delivery       force row level security;
alter table public.delivery_code  force row level security;
alter table public.delivery_event force row level security;

-- delivery_code deliberately has NO policies. RLS on with zero policies denies
-- every row to every non-bypassing role. Combined with the missing grant, an
-- authenticated client cannot reach a code even if a policy is added by mistake
-- later.


-- -------------------------------------------------- identity helpers
-- SECURITY DEFINER so reading app_user inside a policy on app_user does not
-- recurse. search_path pinned.
create or replace function public.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select shop_id from public.app_user where id = auth.uid() and is_active
$$;

create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_user where id = auth.uid() and is_active
$$;

revoke execute on function public.current_shop_id()   from public, anon;
revoke execute on function public.current_role_name() from public, anon;
grant  execute on function public.current_shop_id()   to authenticated;
grant  execute on function public.current_role_name() to authenticated;


-- ------------------------------------------------------------ policies
create policy shop_read on public.shop
  for select to authenticated
  using (id = public.current_shop_id());

create policy app_user_read on public.app_user
  for select to authenticated
  using (shop_id = public.current_shop_id());

-- Owner and staff see the whole customer book. A driver sees only the customers
-- behind his own drops.
create policy customer_read on public.customer
  for select to authenticated
  using (
    shop_id = public.current_shop_id()
    and (
      public.current_role_name() in ('owner', 'staff')
      or exists (
        select 1 from public.delivery d
        where d.customer_id = customer.id
          and d.driver_id = auth.uid()
      )
    )
  );

create policy delivery_read on public.delivery
  for select to authenticated
  using (
    shop_id = public.current_shop_id()
    and (
      public.current_role_name() in ('owner', 'staff')
      or driver_id = auth.uid()
    )
  );

create policy delivery_event_read on public.delivery_event
  for select to authenticated
  using (
    shop_id = public.current_shop_id()
    and (
      public.current_role_name() in ('owner', 'staff')
      or exists (
        select 1 from public.delivery d
        where d.id = delivery_event.delivery_id
          and d.driver_id = auth.uid()
      )
    )
  );
