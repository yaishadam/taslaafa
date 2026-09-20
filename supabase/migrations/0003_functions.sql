-- Taslaafa 0003: the three writes that must be atomic.
--
-- These are SECURITY INVOKER on purpose. They are executable only by
-- service_role, which has BYPASSRLS, so they run with exactly the privileges
-- the server already has -- no privilege escalation hidden in a definer.
-- The append-only triggers still apply to them.

-- Makes the late sweep idempotent without a read-then-write race.
create unique index delivery_event_one_late_idx
  on public.delivery_event (delivery_id)
  where type = 'marked_late';


-- ----------------------------------------------------- attempt_code
-- The app computes HMAC-SHA256(mac_key, typed_code) and passes the hex digest.
-- The key never reaches Postgres, so this function cannot be used as an oracle
-- by anyone who only has database access.
--
-- Returns jsonb: { result, attempts, attempts_left, locked, seconds_to_door,
--                  beat_promise, confirmed_at }
-- result is one of: confirmed | wrong | locked | already_confirmed | not_found
create or replace function public.attempt_code(
  p_delivery_id uuid,
  p_actor_id    uuid,
  p_code_hash   text
)
returns jsonb
language plpgsql
as $$
declare
  d        public.delivery%rowtype;
  c        public.delivery_code%rowtype;
  v_ok     boolean;
  v_locked boolean;
  v_secs   integer;
  v_beat   boolean;
begin
  -- Lock the code row first: two taps on a slow connection must not both count.
  select * into c from public.delivery_code
    where delivery_id = p_delivery_id
    for update;

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  select * into d from public.delivery where id = p_delivery_id for update;

  if d.confirmed_at is not null then
    return jsonb_build_object('result', 'already_confirmed',
                              'confirmed_at', d.confirmed_at);
  end if;

  if c.locked then
    return jsonb_build_object('result', 'locked',
                              'attempts', c.attempts, 'attempts_left', 0,
                              'locked', true);
  end if;

  -- Both sides are fixed-length hex digests of a secret-keyed HMAC, so a
  -- timing difference here leaks nothing about the 4 digits.
  v_ok := (c.code_hash = p_code_hash);

  if v_ok then
    update public.delivery
       set confirmed_at = now(), confirmed_by = p_actor_id
     where id = p_delivery_id
    returning * into d;

    v_secs := extract(epoch from (d.confirmed_at - d.sent_at))::integer;
    v_beat := d.confirmed_at <= d.due_at;

    insert into public.delivery_event
      (delivery_id, shop_id, type, actor_kind, actor_user_id, payload)
    values
      (d.id, d.shop_id, 'code_confirmed', 'driver', p_actor_id,
       jsonb_build_object('attempt', c.attempts + 1,
                          'seconds_to_door', v_secs,
                          'beat_promise', v_beat));

    -- The successful attempt is part of the record too.
    insert into public.delivery_event
      (delivery_id, shop_id, type, actor_kind, actor_user_id, payload)
    values
      (d.id, d.shop_id, 'code_attempted', 'driver', p_actor_id,
       jsonb_build_object('ok', true, 'attempt', c.attempts + 1, 'locked', false));

    return jsonb_build_object('result', 'confirmed',
                              'attempts', c.attempts + 1, 'attempts_left', 0,
                              'locked', false,
                              'seconds_to_door', v_secs,
                              'beat_promise', v_beat,
                              'confirmed_at', d.confirmed_at);
  end if;

  v_locked := (c.attempts + 1) >= 3;

  update public.delivery_code
     set attempts = c.attempts + 1,
         locked   = v_locked
   where delivery_id = p_delivery_id;

  -- Written on every miss, so the shop sees a lock the moment it happens.
  insert into public.delivery_event
    (delivery_id, shop_id, type, actor_kind, actor_user_id, payload)
  values
    (p_delivery_id, d.shop_id, 'code_attempted', 'driver', p_actor_id,
     jsonb_build_object('ok', false, 'attempt', c.attempts + 1, 'locked', v_locked));

  return jsonb_build_object('result', case when v_locked then 'locked' else 'wrong' end,
                            'attempts', c.attempts + 1,
                            'attempts_left', greatest(3 - (c.attempts + 1), 0),
                            'locked', v_locked);
