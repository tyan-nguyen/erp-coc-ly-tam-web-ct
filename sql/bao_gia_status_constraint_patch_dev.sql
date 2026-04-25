-- DEV patch: align public.bao_gia.trang_thai check constraint with the app flow.
-- Run this in Supabase SQL editor if `bao_gia_trang_thai_check` rejects quote actions.
--
-- Allowed statuses in app:
-- - NHAP
-- - DA_XUAT_PDF
-- - DA_GUI_KHACH
-- - KH_YEU_CAU_CHINH_SUA
-- - DA_CHOT
-- - THAT_BAI

alter table public.bao_gia
  drop constraint if exists bao_gia_trang_thai_check;

alter table public.bao_gia
  add constraint bao_gia_trang_thai_check
  check (
    trang_thai in (
      'NHAP',
      'DA_XUAT_PDF',
      'DA_GUI_KHACH',
      'KH_YEU_CAU_CHINH_SUA',
      'DA_CHOT',
      'THAT_BAI'
    )
  );
