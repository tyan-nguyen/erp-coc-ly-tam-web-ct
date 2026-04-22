-- DEV patch: allow Admin users to manage all `boc_tach_nvl` records and child rows,
-- while keeping owner access for normal users.
--
-- Why this is needed:
-- 1) current RLS is tied to `created_by = auth.uid()`
-- 2) admin test account can read rows but cannot update/delete rows created by another user id
-- 3) that breaks:
--    - QLSX return status persisting to DB
--    - save draft after return
--    - child-row cleanup before resync

drop policy if exists p_boc_tach_nvl_send_owner on public.boc_tach_nvl;
drop policy if exists p_boc_tach_nvl_owner_or_admin_all on public.boc_tach_nvl;
drop policy if exists p_boc_tach_nvl_items_owner_all on public.boc_tach_nvl_items;
drop policy if exists p_boc_tach_nvl_items_owner_or_admin_all on public.boc_tach_nvl_items;
drop policy if exists p_boc_tach_seg_nvl_owner_all on public.boc_tach_seg_nvl;
drop policy if exists p_boc_tach_seg_nvl_owner_or_admin_all on public.boc_tach_seg_nvl;

create policy p_boc_tach_nvl_owner_or_admin_all
on public.boc_tach_nvl
for all
to authenticated
using (
  coalesce(is_active, true) = true
  and (
    created_by = auth.uid()
    or exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and lower(coalesce(up.role, '')) = 'admin'
    )
  )
)
with check (
  coalesce(is_active, true) = true
  and (
    created_by = auth.uid()
    or exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and lower(coalesce(up.role, '')) = 'admin'
    )
  )
);

create policy p_boc_tach_nvl_items_owner_or_admin_all
on public.boc_tach_nvl_items
for all
to authenticated
using (
  exists (
    select 1
    from public.boc_tach_nvl h
    where h.boc_id = boc_tach_nvl_items.boc_id
      and coalesce(h.is_active, true) = true
      and (
        h.created_by = auth.uid()
        or exists (
          select 1
          from public.user_profiles up
          where up.user_id = auth.uid()
            and up.is_active = true
            and lower(coalesce(up.role, '')) = 'admin'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.boc_tach_nvl h
    where h.boc_id = boc_tach_nvl_items.boc_id
      and coalesce(h.is_active, true) = true
      and (
        h.created_by = auth.uid()
        or exists (
          select 1
          from public.user_profiles up
          where up.user_id = auth.uid()
            and up.is_active = true
            and lower(coalesce(up.role, '')) = 'admin'
        )
      )
  )
);

create policy p_boc_tach_seg_nvl_owner_or_admin_all
on public.boc_tach_seg_nvl
for all
to authenticated
using (
  exists (
    select 1
    from public.boc_tach_nvl h
    where h.boc_id = boc_tach_seg_nvl.boc_id
      and coalesce(h.is_active, true) = true
      and (
        h.created_by = auth.uid()
        or exists (
          select 1
          from public.user_profiles up
          where up.user_id = auth.uid()
            and up.is_active = true
            and lower(coalesce(up.role, '')) = 'admin'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.boc_tach_nvl h
    where h.boc_id = boc_tach_seg_nvl.boc_id
      and coalesce(h.is_active, true) = true
      and (
        h.created_by = auth.uid()
        or exists (
          select 1
          from public.user_profiles up
          where up.user_id = auth.uid()
            and up.is_active = true
            and lower(coalesce(up.role, '')) = 'admin'
        )
      )
  )
);

-- Verify policies
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('boc_tach_nvl', 'boc_tach_nvl_items', 'boc_tach_seg_nvl')
order by tablename, policyname;
