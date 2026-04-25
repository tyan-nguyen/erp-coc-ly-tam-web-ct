-- DEV patch: align `boc_tach_nvl.trang_thai` check constraint
-- with the workflow already implemented in the app.
--
-- Allowed statuses after this patch:
-- - NHAP
-- - DA_GUI
-- - TRA_LAI
-- - DA_DUYET_QLSX
-- - HUY

alter table public.boc_tach_nvl
  drop constraint if exists boc_tach_nvl_trang_thai_check;

alter table public.boc_tach_nvl
  add constraint boc_tach_nvl_trang_thai_check
  check (
    trang_thai in ('NHAP', 'DA_GUI', 'TRA_LAI', 'DA_DUYET_QLSX', 'HUY')
  );

-- Verify
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'boc_tach_nvl_trang_thai_check';
