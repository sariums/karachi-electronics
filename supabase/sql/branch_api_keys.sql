-- ============================================================================
-- PER-BRANCH external API key
-- Run once in the Supabase SQL editor.
-- ============================================================================
-- Each branch gets its own secret key. The external lock/notify APIs look the key
-- up in branches.api_key, resolve the branch, and only touch THAT branch's devices.
-- ============================================================================

-- 1. The key column (unique across branches).
alter table public.branches
  add column if not exists api_key text unique;

-- 2. Give every existing branch a key (two random UUIDs, hex, with a 'keapi_' prefix).
update public.branches
set api_key = 'keapi_' || replace(gen_random_uuid()::text, '-', '')
                       || replace(gen_random_uuid()::text, '-', '')
where api_key is null;

-- 3. Rotate a branch's key. SECURITY DEFINER with an explicit check: a branch admin
--    can rotate only their OWN branch's key; a super admin can rotate any branch's.
create or replace function public.regenerate_branch_api_key(p_branch_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_key text;
  caller  uuid := auth.uid();
  allowed boolean;
begin
  select exists(
    select 1 from public.admin_users a
    where a.id = caller
      and (coalesce(a.is_super_admin, false) = true or a.branch_id = p_branch_id)
  ) into allowed;

  if not allowed then
    raise exception 'not authorized for this branch';
  end if;

  new_key := 'keapi_' || replace(gen_random_uuid()::text, '-', '')
                       || replace(gen_random_uuid()::text, '-', '');
  update public.branches set api_key = new_key where id = p_branch_id;
  return new_key;
end;
$$;

grant execute on function public.regenerate_branch_api_key(uuid) to authenticated;

-- ============================================================================
-- DIAGNOSTIC (optional) — run this separately and share the result so we can
-- confirm a branch admin can only read their OWN branch row (so one branch can
-- never read another branch's key). If it shows a per-branch USING clause on
-- SELECT, we're good.
-- ============================================================================
-- select policyname, cmd, roles, qual from pg_policies where tablename = 'branches';
