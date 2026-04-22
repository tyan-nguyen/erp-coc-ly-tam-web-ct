create extension if not exists pgcrypto;

create table if not exists public.ke_hoach_sx_ngay (
  plan_id uuid primary key default gen_random_uuid(),
  ngay_ke_hoach date not null,
  trang_thai text not null default 'NHAP' check (trang_thai in ('NHAP', 'DA_CHOT')),
  ghi_chu text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create unique index if not exists ke_hoach_sx_ngay_unique_active_date
  on public.ke_hoach_sx_ngay (ngay_ke_hoach)
  where is_active = true;

create table if not exists public.ke_hoach_sx_line (
  line_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.ke_hoach_sx_ngay(plan_id) on delete cascade,
  order_id uuid not null,
  boc_id uuid null,
  quote_id uuid null,
  ma_order text null,
  ma_bao_gia text null,
  khach_hang text null,
  du_an text null,
  loai_coc text null,
  doan_key text not null,
  ten_doan text not null,
  chieu_dai_m numeric(12,2) not null default 0,
  so_luong_dat numeric(14,2) not null default 0,
  so_luong_da_san_xuat numeric(14,2) not null default 0,
  so_luong_da_len_ke_hoach numeric(14,2) not null default 0,
  so_luong_con_lai_tam numeric(14,2) not null default 0,
  so_luong_ke_hoach numeric(14,2) not null default 0,
  thu_tu integer not null default 0,
  ghi_chu text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

create index if not exists ke_hoach_sx_line_plan_idx on public.ke_hoach_sx_line(plan_id);
create index if not exists ke_hoach_sx_line_order_segment_idx on public.ke_hoach_sx_line(order_id, doan_key);

alter table public.ke_hoach_sx_ngay enable row level security;
alter table public.ke_hoach_sx_line enable row level security;

drop policy if exists ke_hoach_sx_ngay_select on public.ke_hoach_sx_ngay;
create policy ke_hoach_sx_ngay_select on public.ke_hoach_sx_ngay
for select to authenticated
using (is_active = true);

drop policy if exists ke_hoach_sx_ngay_insert on public.ke_hoach_sx_ngay;
create policy ke_hoach_sx_ngay_insert on public.ke_hoach_sx_ngay
for insert to authenticated
with check (true);

drop policy if exists ke_hoach_sx_ngay_update on public.ke_hoach_sx_ngay;
create policy ke_hoach_sx_ngay_update on public.ke_hoach_sx_ngay
for update to authenticated
using (is_active = true)
with check (is_active = true);

drop policy if exists ke_hoach_sx_line_select on public.ke_hoach_sx_line;
create policy ke_hoach_sx_line_select on public.ke_hoach_sx_line
for select to authenticated
using (is_active = true);

drop policy if exists ke_hoach_sx_line_insert on public.ke_hoach_sx_line;
create policy ke_hoach_sx_line_insert on public.ke_hoach_sx_line
for insert to authenticated
with check (true);

drop policy if exists ke_hoach_sx_line_update on public.ke_hoach_sx_line;
create policy ke_hoach_sx_line_update on public.ke_hoach_sx_line
for update to authenticated
using (is_active = true)
with check (is_active = true);

