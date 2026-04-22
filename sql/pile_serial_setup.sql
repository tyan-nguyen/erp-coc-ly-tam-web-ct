create extension if not exists pgcrypto;

create table if not exists public.production_lot (
  lot_id uuid primary key default gen_random_uuid(),
  lot_code text not null unique,
  warehouse_issue_voucher_id uuid null references public.sx_xuat_nvl(voucher_id),
  plan_id uuid null references public.ke_hoach_sx_ngay(plan_id) on delete set null,
  plan_line_id uuid null references public.ke_hoach_sx_line(line_id) on delete set null,
  order_id uuid null,
  boc_id uuid null,
  quote_id uuid null,
  loai_coc text not null,
  ten_doan text not null,
  chieu_dai_m numeric(12,3) not null default 0,
  production_date date not null,
  actual_qty integer not null default 0,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

alter table public.production_lot add column if not exists warehouse_issue_voucher_id uuid null references public.sx_xuat_nvl(voucher_id);
alter table public.production_lot add column if not exists plan_id uuid null references public.ke_hoach_sx_ngay(plan_id) on delete set null;
alter table public.production_lot add column if not exists plan_line_id uuid null references public.ke_hoach_sx_line(line_id) on delete set null;
alter table public.production_lot add column if not exists order_id uuid null;
alter table public.production_lot add column if not exists boc_id uuid null;
alter table public.production_lot add column if not exists quote_id uuid null;
alter table public.production_lot add column if not exists loai_coc text not null default '';
alter table public.production_lot add column if not exists ten_doan text not null default '';
alter table public.production_lot add column if not exists chieu_dai_m numeric(12,3) not null default 0;
alter table public.production_lot add column if not exists production_date date not null default current_date;
alter table public.production_lot add column if not exists actual_qty integer not null default 0;
alter table public.production_lot add column if not exists created_by uuid null;
alter table public.production_lot add column if not exists updated_by uuid null;
alter table public.production_lot add column if not exists created_at timestamptz not null default now();
alter table public.production_lot add column if not exists updated_at timestamptz not null default now();
alter table public.production_lot add column if not exists is_active boolean not null default true;

create unique index if not exists uq_production_lot_voucher_line
  on public.production_lot (warehouse_issue_voucher_id, plan_line_id)
  where is_active = true and warehouse_issue_voucher_id is not null and plan_line_id is not null;

create index if not exists idx_production_lot_plan_id on public.production_lot(plan_id);
create index if not exists idx_production_lot_order_id on public.production_lot(order_id);
create index if not exists idx_production_lot_boc_id on public.production_lot(boc_id);

create table if not exists public.warehouse_location (
  location_id uuid primary key default gen_random_uuid(),
  location_code text not null unique,
  location_name text not null,
  location_type text not null default 'STORAGE',
  parent_location_id uuid null references public.warehouse_location(location_id),
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

alter table public.warehouse_location add column if not exists location_type text not null default 'STORAGE';
alter table public.warehouse_location add column if not exists parent_location_id uuid null references public.warehouse_location(location_id);
alter table public.warehouse_location add column if not exists created_at timestamptz not null default now();
alter table public.warehouse_location add column if not exists is_active boolean not null default true;

insert into public.warehouse_location (location_code, location_name, location_type)
values
  ('CHO_QC', 'Khu chờ QC', 'STAGING'),
  ('KHO_THANH_PHAM', 'Kho thành phẩm', 'STORAGE'),
  ('KHU_LOI', 'Khu hàng lỗi', 'DEFECT')
on conflict (location_code) do nothing;

create table if not exists public.pile_serial (
  serial_id uuid primary key default gen_random_uuid(),
  serial_code text not null unique,
  lot_id uuid not null references public.production_lot(lot_id) on delete cascade,
  warehouse_issue_voucher_id uuid null references public.sx_xuat_nvl(voucher_id),
  order_id uuid null,
  boc_id uuid null,
  quote_id uuid null,
  loai_coc text not null,
  ten_doan text not null,
  chieu_dai_m numeric(12,3) not null default 0,
  lifecycle_status text not null default 'MOI_TAO',
  qc_status text not null default 'CHUA_QC',
  disposition_status text not null default 'BINH_THUONG',
  visible_in_project boolean not null default true,
  visible_in_retail boolean not null default true,
  current_location_id uuid null references public.warehouse_location(location_id),
  current_shipment_voucher_id uuid null references public.phieu_xuat_ban(voucher_id),
  last_return_voucher_id uuid null,
  public_trace_enabled boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

alter table public.pile_serial add column if not exists warehouse_issue_voucher_id uuid null references public.sx_xuat_nvl(voucher_id);
alter table public.pile_serial add column if not exists order_id uuid null;
alter table public.pile_serial add column if not exists boc_id uuid null;
alter table public.pile_serial add column if not exists quote_id uuid null;
alter table public.pile_serial add column if not exists loai_coc text not null default '';
alter table public.pile_serial add column if not exists ten_doan text not null default '';
alter table public.pile_serial add column if not exists chieu_dai_m numeric(12,3) not null default 0;
alter table public.pile_serial add column if not exists lifecycle_status text not null default 'MOI_TAO';
alter table public.pile_serial add column if not exists qc_status text not null default 'CHUA_QC';
alter table public.pile_serial add column if not exists disposition_status text not null default 'BINH_THUONG';
alter table public.pile_serial add column if not exists visible_in_project boolean not null default true;
alter table public.pile_serial add column if not exists visible_in_retail boolean not null default true;
alter table public.pile_serial add column if not exists current_location_id uuid null references public.warehouse_location(location_id);
alter table public.pile_serial add column if not exists current_shipment_voucher_id uuid null references public.phieu_xuat_ban(voucher_id);
alter table public.pile_serial add column if not exists last_return_voucher_id uuid null;
alter table public.pile_serial add column if not exists public_trace_enabled boolean not null default true;
alter table public.pile_serial add column if not exists notes text null;
alter table public.pile_serial add column if not exists created_at timestamptz not null default now();
alter table public.pile_serial add column if not exists updated_at timestamptz not null default now();
alter table public.pile_serial add column if not exists is_active boolean not null default true;

create index if not exists idx_pile_serial_lot_id on public.pile_serial(lot_id);
create index if not exists idx_pile_serial_order_id on public.pile_serial(order_id);
create index if not exists idx_pile_serial_status on public.pile_serial(lifecycle_status, qc_status, disposition_status);
create index if not exists idx_pile_serial_location on public.pile_serial(current_location_id);

create table if not exists public.pile_serial_history (
  history_id uuid primary key default gen_random_uuid(),
  serial_id uuid not null references public.pile_serial(serial_id) on delete cascade,
  event_type text not null,
  from_lifecycle_status text null,
  to_lifecycle_status text null,
  from_qc_status text null,
  to_qc_status text null,
  from_disposition_status text null,
  to_disposition_status text null,
  from_location_id uuid null references public.warehouse_location(location_id),
  to_location_id uuid null references public.warehouse_location(location_id),
  ref_type text null,
  ref_id uuid null,
  note text null,
  changed_by uuid null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_pile_serial_history_serial_id
  on public.pile_serial_history(serial_id, changed_at desc);

create table if not exists public.pile_serial_move (
  move_id uuid primary key default gen_random_uuid(),
  serial_id uuid not null references public.pile_serial(serial_id) on delete cascade,
  from_location_id uuid null references public.warehouse_location(location_id),
  to_location_id uuid not null references public.warehouse_location(location_id),
  moved_by uuid null,
  moved_at timestamptz not null default now(),
  note text null
);

create index if not exists idx_pile_serial_move_serial_id
  on public.pile_serial_move(serial_id, moved_at desc);

create table if not exists public.shipment_voucher_serial (
  voucher_serial_id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.phieu_xuat_ban(voucher_id) on delete cascade,
  voucher_line_id uuid not null,
  serial_id uuid not null references public.pile_serial(serial_id) on delete cascade,
  reserved_at timestamptz null,
  confirmed_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_shipment_voucher_serial
  on public.shipment_voucher_serial(voucher_line_id, serial_id);

create index if not exists idx_shipment_voucher_serial_voucher on public.shipment_voucher_serial(voucher_id);
create index if not exists idx_shipment_voucher_serial_serial on public.shipment_voucher_serial(serial_id);

create table if not exists public.return_voucher (
  return_voucher_id uuid primary key default gen_random_uuid(),
  shipment_voucher_id uuid not null references public.phieu_xuat_ban(voucher_id) on delete cascade,
  kh_id uuid null,
  da_id uuid null,
  order_id uuid null,
  ghi_chu text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_return_voucher_shipment on public.return_voucher(shipment_voucher_id);

create table if not exists public.return_voucher_serial (
  return_serial_id uuid primary key default gen_random_uuid(),
  return_voucher_id uuid not null references public.return_voucher(return_voucher_id) on delete cascade,
  shipment_voucher_id uuid not null references public.phieu_xuat_ban(voucher_id) on delete cascade,
  serial_id uuid not null references public.pile_serial(serial_id) on delete cascade,
  resolution_status text not null,
  visible_in_project boolean not null default false,
  visible_in_retail boolean not null default false,
  note text null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_return_voucher_serial_once
  on public.return_voucher_serial(return_voucher_id, serial_id);
create index if not exists idx_return_voucher_serial_shipment on public.return_voucher_serial(shipment_voucher_id);
create index if not exists idx_return_voucher_serial_serial on public.return_voucher_serial(serial_id);

alter table public.production_lot enable row level security;
alter table public.warehouse_location enable row level security;
alter table public.pile_serial enable row level security;
alter table public.pile_serial_history enable row level security;
alter table public.pile_serial_move enable row level security;
alter table public.shipment_voucher_serial enable row level security;
alter table public.return_voucher enable row level security;
alter table public.return_voucher_serial enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.production_lot to authenticated;
grant select, insert, update on public.warehouse_location to authenticated;
grant select, insert, update on public.pile_serial to authenticated;
grant select, insert, update on public.pile_serial_history to authenticated;
grant select, insert, update on public.pile_serial_move to authenticated;
grant select, insert, update on public.shipment_voucher_serial to authenticated;
grant select, insert, update on public.return_voucher to authenticated;
grant select, insert, update on public.return_voucher_serial to authenticated;

drop policy if exists production_lot_all_authenticated on public.production_lot;
drop policy if exists warehouse_location_all_authenticated on public.warehouse_location;
drop policy if exists pile_serial_all_authenticated on public.pile_serial;
drop policy if exists pile_serial_history_all_authenticated on public.pile_serial_history;
drop policy if exists pile_serial_move_all_authenticated on public.pile_serial_move;
drop policy if exists shipment_voucher_serial_all_authenticated on public.shipment_voucher_serial;
drop policy if exists return_voucher_all_authenticated on public.return_voucher;
drop policy if exists return_voucher_serial_all_authenticated on public.return_voucher_serial;

create policy production_lot_all_authenticated on public.production_lot
for all to authenticated using (true) with check (true);

create policy warehouse_location_all_authenticated on public.warehouse_location
for all to authenticated using (true) with check (true);

create policy pile_serial_all_authenticated on public.pile_serial
for all to authenticated using (true) with check (true);

create policy pile_serial_history_all_authenticated on public.pile_serial_history
for all to authenticated using (true) with check (true);

create policy pile_serial_move_all_authenticated on public.pile_serial_move
for all to authenticated using (true) with check (true);

create policy shipment_voucher_serial_all_authenticated on public.shipment_voucher_serial
for all to authenticated using (true) with check (true);

create policy return_voucher_all_authenticated on public.return_voucher
for all to authenticated using (true) with check (true);

create policy return_voucher_serial_all_authenticated on public.return_voucher_serial
for all to authenticated using (true) with check (true);