end;
$$;


-- ------------------------------------------------- record_link_opened
-- Idempotent: the partial unique index means only the first open is recorded,
-- however many times the customer reloads the page.
create or replace function public.record_link_opened(p_delivery_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_shop uuid;
begin
  select shop_id into v_shop from public.delivery where id = p_delivery_id;
  if not found then
    return false;
  end if;

  insert into public.delivery_event
    (delivery_id, shop_id, type, actor_kind, payload)
  values
    (p_delivery_id, v_shop, 'link_opened', 'customer', '{}'::jsonb)
  on conflict do nothing;

  return true;
end;
$$;


-- -------------------------------------------------------- sweep_late
-- Flags every delivery past sent_at + promise_minutes that is still unconfirmed
-- and not already flagged. Called by the Vercel cron AND by the live-board poll
-- endpoint, so lateness surfaces within ~10s without depending on cron tier.
-- Returns the number newly flagged.
create or replace function public.sweep_late(p_shop_id uuid default null)
returns integer
language sql
as $$
  with overdue as (
    select d.id, d.shop_id, d.due_at
      from public.delivery d
     where d.confirmed_at is null
       and d.sent_at is not null
       and d.due_at < now()
       and (p_shop_id is null or d.shop_id = p_shop_id)
  ), inserted as (
    insert into public.delivery_event
      (delivery_id, shop_id, type, actor_kind, payload)
    select o.id, o.shop_id, 'marked_late', 'system',
           jsonb_build_object('due_at', o.due_at,
                              'minutes_over',
                              floor(extract(epoch from (now() - o.due_at)) / 60)::int)
      from overdue o
    on conflict do nothing
    returning 1
  )
  select coalesce(count(*), 0)::int from inserted;
$$;


-- Server-only. No authenticated client may call these.
revoke execute on function public.attempt_code(uuid, uuid, text)  from public, anon, authenticated;
revoke execute on function public.record_link_opened(uuid)        from public, anon, authenticated;
revoke execute on function public.sweep_late(uuid)                from public, anon, authenticated;
grant  execute on function public.attempt_code(uuid, uuid, text)  to service_role;
grant  execute on function public.record_link_opened(uuid)        to service_role;
grant  execute on function public.sweep_late(uuid)                to service_role;


-- ------------------------------------------------------ reissue_code
-- Owner only, and only by way of /api/deliveries/[id]/reissue, which checks the
-- role before calling this. A locked code otherwise means the delivery can
-- never be confirmed. The public token does not change, so the customer's
-- existing link simply starts showing the new digits.
--
-- The app has already minted and encrypted the replacement; this function only
-- swaps it in and records that it happened.
create or replace function public.reissue_code(
  p_delivery_id uuid,
  p_actor_id    uuid,
  p_code_hash   text,
  p_code_ct     text
)
returns jsonb
language plpgsql
as $$
declare
  d        public.delivery%rowtype;
  c        public.delivery_code%rowtype;
begin
  select * into c from public.delivery_code
    where delivery_id = p_delivery_id
    for update;

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  select * into d from public.delivery where id = p_delivery_id;

  if d.confirmed_at is not null then
    return jsonb_build_object('result', 'already_confirmed');
  end if;

  update public.delivery_code
     set code_hash = p_code_hash,
         code_ct   = p_code_ct,
         attempts  = 0,
         locked    = false,
         reissues  = c.reissues + 1
   where delivery_id = p_delivery_id;

  -- The old code's three failures stay in the log. This is an addition to the
  -- record, not a reset of it.
  insert into public.delivery_event
    (delivery_id, shop_id, type, actor_kind, actor_user_id, payload)
  values
    (p_delivery_id, d.shop_id, 'code_reissued', 'owner', p_actor_id,
     jsonb_build_object('reissue', c.reissues + 1,
                        'after_attempts', c.attempts,
                        'was_locked', c.locked));

  return jsonb_build_object('result', 'reissued', 'reissue', c.reissues + 1);
end;
$$;

revoke execute on function public.reissue_code(uuid, uuid, text, text) from public, anon, authenticated;
grant  execute on function public.reissue_code(uuid, uuid, text, text) to service_role;
