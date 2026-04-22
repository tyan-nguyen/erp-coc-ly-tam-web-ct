create extension if not exists pgcrypto;

create table if not exists public.material_purchase_request (
  request_id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  status text not null default 'DRAFT',
  source_mode text not null default 'LIVE_DEMAND_ONLY',
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.material_purchase_request add column if not exists request_code text;
alter table public.material_purchase_request add column if not exists status text not null default 'DRAFT';
alter table public.material_purchase_request add column if not exists source_mode text not null default 'LIVE_DEMAND_ONLY';
alter table public.material_purchase_request add column if not exists note text null;
alter table public.material_purchase_request add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_purchase_request add column if not exists is_active boolean not null default true;
alter table public.material_purchase_request add column if not exists deleted_at timestamptz null;
alter table public.material_purchase_request add column if not exists created_at timestamptz not null default now();
alter table public.material_purchase_request add column if not exists updated_at timestamptz not null default now();
alter table public.material_purchase_request add column if not exists created_by uuid null;
alter table public.material_purchase_request add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_request_status_check'
  ) then
    alter table public.material_purchase_request
      add constraint material_purchase_request_status_check
      check (status in ('DRAFT', 'CHO_DUYET', 'DA_DUYET', 'TU_CHOI', 'DA_CHUYEN_DAT_HANG'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_request_source_mode_check'
  ) then
    alter table public.material_purchase_request
      add constraint material_purchase_request_source_mode_check
      check (source_mode in ('LIVE_DEMAND_ONLY', 'FULL'));
  end if;
end $$;

create unique index if not exists material_purchase_request_code_unique
  on public.material_purchase_request (request_code);

create index if not exists material_purchase_request_created_at_idx
  on public.material_purchase_request (created_at desc);

create index if not exists material_purchase_request_active_idx
  on public.material_purchase_request (is_active, created_at desc);

create table if not exists public.material_purchase_request_line (
  request_line_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.material_purchase_request(request_id) on delete cascade,
  line_no integer not null,
  material_code text not null,
  material_name text not null,
  unit text null,
  proposed_qty numeric(18,3) not null default 0,
  plan_count integer not null default 0,
  window_label text null,
  basis_label text null,
  urgency_label text null,
  status text not null default 'DRAFT',
  source_mode text not null default 'LIVE_DEMAND_ONLY',
  reason text null,
  explanation text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.material_purchase_request_line add column if not exists request_id uuid;
alter table public.material_purchase_request_line add column if not exists line_no integer not null default 1;
alter table public.material_purchase_request_line add column if not exists material_code text;
alter table public.material_purchase_request_line add column if not exists material_name text;
alter table public.material_purchase_request_line add column if not exists unit text null;
alter table public.material_purchase_request_line add column if not exists proposed_qty numeric(18,3) not null default 0;
alter table public.material_purchase_request_line add column if not exists plan_count integer not null default 0;
alter table public.material_purchase_request_line add column if not exists window_label text null;
alter table public.material_purchase_request_line add column if not exists basis_label text null;
alter table public.material_purchase_request_line add column if not exists urgency_label text null;
alter table public.material_purchase_request_line add column if not exists status text not null default 'DRAFT';
alter table public.material_purchase_request_line add column if not exists source_mode text not null default 'LIVE_DEMAND_ONLY';
alter table public.material_purchase_request_line add column if not exists reason text null;
alter table public.material_purchase_request_line add column if not exists explanation text null;
alter table public.material_purchase_request_line add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_purchase_request_line add column if not exists is_active boolean not null default true;
alter table public.material_purchase_request_line add column if not exists deleted_at timestamptz null;
alter table public.material_purchase_request_line add column if not exists created_at timestamptz not null default now();
alter table public.material_purchase_request_line add column if not exists updated_at timestamptz not null default now();
alter table public.material_purchase_request_line add column if not exists created_by uuid null;
alter table public.material_purchase_request_line add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_request_line_status_check'
  ) then
    alter table public.material_purchase_request_line
      add constraint material_purchase_request_line_status_check
      check (status in ('DRAFT', 'CHO_DUYET', 'DA_DUYET', 'TU_CHOI', 'DA_CHUYEN_DAT_HANG'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_request_line_source_mode_check'
  ) then
    alter table public.material_purchase_request_line
      add constraint material_purchase_request_line_source_mode_check
      check (source_mode in ('LIVE_DEMAND_ONLY', 'FULL'));
  end if;
end $$;

create unique index if not exists material_purchase_request_line_unique
  on public.material_purchase_request_line (request_id, line_no);

create index if not exists material_purchase_request_line_material_idx
  on public.material_purchase_request_line (material_code);

create table if not exists public.material_purchase_order (
  po_id uuid primary key default gen_random_uuid(),
  po_code text not null unique,
  request_id uuid null references public.material_purchase_request(request_id) on delete set null,
  request_code text null,
  vendor_name text null,
  expected_date date null,
  status text not null default 'DRAFT',
  source_mode text not null default 'LIVE_DEMAND_ONLY',
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.material_purchase_order add column if not exists po_code text;
alter table public.material_purchase_order add column if not exists request_id uuid null;
alter table public.material_purchase_order add column if not exists request_code text null;
alter table public.material_purchase_order add column if not exists vendor_name text null;
alter table public.material_purchase_order add column if not exists expected_date date null;
alter table public.material_purchase_order add column if not exists status text not null default 'DRAFT';
alter table public.material_purchase_order add column if not exists source_mode text not null default 'LIVE_DEMAND_ONLY';
alter table public.material_purchase_order add column if not exists note text null;
alter table public.material_purchase_order add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_purchase_order add column if not exists is_active boolean not null default true;
alter table public.material_purchase_order add column if not exists deleted_at timestamptz null;
alter table public.material_purchase_order add column if not exists created_at timestamptz not null default now();
alter table public.material_purchase_order add column if not exists updated_at timestamptz not null default now();
alter table public.material_purchase_order add column if not exists created_by uuid null;
alter table public.material_purchase_order add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_order_status_check'
  ) then
    alter table public.material_purchase_order
      add constraint material_purchase_order_status_check
      check (status in ('DRAFT', 'DA_GUI_NCC', 'XAC_NHAN_MOT_PHAN', 'DA_NHAN_MOT_PHAN', 'DA_NHAN_DU', 'HUY'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_order_source_mode_check'
  ) then
    alter table public.material_purchase_order
      add constraint material_purchase_order_source_mode_check
      check (source_mode in ('LIVE_DEMAND_ONLY', 'FULL'));
  end if;
end $$;

create unique index if not exists material_purchase_order_code_unique
  on public.material_purchase_order (po_code);

create index if not exists material_purchase_order_request_idx
  on public.material_purchase_order (request_id);

create index if not exists material_purchase_order_created_at_idx
  on public.material_purchase_order (created_at desc);

create table if not exists public.material_purchase_order_line (
  po_line_id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.material_purchase_order(po_id) on delete cascade,
  request_id uuid null references public.material_purchase_request(request_id) on delete set null,
  request_line_id uuid null references public.material_purchase_request_line(request_line_id) on delete set null,
  line_no integer not null,
  material_code text not null,
  material_name text not null,
  unit text null,
  ordered_qty numeric(18,3) not null default 0,
  status text not null default 'DRAFT',
  source_mode text not null default 'LIVE_DEMAND_ONLY',
  reason text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.material_purchase_order_line add column if not exists po_id uuid;
alter table public.material_purchase_order_line add column if not exists request_id uuid null;
alter table public.material_purchase_order_line add column if not exists request_line_id uuid null;
alter table public.material_purchase_order_line add column if not exists line_no integer not null default 1;
alter table public.material_purchase_order_line add column if not exists material_code text;
alter table public.material_purchase_order_line add column if not exists material_name text;
alter table public.material_purchase_order_line add column if not exists unit text null;
alter table public.material_purchase_order_line add column if not exists ordered_qty numeric(18,3) not null default 0;
alter table public.material_purchase_order_line add column if not exists status text not null default 'DRAFT';
alter table public.material_purchase_order_line add column if not exists source_mode text not null default 'LIVE_DEMAND_ONLY';
alter table public.material_purchase_order_line add column if not exists reason text null;
alter table public.material_purchase_order_line add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_purchase_order_line add column if not exists is_active boolean not null default true;
alter table public.material_purchase_order_line add column if not exists deleted_at timestamptz null;
alter table public.material_purchase_order_line add column if not exists created_at timestamptz not null default now();
alter table public.material_purchase_order_line add column if not exists updated_at timestamptz not null default now();
alter table public.material_purchase_order_line add column if not exists created_by uuid null;
alter table public.material_purchase_order_line add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_order_line_status_check'
  ) then
    alter table public.material_purchase_order_line
      add constraint material_purchase_order_line_status_check
      check (status in ('DRAFT', 'DA_GUI_NCC', 'XAC_NHAN_MOT_PHAN', 'DA_NHAN_MOT_PHAN', 'DA_NHAN_DU', 'HUY'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_order_line_source_mode_check'
  ) then
    alter table public.material_purchase_order_line
      add constraint material_purchase_order_line_source_mode_check
      check (source_mode in ('LIVE_DEMAND_ONLY', 'FULL'));
  end if;
end $$;

create unique index if not exists material_purchase_order_line_unique
  on public.material_purchase_order_line (po_id, line_no);

create index if not exists material_purchase_order_line_material_idx
  on public.material_purchase_order_line (material_code);

create table if not exists public.material_purchase_receipt (
  receipt_id uuid primary key default gen_random_uuid(),
  receipt_code text not null unique,
  po_id uuid not null references public.material_purchase_order(po_id) on delete cascade,
  po_code text null,
  vendor_name text null,
  batch_no integer not null default 1,
  status text not null default 'DRAFT',
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.material_purchase_receipt add column if not exists receipt_code text;
alter table public.material_purchase_receipt add column if not exists po_id uuid;
alter table public.material_purchase_receipt add column if not exists po_code text null;
alter table public.material_purchase_receipt add column if not exists vendor_name text null;
alter table public.material_purchase_receipt add column if not exists batch_no integer not null default 1;
alter table public.material_purchase_receipt add column if not exists status text not null default 'DRAFT';
alter table public.material_purchase_receipt add column if not exists note text null;
alter table public.material_purchase_receipt add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_purchase_receipt add column if not exists is_active boolean not null default true;
alter table public.material_purchase_receipt add column if not exists deleted_at timestamptz null;
alter table public.material_purchase_receipt add column if not exists created_at timestamptz not null default now();
alter table public.material_purchase_receipt add column if not exists updated_at timestamptz not null default now();
alter table public.material_purchase_receipt add column if not exists created_by uuid null;
alter table public.material_purchase_receipt add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_receipt_status_check'
  ) then
    alter table public.material_purchase_receipt
      add constraint material_purchase_receipt_status_check
      check (status in ('DRAFT', 'DA_NHAN', 'DA_NHAN_MOT_PHAN', 'DA_XU_LY_LOI'));
  end if;
end $$;

create unique index if not exists material_purchase_receipt_code_unique
  on public.material_purchase_receipt (receipt_code);

create unique index if not exists material_purchase_receipt_po_batch_unique
  on public.material_purchase_receipt (po_id, batch_no);

create index if not exists material_purchase_receipt_created_at_idx
  on public.material_purchase_receipt (created_at desc);

create table if not exists public.material_purchase_receipt_line (
  receipt_line_id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_purchase_receipt(receipt_id) on delete cascade,
  po_id uuid not null references public.material_purchase_order(po_id) on delete cascade,
  po_line_id uuid null references public.material_purchase_order_line(po_line_id) on delete set null,
  line_no integer not null,
  material_code text not null,
  material_name text not null,
  unit text null,
  ordered_qty numeric(18,3) not null default 0,
  received_qty numeric(18,3) not null default 0,
  accepted_qty numeric(18,3) not null default 0,
  defective_qty numeric(18,3) not null default 0,
  rejected_qty numeric(18,3) not null default 0,
  status text not null default 'DRAFT',
  source_mode text not null default 'LIVE_DEMAND_ONLY',
  reason text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.material_purchase_receipt_line add column if not exists receipt_id uuid;
alter table public.material_purchase_receipt_line add column if not exists po_id uuid;
alter table public.material_purchase_receipt_line add column if not exists po_line_id uuid null;
alter table public.material_purchase_receipt_line add column if not exists line_no integer not null default 1;
alter table public.material_purchase_receipt_line add column if not exists material_code text;
alter table public.material_purchase_receipt_line add column if not exists material_name text;
alter table public.material_purchase_receipt_line add column if not exists unit text null;
alter table public.material_purchase_receipt_line add column if not exists ordered_qty numeric(18,3) not null default 0;
alter table public.material_purchase_receipt_line add column if not exists received_qty numeric(18,3) not null default 0;
alter table public.material_purchase_receipt_line add column if not exists accepted_qty numeric(18,3) not null default 0;
alter table public.material_purchase_receipt_line add column if not exists defective_qty numeric(18,3) not null default 0;
alter table public.material_purchase_receipt_line add column if not exists rejected_qty numeric(18,3) not null default 0;
alter table public.material_purchase_receipt_line add column if not exists status text not null default 'DRAFT';
alter table public.material_purchase_receipt_line add column if not exists source_mode text not null default 'LIVE_DEMAND_ONLY';
alter table public.material_purchase_receipt_line add column if not exists reason text null;
alter table public.material_purchase_receipt_line add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_purchase_receipt_line add column if not exists is_active boolean not null default true;
alter table public.material_purchase_receipt_line add column if not exists deleted_at timestamptz null;
alter table public.material_purchase_receipt_line add column if not exists created_at timestamptz not null default now();
alter table public.material_purchase_receipt_line add column if not exists updated_at timestamptz not null default now();
alter table public.material_purchase_receipt_line add column if not exists created_by uuid null;
alter table public.material_purchase_receipt_line add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_receipt_line_status_check'
  ) then
    alter table public.material_purchase_receipt_line
      add constraint material_purchase_receipt_line_status_check
      check (status in ('DRAFT', 'DA_NHAN', 'DA_NHAN_MOT_PHAN', 'DA_XU_LY_LOI'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_purchase_receipt_line_source_mode_check'
  ) then
    alter table public.material_purchase_receipt_line
      add constraint material_purchase_receipt_line_source_mode_check
      check (source_mode in ('LIVE_DEMAND_ONLY', 'FULL'));
  end if;
end $$;

create unique index if not exists material_purchase_receipt_line_unique
  on public.material_purchase_receipt_line (receipt_id, line_no);

create index if not exists material_purchase_receipt_line_material_idx
  on public.material_purchase_receipt_line (material_code);

create table if not exists public.material_stock_movement (
  movement_id uuid primary key default gen_random_uuid(),
  movement_type text not null,
  material_code text not null,
  material_name text not null,
  unit text null,
  quantity numeric(18,3) not null default 0,
  physical_effect text not null default 'NONE',
  available_effect text not null default 'NONE',
  blocked_effect text not null default 'NONE',
  quality_effect text not null default 'NONE',
  source_type text not null,
  source_id uuid not null,
  source_line_id uuid null,
  movement_date date not null,
  warehouse_code text not null default 'MAIN',
  warehouse_label text not null default 'Kho NVL',
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null
);

alter table public.material_stock_movement add column if not exists movement_type text;
alter table public.material_stock_movement add column if not exists material_code text;
alter table public.material_stock_movement add column if not exists material_name text;
alter table public.material_stock_movement add column if not exists unit text null;
alter table public.material_stock_movement add column if not exists quantity numeric(18,3) not null default 0;
alter table public.material_stock_movement add column if not exists physical_effect text not null default 'NONE';
alter table public.material_stock_movement add column if not exists available_effect text not null default 'NONE';
alter table public.material_stock_movement add column if not exists blocked_effect text not null default 'NONE';
alter table public.material_stock_movement add column if not exists quality_effect text not null default 'NONE';
alter table public.material_stock_movement add column if not exists source_type text;
alter table public.material_stock_movement add column if not exists source_id uuid;
alter table public.material_stock_movement add column if not exists source_line_id uuid null;
alter table public.material_stock_movement add column if not exists movement_date date;
alter table public.material_stock_movement add column if not exists warehouse_code text not null default 'MAIN';
alter table public.material_stock_movement add column if not exists warehouse_label text not null default 'Kho NVL';
alter table public.material_stock_movement add column if not exists note text null;
alter table public.material_stock_movement add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.material_stock_movement add column if not exists created_at timestamptz not null default now();
alter table public.material_stock_movement add column if not exists created_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_stock_movement_physical_effect_check'
  ) then
    alter table public.material_stock_movement
      add constraint material_stock_movement_physical_effect_check
      check (physical_effect in ('IN', 'OUT', 'NONE'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_stock_movement_available_effect_check'
  ) then
    alter table public.material_stock_movement
      add constraint material_stock_movement_available_effect_check
      check (available_effect in ('ENABLE', 'DISABLE', 'NONE'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_stock_movement_blocked_effect_check'
  ) then
    alter table public.material_stock_movement
      add constraint material_stock_movement_blocked_effect_check
      check (blocked_effect in ('ENABLE', 'DISABLE', 'NONE'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'material_stock_movement_quality_effect_check'
  ) then
    alter table public.material_stock_movement
      add constraint material_stock_movement_quality_effect_check
      check (quality_effect in ('ACCEPTED', 'DEFECTIVE', 'REJECTED', 'NONE'));
  end if;
end $$;

create index if not exists material_stock_movement_material_idx
  on public.material_stock_movement (material_code, movement_date desc, created_at desc);

create index if not exists material_stock_movement_source_idx
  on public.material_stock_movement (source_type, source_id);

create index if not exists material_stock_movement_warehouse_idx
  on public.material_stock_movement (warehouse_code, movement_date desc);

alter table public.material_purchase_request enable row level security;
alter table public.material_purchase_request_line enable row level security;
alter table public.material_purchase_order enable row level security;
alter table public.material_purchase_order_line enable row level security;
alter table public.material_purchase_receipt enable row level security;
alter table public.material_purchase_receipt_line enable row level security;
alter table public.material_stock_movement enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.material_purchase_request to authenticated;
grant select, insert, update, delete on public.material_purchase_request_line to authenticated;
grant select, insert, update, delete on public.material_purchase_order to authenticated;
grant select, insert, update, delete on public.material_purchase_order_line to authenticated;
grant select, insert, update, delete on public.material_purchase_receipt to authenticated;
grant select, insert, update, delete on public.material_purchase_receipt_line to authenticated;
grant select, insert, update, delete on public.material_stock_movement to authenticated;

drop policy if exists material_purchase_request_all_authenticated on public.material_purchase_request;
drop policy if exists material_purchase_request_line_all_authenticated on public.material_purchase_request_line;
drop policy if exists material_purchase_order_all_authenticated on public.material_purchase_order;
drop policy if exists material_purchase_order_line_all_authenticated on public.material_purchase_order_line;
drop policy if exists material_purchase_receipt_all_authenticated on public.material_purchase_receipt;
drop policy if exists material_purchase_receipt_line_all_authenticated on public.material_purchase_receipt_line;
drop policy if exists material_stock_movement_all_authenticated on public.material_stock_movement;

create policy material_purchase_request_all_authenticated on public.material_purchase_request
for all to authenticated
using (true)
with check (true);

create policy material_purchase_request_line_all_authenticated on public.material_purchase_request_line
for all to authenticated
using (true)
with check (true);

create policy material_purchase_order_all_authenticated on public.material_purchase_order
for all to authenticated
using (true)
with check (true);

create policy material_purchase_order_line_all_authenticated on public.material_purchase_order_line
for all to authenticated
using (true)
with check (true);

create policy material_purchase_receipt_all_authenticated on public.material_purchase_receipt
for all to authenticated
using (true)
with check (true);

create policy material_purchase_receipt_line_all_authenticated on public.material_purchase_receipt_line
for all to authenticated
using (true)
with check (true);

create policy material_stock_movement_all_authenticated on public.material_stock_movement
for all to authenticated
using (true)
with check (true);
