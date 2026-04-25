-- DEV patch: align RLS on child tables with owner of parent `boc_tach_nvl`.
-- This fixes cases where child rows were created without `created_by`,
-- so later delete/refresh silently affected 0 rows and re-insert hit unique keys.

drop policy if exists p_boc_tach_nvl_items_owner_all on public.boc_tach_nvl_items;
drop policy if exists p_boc_tach_seg_nvl_owner_all on public.boc_tach_seg_nvl;

create policy p_boc_tach_nvl_items_owner_all
on public.boc_tach_nvl_items
for all
to authenticated
using (
  exists (
    select 1
    from public.boc_tach_nvl h
    where h.boc_id = boc_tach_nvl_items.boc_id
      and h.created_by = auth.uid()
      and coalesce(h.is_active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.boc_tach_nvl h
    where h.boc_id = boc_tach_nvl_items.boc_id
      and h.created_by = auth.uid()
      and coalesce(h.is_active, true) = true
  )
);

create policy p_boc_tach_seg_nvl_owner_all
on public.boc_tach_seg_nvl
for all
to authenticated
using (
  exists (
    select 1
    from public.boc_tach_nvl h
    where h.boc_id = boc_tach_seg_nvl.boc_id
      and h.created_by = auth.uid()
      and coalesce(h.is_active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.boc_tach_nvl h
    where h.boc_id = boc_tach_seg_nvl.boc_id
      and h.created_by = auth.uid()
      and coalesce(h.is_active, true) = true
  )
);

-- Verify policies
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('boc_tach_nvl_items', 'boc_tach_seg_nvl')
order by tablename, policyname;
