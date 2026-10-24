-- ============================================================================
-- PER-BRANCH LICENSE LOG — date-wise history of licenses ADDED and USED.
-- Run once in the Supabase SQL editor. (Run branch_api_keys.sql first if not done.)
-- ============================================================================

-- 1. The log table.
create table if not exists public.license_log (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  event_type text not null check (event_type in ('add', 'consume')),
  amount     integer not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists license_log_branch_idx on public.license_log (branch_id, created_at);

-- 2. Read access: a branch admin sees only their branch's log, super admin sees all.
alter table public.license_log enable row level security;
drop policy if exists "license_log read own or super" on public.license_log;
create policy "license_log read own or super" on public.license_log
  for select to authenticated
  using (branch_id = current_branch_id() or is_super_admin());
grant select on public.license_log to authenticated;
grant select, insert on public.license_log to service_role;

-- 3. Consume trigger now ALSO writes a log row per device added (date-wise usage).
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
  select device_license_limit, licenses_consumed into lim, used
    from public.branches where id = NEW.branch_id for update;
  if lim is null then
    return NEW;
  end if;
  if used >= lim then
    raise exception 'LICENSE_LIMIT_REACHED';
  end if;
  update public.branches set licenses_consumed = used + 1 where id = NEW.branch_id;
  insert into public.license_log (branch_id, event_type, amount, note)
    values (NEW.branch_id, 'consume', 1, coalesce(NEW.device_model, NEW.imei, 'device'));
  return NEW;
end;
$$;

-- 4. Add-licenses RPC (super admin only): bumps the limit AND logs the addition.
create or replace function public.add_branch_licenses(p_branch_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_limit integer;
begin
  if not is_super_admin() then
    raise exception 'super admin only';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  update public.branches
     set device_license_limit = coalesce(device_license_limit, 0) + p_amount
   where id = p_branch_id
   returning device_license_limit into new_limit;
  insert into public.license_log (branch_id, event_type, amount, note)
    values (p_branch_id, 'add', p_amount, 'added by super admin');
  return new_limit;
end;
$$;
grant execute on function public.add_branch_licenses(uuid, integer) to authenticated;

-- 5. Backfill history (only if the log is empty) so existing branches aren't blank:
--    one 'add' row = each branch's current allocation at its creation date, and one
--    'consume' row per existing device at the date it was provisioned.
insert into public.license_log (branch_id, event_type, amount, note, created_at)
select b.id, 'add', b.device_license_limit, 'initial allocation', b.created_at
from public.branches b
where b.device_license_limit > 0
  and not exists (select 1 from public.license_log l where l.branch_id = b.id);

insert into public.license_log (branch_id, event_type, amount, note, created_at)
select d.branch_id, 'consume', 1, coalesce(d.device_model, d.imei, 'device'), d.provisioned_at
from public.devices d
where d.branch_id is not null
  and not exists (
    select 1 from public.license_log l
    where l.branch_id = d.branch_id and l.event_type = 'consume'
  );
