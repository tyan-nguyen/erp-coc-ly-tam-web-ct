-- DEV patch: allow NHAP -> DA_GUI transition for owner rows in public.boc_tach_nvl.
-- Scope: policy only, no table/schema/model change.

drop policy if exists p_boc_tach_nvl_send_owner on public.boc_tach_nvl;

create policy p_boc_tach_nvl_send_owner
on public.boc_tach_nvl
for update
to authenticated
using (
  created_by = auth.uid()
  and coalesce(is_active, true) = true
  and trang_thai = 'NHAP'
)
with check (
  created_by = auth.uid()
  and coalesce(is_active, true) = true
  and trang_thai in ('NHAP', 'DA_GUI', 'HUY')
);

-- Verify policies
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='boc_tach_nvl'
order by policyname;
