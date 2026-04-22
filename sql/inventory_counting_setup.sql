create extension if not exists pgcrypto;

create table if not exists public.inventory_count_sheet (
  count_sheet_id uuid primary key default gen_random_uuid(),
  count_sheet_code text not null unique,
  count_type text not null default 'OPERATIONAL',
  scope_type text not null default 'SELECTED_ITEMS',
  warehouse_id text null,
  location_id text null,
  count_date date not null,
  status text not null default 'NHAP',
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  warehouse_confirmed_by uuid null,
  warehouse_confirmed_at timestamptz null,
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null
);

alter table public.inventory_count_sheet add column if not exists count_sheet_code text;
alter table public.inventory_count_sheet add column if not exists count_type text not null default 'OPERATIONAL';
alter table public.inventory_count_sheet add column if not exists scope_type text not null default 'SELECTED_ITEMS';
alter table public.inventory_count_sheet add column if not exists warehouse_id text null;
alter table public.inventory_count_sheet add column if not exists location_id text null;
alter table public.inventory_count_sheet add column if not exists count_date date;
alter table public.inventory_count_sheet add column if not exists status text not null default 'NHAP';
alter table public.inventory_count_sheet add column if not exists note text null;
alter table public.inventory_count_sheet add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.inventory_count_sheet add column if not exists is_active boolean not null default true;
alter table public.inventory_count_sheet add column if not exists deleted_at timestamptz null;
alter table public.inventory_count_sheet add column if not exists created_at timestamptz not null default now();
alter table public.inventory_count_sheet add column if not exists updated_at timestamptz not null default now();
alter table public.inventory_count_sheet add column if not exists created_by uuid null;
alter table public.inventory_count_sheet add column if not exists updated_by uuid null;
alter table public.inventory_count_sheet add column if not exists warehouse_confirmed_by uuid null;
alter table public.inventory_count_sheet add column if not exists warehouse_confirmed_at timestamptz null;
alter table public.inventory_count_sheet add column if not exists approved_by uuid null;
alter table public.inventory_count_sheet add column if not exists approved_at timestamptz null;
alter table public.inventory_count_sheet add column if not exists posted_by uuid null;
alter table public.inventory_count_sheet add column if not exists posted_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_count_sheet_type_check'
  ) then
    alter table public.inventory_count_sheet
      add constraint inventory_count_sheet_type_check
      check (count_type in ('OPENING_BALANCE', 'OPERATIONAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_count_sheet_scope_check'
  ) then
    alter table public.inventory_count_sheet
      add constraint inventory_count_sheet_scope_check
      check (scope_type in ('FULL_WAREHOUSE', 'MATERIAL_GROUP', 'SELECTED_ITEMS', 'SELECTED_LOCATION', 'SELECTED_PO_CONTEXT'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_count_sheet_status_check'
  ) then
    alter table public.inventory_count_sheet
      add constraint inventory_count_sheet_status_check
      check (status in ('NHAP', 'CHO_XAC_NHAN_KHO', 'CHO_DUYET_CHENH_LECH', 'DA_DUYET', 'DA_DIEU_CHINH_TON', 'HUY'));
  end if;
end $$;

create index if not exists inventory_count_sheet_status_idx
  on public.inventory_count_sheet (status, count_date desc);

create index if not exists inventory_count_sheet_type_idx
  on public.inventory_count_sheet (count_type, count_date desc);

create table if not exists public.inventory_count_line (
  count_line_id uuid primary key default gen_random_uuid(),
  count_sheet_id uuid not null references public.inventory_count_sheet(count_sheet_id) on delete cascade,
  line_no integer not null,
  item_type text not null,
  item_id text null,
  item_code text not null,
  item_name text not null,
  item_group text null,
  unit text null,
  warehouse_id text null,
  location_id text null,
  system_qty numeric(18,3) not null default 0,
  counted_qty numeric(18,3) not null default 0,
  variance_qty numeric(18,3) not null default 0,
  variance_pct numeric(18,4) not null default 0,
  allowed_loss_pct numeric(18,4) not null default 0,
  cost_classification text null,
  reason_code text null,
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.inventory_count_line add column if not exists count_sheet_id uuid;
alter table public.inventory_count_line add column if not exists line_no integer not null default 1;
alter table public.inventory_count_line add column if not exists item_type text;
alter table public.inventory_count_line add column if not exists item_id text null;
alter table public.inventory_count_line add column if not exists item_code text;
alter table public.inventory_count_line add column if not exists item_name text;
alter table public.inventory_count_line add column if not exists item_group text null;
alter table public.inventory_count_line add column if not exists unit text null;
alter table public.inventory_count_line add column if not exists warehouse_id text null;
alter table public.inventory_count_line add column if not exists location_id text null;
alter table public.inventory_count_line add column if not exists system_qty numeric(18,3) not null default 0;
alter table public.inventory_count_line add column if not exists counted_qty numeric(18,3) not null default 0;
alter table public.inventory_count_line add column if not exists variance_qty numeric(18,3) not null default 0;
alter table public.inventory_count_line add column if not exists variance_pct numeric(18,4) not null default 0;
alter table public.inventory_count_line add column if not exists allowed_loss_pct numeric(18,4) not null default 0;
alter table public.inventory_count_line add column if not exists cost_classification text null;
alter table public.inventory_count_line add column if not exists reason_code text null;
alter table public.inventory_count_line add column if not exists note text null;
alter table public.inventory_count_line add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.inventory_count_line add column if not exists is_active boolean not null default true;
alter table public.inventory_count_line add column if not exists deleted_at timestamptz null;
alter table public.inventory_count_line add column if not exists created_at timestamptz not null default now();
alter table public.inventory_count_line add column if not exists updated_at timestamptz not null default now();
alter table public.inventory_count_line add column if not exists created_by uuid null;
alter table public.inventory_count_line add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_count_line_item_type_check'
  ) then
    alter table public.inventory_count_line
      add constraint inventory_count_line_item_type_check
      check (item_type in ('NVL', 'FINISHED_GOOD', 'TOOL', 'ASSET'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_count_line_cost_classification_check'
  ) then
    alter table public.inventory_count_line
      add constraint inventory_count_line_cost_classification_check
      check (cost_classification is null or cost_classification in ('CHI_PHI_QUAN_LY', 'CHI_PHI_THAT_THOAT', 'TON_TANG', 'KHONG_AP_DUNG'));
  end if;
end $$;

create unique index if not exists inventory_count_line_unique
  on public.inventory_count_line (count_sheet_id, line_no);

create index if not exists inventory_count_line_item_code_idx
  on public.inventory_count_line (item_code);

create index if not exists inventory_count_line_item_type_group_idx
  on public.inventory_count_line (item_type, item_group);

create table if not exists public.inventory_count_serial (
  count_serial_id uuid primary key default gen_random_uuid(),
  count_sheet_id uuid not null references public.inventory_count_sheet(count_sheet_id) on delete cascade,
  count_line_id uuid not null references public.inventory_count_line(count_line_id) on delete cascade,
  serial_id uuid null,
  serial_code text not null,
  count_status text not null default 'COUNTED',
  system_location_id text null,
  counted_location_id text null,
  note text null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null
);

alter table public.inventory_count_serial add column if not exists count_sheet_id uuid;
alter table public.inventory_count_serial add column if not exists count_line_id uuid;
alter table public.inventory_count_serial add column if not exists serial_id uuid null;
alter table public.inventory_count_serial add column if not exists serial_code text;
alter table public.inventory_count_serial add column if not exists count_status text not null default 'COUNTED';
alter table public.inventory_count_serial add column if not exists system_location_id text null;
alter table public.inventory_count_serial add column if not exists counted_location_id text null;
alter table public.inventory_count_serial add column if not exists note text null;
alter table public.inventory_count_serial add column if not exists payload_json jsonb not null default '{}'::jsonb;
alter table public.inventory_count_serial add column if not exists created_at timestamptz not null default now();
alter table public.inventory_count_serial add column if not exists updated_at timestamptz not null default now();
alter table public.inventory_count_serial add column if not exists created_by uuid null;
alter table public.inventory_count_serial add column if not exists updated_by uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_count_serial_status_check'
  ) then
    alter table public.inventory_count_serial
      add constraint inventory_count_serial_status_check
      check (count_status in ('COUNTED', 'MISSING_IN_COUNT', 'UNEXPECTED_FOUND', 'WRONG_LOCATION'));
  end if;
end $$;

create index if not exists inventory_count_serial_sheet_idx
  on public.inventory_count_serial (count_sheet_id);

create index if not exists inventory_count_serial_line_idx
  on public.inventory_count_serial (count_line_id);

create index if not exists inventory_count_serial_code_idx
  on public.inventory_count_serial (serial_code);

alter table public.inventory_count_sheet enable row level security;
alter table public.inventory_count_line enable row level security;
alter table public.inventory_count_serial enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_count_sheet' and policyname = 'inventory_count_sheet_authenticated'
  ) then
    create policy inventory_count_sheet_authenticated on public.inventory_count_sheet
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_count_line' and policyname = 'inventory_count_line_authenticated'
  ) then
    create policy inventory_count_line_authenticated on public.inventory_count_line
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_count_serial' and policyname = 'inventory_count_serial_authenticated'
  ) then
    create policy inventory_count_serial_authenticated on public.inventory_count_serial
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
