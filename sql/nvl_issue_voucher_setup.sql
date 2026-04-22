create extension if not exists pgcrypto;

create table if not exists public.material_issue_voucher (
  voucher_id uuid primary key default gen_random_uuid(),
  voucher_code text not null unique,
  issue_kind text not null default 'BAN_VAT_TU',
  status text not null default 'CHO_XAC_NHAN',
  kh_id text null,
  da_id text null,
  operation_date date null,
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.material_issue_voucher add column if not exists voucher_code text;
alter table public.material_issue_voucher add column if not exists issue_kind text not null default 'BAN_VAT_TU';
alter table public.material_issue_voucher add column if not exists status text not null default 'CHO_XAC_NHAN';
alter table public.material_issue_voucher add column if not exists kh_id text null;
alter table public.material_issue_voucher add column if not exists da_id text null;
alter table public.material_issue_voucher add column if not exists operation_date date null;
alter table public.material_issue_voucher add column if not exists note text null;
alter table public.material_issue_voucher add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_issue_voucher add column if not exists is_active boolean not null default true;
alter table public.material_issue_voucher add column if not exists deleted_at timestamptz null;
alter table public.material_issue_voucher add column if not exists created_at timestamptz not null default now();
alter table public.material_issue_voucher add column if not exists updated_at timestamptz not null default now();
alter table public.material_issue_voucher add column if not exists created_by uuid null;
alter table public.material_issue_voucher add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'material_issue_voucher_issue_kind_check'
  ) then
    alter table public.material_issue_voucher
      add constraint material_issue_voucher_issue_kind_check
      check (issue_kind in ('BAN_VAT_TU', 'DIEU_CHUYEN'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'material_issue_voucher_status_check'
  ) then
    alter table public.material_issue_voucher
      add constraint material_issue_voucher_status_check
      check (status in ('CHO_XAC_NHAN', 'DA_XUAT', 'XUAT_MOT_PHAN', 'HUY'));
  end if;
end $$;

create unique index if not exists material_issue_voucher_code_unique
  on public.material_issue_voucher (voucher_code);

create index if not exists material_issue_voucher_active_idx
  on public.material_issue_voucher (is_active, created_at desc);

create table if not exists public.material_issue_voucher_line (
  voucher_line_id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.material_issue_voucher(voucher_id) on delete cascade,
  line_no integer not null,
  material_code text not null,
  material_name text not null,
  unit text null,
  requested_qty numeric(18,3) not null default 0,
  actual_qty numeric(18,3) not null default 0,
  unit_price numeric(18,3) not null default 0,
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.material_issue_voucher_line add column if not exists voucher_id uuid;
alter table public.material_issue_voucher_line add column if not exists line_no integer not null default 1;
alter table public.material_issue_voucher_line add column if not exists material_code text;
alter table public.material_issue_voucher_line add column if not exists material_name text;
alter table public.material_issue_voucher_line add column if not exists unit text null;
alter table public.material_issue_voucher_line add column if not exists requested_qty numeric(18,3) not null default 0;
alter table public.material_issue_voucher_line add column if not exists actual_qty numeric(18,3) not null default 0;
alter table public.material_issue_voucher_line add column if not exists unit_price numeric(18,3) not null default 0;
alter table public.material_issue_voucher_line add column if not exists note text null;
alter table public.material_issue_voucher_line add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_issue_voucher_line add column if not exists is_active boolean not null default true;
alter table public.material_issue_voucher_line add column if not exists deleted_at timestamptz null;
alter table public.material_issue_voucher_line add column if not exists created_at timestamptz not null default now();
alter table public.material_issue_voucher_line add column if not exists updated_at timestamptz not null default now();
alter table public.material_issue_voucher_line add column if not exists created_by uuid null;
alter table public.material_issue_voucher_line add column if not exists updated_by uuid null;

create unique index if not exists material_issue_voucher_line_unique
  on public.material_issue_voucher_line (voucher_id, line_no);

create index if not exists material_issue_voucher_line_material_idx
  on public.material_issue_voucher_line (material_code);

alter table public.material_issue_voucher enable row level security;
alter table public.material_issue_voucher_line enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.material_issue_voucher to authenticated;
grant select, insert, update, delete on public.material_issue_voucher_line to authenticated;

drop policy if exists material_issue_voucher_all_authenticated on public.material_issue_voucher;
drop policy if exists material_issue_voucher_line_all_authenticated on public.material_issue_voucher_line;

create policy material_issue_voucher_all_authenticated on public.material_issue_voucher
for all to authenticated
using (true)
with check (true);

create policy material_issue_voucher_line_all_authenticated on public.material_issue_voucher_line
for all to authenticated
using (true)
with check (true);
