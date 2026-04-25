create extension if not exists pgcrypto;

create table if not exists public.sx_qc_nghiem_thu (
  voucher_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.ke_hoach_sx_ngay(plan_id) on delete cascade,
  ngay_thao_tac date not null,
  ghi_chu text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.sx_qc_nghiem_thu add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.sx_qc_nghiem_thu add column if not exists is_active boolean not null default true;
alter table public.sx_qc_nghiem_thu add column if not exists deleted_at timestamptz null;
alter table public.sx_qc_nghiem_thu add column if not exists created_by uuid null;
alter table public.sx_qc_nghiem_thu add column if not exists updated_by uuid null;
alter table public.sx_qc_nghiem_thu add column if not exists created_at timestamptz not null default now();
alter table public.sx_qc_nghiem_thu add column if not exists updated_at timestamptz not null default now();

create unique index if not exists sx_qc_nghiem_thu_plan_unique_active
  on public.sx_qc_nghiem_thu (plan_id)
  where is_active = true;

alter table public.sx_qc_nghiem_thu enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.sx_qc_nghiem_thu to authenticated;

drop policy if exists sx_qc_nghiem_thu_select on public.sx_qc_nghiem_thu;
drop policy if exists sx_qc_nghiem_thu_insert on public.sx_qc_nghiem_thu;
drop policy if exists sx_qc_nghiem_thu_update on public.sx_qc_nghiem_thu;
drop policy if exists sx_qc_nghiem_thu_all_authenticated on public.sx_qc_nghiem_thu;

create policy sx_qc_nghiem_thu_all_authenticated on public.sx_qc_nghiem_thu
for all to authenticated
using (true)
with check (true);
