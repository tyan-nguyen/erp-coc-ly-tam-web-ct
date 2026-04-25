create extension if not exists pgcrypto;

create table if not exists public.bao_gia (
  quote_id uuid primary key default gen_random_uuid(),
  ma_bao_gia text not null unique,
  da_id uuid not null,
  kh_id uuid not null,
  phuong_thuc_van_chuyen text not null,
  trang_thai text not null default 'NHAP',
  current_version_no integer not null default 0,
  current_version_id uuid null,
  tong_tien numeric(18,2) not null default 0,
  ngay_xuat_cuoi timestamptz null,
  ngay_gui_khach timestamptz null,
  ngay_chot timestamptz null,
  ly_do_chinh_sua text null,
  ghi_chu text null,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  constraint bao_gia_trang_thai_check check (
    trang_thai in ('NHAP', 'DA_XUAT_PDF', 'DA_GUI_KHACH', 'KH_YEU_CAU_CHINH_SUA', 'DA_CHOT', 'THAT_BAI')
  )
);

create table if not exists public.bao_gia_version (
  version_id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.bao_gia(quote_id) on delete cascade,
  version_no integer not null,
  action_type text not null default 'SAVE',
  snapshot_json jsonb not null,
  print_html text null,
  tong_tien numeric(18,2) not null default 0,
  ghi_chu text null,
  exported_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  constraint bao_gia_version_action_type_check check (action_type in ('SAVE', 'EXPORT')),
  constraint bao_gia_version_unique unique (quote_id, version_no)
);

create table if not exists public.bao_gia_boc_tach (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.bao_gia(quote_id) on delete cascade,
  boc_id uuid not null references public.boc_tach_nvl(boc_id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null,
  constraint bao_gia_boc_tach_unique unique (quote_id, boc_id)
);

create index if not exists bao_gia_lookup_idx
  on public.bao_gia (da_id, kh_id, trang_thai, created_at desc);

create index if not exists bao_gia_version_lookup_idx
  on public.bao_gia_version (quote_id, version_no desc, created_at desc);

create index if not exists bao_gia_boc_tach_boc_idx
  on public.bao_gia_boc_tach (boc_id);

alter table public.bao_gia enable row level security;
alter table public.bao_gia_version enable row level security;
alter table public.bao_gia_boc_tach enable row level security;

drop policy if exists p_bao_gia_authenticated_all on public.bao_gia;
drop policy if exists p_bao_gia_version_authenticated_all on public.bao_gia_version;
drop policy if exists p_bao_gia_boc_tach_authenticated_all on public.bao_gia_boc_tach;

create policy p_bao_gia_authenticated_all
on public.bao_gia
for all
to authenticated
using (true)
with check (true);

create policy p_bao_gia_version_authenticated_all
on public.bao_gia_version
for all
to authenticated
using (true)
with check (true);

create policy p_bao_gia_boc_tach_authenticated_all
on public.bao_gia_boc_tach
for all
to authenticated
using (true)
with check (true);
