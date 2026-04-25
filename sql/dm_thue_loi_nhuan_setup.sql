begin;

create table if not exists public.dm_thue_vat (
  vat_id uuid primary key default gen_random_uuid(),
  loai_ap_dung text not null,
  vat_pct numeric not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  constraint dm_thue_vat_loai_check check (upper(loai_ap_dung) = any (array['COC'::text, 'PHU_KIEN'::text]))
);

create index if not exists dm_thue_vat_loai_idx on public.dm_thue_vat (upper(loai_ap_dung));

create table if not exists public.dm_bien_loi_nhuan (
  rule_id uuid primary key default gen_random_uuid(),
  duong_kinh_mm numeric not null,
  min_md numeric not null default 0,
  loi_nhuan_pct numeric not null,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists dm_bien_loi_nhuan_lookup_idx
  on public.dm_bien_loi_nhuan (duong_kinh_mm, min_md);

commit;
