create extension if not exists pgcrypto;

create table if not exists public.phieu_xuat_ban (
  voucher_id uuid primary key default gen_random_uuid(),
  source_type text not null default 'DON_HANG',
  trang_thai text not null default 'CHO_XAC_NHAN',
  ngay_thao_tac date not null,
  kh_id uuid null,
  da_id uuid null,
  order_id uuid null,
  quote_id uuid null,
  ghi_chu text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.phieu_xuat_ban add column if not exists source_type text not null default 'DON_HANG';
alter table public.phieu_xuat_ban add column if not exists trang_thai text not null default 'CHO_XAC_NHAN';
alter table public.phieu_xuat_ban add column if not exists ngay_thao_tac date not null default current_date;
alter table public.phieu_xuat_ban add column if not exists kh_id uuid null;
alter table public.phieu_xuat_ban add column if not exists da_id uuid null;
alter table public.phieu_xuat_ban add column if not exists order_id uuid null;
alter table public.phieu_xuat_ban add column if not exists quote_id uuid null;
alter table public.phieu_xuat_ban add column if not exists ghi_chu text null;
alter table public.phieu_xuat_ban add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.phieu_xuat_ban add column if not exists is_active boolean not null default true;
alter table public.phieu_xuat_ban add column if not exists deleted_at timestamptz null;
alter table public.phieu_xuat_ban add column if not exists created_at timestamptz not null default now();
alter table public.phieu_xuat_ban add column if not exists updated_at timestamptz not null default now();
alter table public.phieu_xuat_ban add column if not exists created_by uuid null;
alter table public.phieu_xuat_ban add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'phieu_xuat_ban_source_type_check'
  ) then
    alter table public.phieu_xuat_ban
      add constraint phieu_xuat_ban_source_type_check
      check (source_type in ('DON_HANG', 'TON_KHO'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'phieu_xuat_ban_trang_thai_check'
  ) then
    alter table public.phieu_xuat_ban
      add constraint phieu_xuat_ban_trang_thai_check
      check (trang_thai in ('CHO_XAC_NHAN', 'DA_XUAT', 'XUAT_MOT_PHAN'));
  end if;
end $$;

create index if not exists phieu_xuat_ban_order_idx on public.phieu_xuat_ban(order_id);
create index if not exists phieu_xuat_ban_status_idx on public.phieu_xuat_ban(trang_thai) where is_active = true;
create index if not exists phieu_xuat_ban_created_at_idx on public.phieu_xuat_ban(created_at desc);

alter table public.phieu_xuat_ban enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.phieu_xuat_ban to authenticated;

drop policy if exists phieu_xuat_ban_select on public.phieu_xuat_ban;
drop policy if exists phieu_xuat_ban_insert on public.phieu_xuat_ban;
drop policy if exists phieu_xuat_ban_update on public.phieu_xuat_ban;
drop policy if exists phieu_xuat_ban_all_authenticated on public.phieu_xuat_ban;

create policy phieu_xuat_ban_all_authenticated on public.phieu_xuat_ban
for all to authenticated
using (true)
with check (true);
