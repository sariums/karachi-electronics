-- ============================================================================
-- LICENSE MODEL: add-only limit + per-device consumption that never reverts
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → Run).
-- ============================================================================
--
-- What this does:
--   1. Adds branches.licenses_consumed — a counter that only ever goes UP.
--   2. Backfills it from each branch's current device count (so existing
--      branches don't suddenly show 0 used).
--   3. Installs a trigger so that EVERY device added to a branch consumes one
--      license. Deleting a device does NOT give the license back.
--   4. The trigger also blocks adding a device once a branch has consumed its
--      whole allocation (authoritative server-side cap).
--
-- The super admin can still RAISE a branch's device_license_limit (the "Add"
-- button in the panel just increments it) — but the number is never edited
-- down, and consumed licenses are never refunded.
-- ============================================================================

-- 1. Consumed-license counter (monotonic).
alter table public.branches
  add column if not exists licenses_consumed integer not null default 0;

-- 2. Backfill: existing devices count as already-consumed for their branch.
update public.branches b
set licenses_consumed = (
  select count(*) from public.devices d where d.branch_id = b.id
);

-- 3. Consume-on-insert + enforce the cap. SECURITY DEFINER so it runs with the
--    table owner's rights regardless of who inserts (admin panel OR the device's
--    own self-enroll). branch_id NULL (e.g. super-admin's own rows) is ignored.
create or replace function public.consume_branch_license()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim  integer;
  used integer;
begin
  if NEW.branch_id is null then
    return NEW;
  end if;

  -- Lock the branch row so two concurrent enrolls can't both slip past the cap.
  select device_license_limit, licenses_consumed
    into lim, used
    from public.branches
   where id = NEW.branch_id
     for update;

  if lim is null then
    -- Branch row missing — let the insert through rather than hard-failing.
    return NEW;
  end if;

  if used >= lim then
    raise exception 'LICENSE_LIMIT_REACHED';
  end if;

  update public.branches
     set licenses_consumed = used + 1
   where id = NEW.branch_id;

  return NEW;
end;
$$;

drop trigger if exists trg_consume_branch_license on public.devices;
create trigger trg_consume_branch_license
  before insert on public.devices
  for each row
  execute function public.consume_branch_license();

-- NOTE: deliberately NO delete trigger — deleting a device must NOT decrement
-- licenses_consumed. A consumed license stays consumed forever.
