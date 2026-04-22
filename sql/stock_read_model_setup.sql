create extension if not exists pgcrypto;

create table if not exists public.stock_read_model_health (
  model_name text primary key,
  is_verified boolean not null default false,
  source_row_count integer not null default 0,
  read_model_row_count integer not null default 0,
  mismatch_count integer not null default 0,
  verified_at timestamptz null,
  refreshed_at timestamptz null,
  note text null
);

create table if not exists public.finished_goods_stock_summary (
  item_key text primary key,
  item_label text not null,
  loai_coc text not null,
  ten_doan text not null,
  chieu_dai_m numeric(12,3) not null default 0,
  physical_qty integer not null default 0,
  project_qty integer not null default 0,
  retail_qty integer not null default 0,
  hold_qty integer not null default 0,
  lot_count integer not null default 0,
  latest_production_date date null,
  legacy_shipment_gap_qty integer not null default 0,
  refreshed_at timestamptz not null default now()
);

create index if not exists finished_goods_stock_summary_qty_idx
  on public.finished_goods_stock_summary (physical_qty desc, item_label);

create index if not exists finished_goods_stock_summary_item_lookup_idx
  on public.finished_goods_stock_summary (loai_coc, ten_doan, chieu_dai_m);

create table if not exists public.material_stock_balance (
  material_code text primary key,
  material_name text not null,
  unit text null,
  stock_qty numeric(18,3) not null default 0,
  available_qty numeric(18,3) not null default 0,
  blocked_qty numeric(18,3) not null default 0,
  defective_qty numeric(18,3) not null default 0,
  last_movement_date date null,
  refreshed_at timestamptz not null default now()
);

create index if not exists material_stock_balance_qty_idx
  on public.material_stock_balance (stock_qty desc, material_name);

alter table public.stock_read_model_health enable row level security;
alter table public.finished_goods_stock_summary enable row level security;
alter table public.material_stock_balance enable row level security;

grant select, insert, update, delete on public.stock_read_model_health to authenticated;
grant select, insert, update, delete on public.finished_goods_stock_summary to authenticated;
grant select, insert, update, delete on public.material_stock_balance to authenticated;

drop policy if exists stock_read_model_health_all_authenticated on public.stock_read_model_health;
drop policy if exists finished_goods_stock_summary_all_authenticated on public.finished_goods_stock_summary;
drop policy if exists material_stock_balance_all_authenticated on public.material_stock_balance;
drop policy if exists stock_read_model_health_select_authenticated on public.stock_read_model_health;
drop policy if exists stock_read_model_health_write_admin on public.stock_read_model_health;
drop policy if exists finished_goods_stock_summary_select_authenticated on public.finished_goods_stock_summary;
drop policy if exists finished_goods_stock_summary_write_admin on public.finished_goods_stock_summary;
drop policy if exists material_stock_balance_select_authenticated on public.material_stock_balance;
drop policy if exists material_stock_balance_write_admin on public.material_stock_balance;

do $$
begin
  if to_regclass('public.pile_serial') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_pile_serial on public.pile_serial;
  end if;

  if to_regclass('public.production_lot') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_production_lot on public.production_lot;
  end if;

  if to_regclass('public.phieu_xuat_ban') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_phieu_xuat_ban on public.phieu_xuat_ban;
  end if;

  if to_regclass('public.shipment_voucher_serial') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_shipment_serial on public.shipment_voucher_serial;
  end if;

  if to_regclass('public.return_voucher_serial') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_return_serial on public.return_voucher_serial;
  end if;

  if to_regclass('public.material_stock_movement') is not null then
    drop trigger if exists invalidate_nvl_stock_on_movement on public.material_stock_movement;
  end if;

  if to_regclass('public.material_issue_voucher') is not null then
    drop trigger if exists invalidate_nvl_stock_on_issue_header on public.material_issue_voucher;
  end if;

  if to_regclass('public.material_issue_voucher_line') is not null then
    drop trigger if exists invalidate_nvl_stock_on_issue_line on public.material_issue_voucher_line;
  end if;

  if to_regclass('public.nvl') is not null then
    drop trigger if exists invalidate_nvl_stock_on_nvl on public.nvl;
  end if;
end $$;

create policy stock_read_model_health_select_authenticated on public.stock_read_model_health
  for select to authenticated
  using (true);

create policy stock_read_model_health_write_admin on public.stock_read_model_health
  for all to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and is_active = true
      and lower(role) in (
        'admin',
        'qlsx',
        'quan ly san xuat',
        'thu kho',
        'thukho',
        'warehouse',
        'kiem ke vien',
        'kiemke vien',
        'kiem ke',
        'inventory counter',
        'ktmh',
        'ke toan mua hang',
        'ketoan mua hang',
        'mua hang',
        'purchasing'
      )
  ))
  with check (exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and is_active = true
      and lower(role) in (
        'admin',
        'qlsx',
        'quan ly san xuat',
        'thu kho',
        'thukho',
        'warehouse',
        'kiem ke vien',
        'kiemke vien',
        'kiem ke',
        'inventory counter',
        'ktmh',
        'ke toan mua hang',
        'ketoan mua hang',
        'mua hang',
        'purchasing'
      )
  ));

create policy finished_goods_stock_summary_select_authenticated on public.finished_goods_stock_summary
  for select to authenticated
  using (true);

create policy finished_goods_stock_summary_write_admin on public.finished_goods_stock_summary
  for all to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and is_active = true
      and lower(role) in (
        'admin',
        'qlsx',
        'quan ly san xuat',
        'thu kho',
        'thukho',
        'warehouse',
        'kiem ke vien',
        'kiemke vien',
        'kiem ke',
        'inventory counter',
        'ktmh',
        'ke toan mua hang',
        'ketoan mua hang',
        'mua hang',
        'purchasing'
      )
  ))
  with check (exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and is_active = true
      and lower(role) in (
        'admin',
        'qlsx',
        'quan ly san xuat',
        'thu kho',
        'thukho',
        'warehouse',
        'kiem ke vien',
        'kiemke vien',
        'kiem ke',
        'inventory counter',
        'ktmh',
        'ke toan mua hang',
        'ketoan mua hang',
        'mua hang',
        'purchasing'
      )
  ));

create policy material_stock_balance_select_authenticated on public.material_stock_balance
  for select to authenticated
  using (true);

create policy material_stock_balance_write_admin on public.material_stock_balance
  for all to authenticated
  using (exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and is_active = true
      and lower(role) in (
        'admin',
        'qlsx',
        'quan ly san xuat',
        'thu kho',
        'thukho',
        'warehouse',
        'kiem ke vien',
        'kiemke vien',
        'kiem ke',
        'inventory counter',
        'ktmh',
        'ke toan mua hang',
        'ketoan mua hang',
        'mua hang',
        'purchasing'
      )
  ))
  with check (exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and is_active = true
      and lower(role) in (
        'admin',
        'qlsx',
        'quan ly san xuat',
        'thu kho',
        'thukho',
        'warehouse',
        'kiem ke vien',
        'kiemke vien',
        'kiem ke',
        'inventory counter',
        'ktmh',
        'ke toan mua hang',
        'ketoan mua hang',
        'mua hang',
        'purchasing'
      )
  ));

drop function if exists public.invalidate_stock_read_model(text);
drop function if exists public.invalidate_stock_read_model();
drop function if exists public.invalidate_stock_read_model_v2();

create function public.invalidate_stock_read_model_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stock_read_model_health
  set
    is_verified = false,
    verified_at = null,
    note = 'Invalidated by source table change: ' || tg_table_name
  where model_name = tg_argv[0];

  return coalesce(new, old);
end;
$$;

do $$
begin
  if to_regclass('public.pile_serial') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_pile_serial on public.pile_serial;
    create trigger invalidate_finished_goods_stock_on_pile_serial
    after insert or update or delete on public.pile_serial
    for each statement execute function public.invalidate_stock_read_model_v2('finished_goods_stock_summary');
  end if;

  if to_regclass('public.production_lot') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_production_lot on public.production_lot;
    create trigger invalidate_finished_goods_stock_on_production_lot
    after insert or update or delete on public.production_lot
    for each statement execute function public.invalidate_stock_read_model_v2('finished_goods_stock_summary');
  end if;

  if to_regclass('public.phieu_xuat_ban') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_phieu_xuat_ban on public.phieu_xuat_ban;
    create trigger invalidate_finished_goods_stock_on_phieu_xuat_ban
    after insert or update or delete on public.phieu_xuat_ban
    for each statement execute function public.invalidate_stock_read_model_v2('finished_goods_stock_summary');
  end if;

  if to_regclass('public.shipment_voucher_serial') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_shipment_serial on public.shipment_voucher_serial;
    create trigger invalidate_finished_goods_stock_on_shipment_serial
    after insert or update or delete on public.shipment_voucher_serial
    for each statement execute function public.invalidate_stock_read_model_v2('finished_goods_stock_summary');
  end if;

  if to_regclass('public.return_voucher_serial') is not null then
    drop trigger if exists invalidate_finished_goods_stock_on_return_serial on public.return_voucher_serial;
    create trigger invalidate_finished_goods_stock_on_return_serial
    after insert or update or delete on public.return_voucher_serial
    for each statement execute function public.invalidate_stock_read_model_v2('finished_goods_stock_summary');
  end if;

  if to_regclass('public.material_stock_movement') is not null then
    drop trigger if exists invalidate_nvl_stock_on_movement on public.material_stock_movement;
    create trigger invalidate_nvl_stock_on_movement
    after insert or update or delete on public.material_stock_movement
    for each statement execute function public.invalidate_stock_read_model_v2('material_stock_balance');
  end if;

  if to_regclass('public.material_issue_voucher') is not null then
    drop trigger if exists invalidate_nvl_stock_on_issue_header on public.material_issue_voucher;
    create trigger invalidate_nvl_stock_on_issue_header
    after insert or update or delete on public.material_issue_voucher
    for each statement execute function public.invalidate_stock_read_model_v2('material_stock_balance');
  end if;

  if to_regclass('public.material_issue_voucher_line') is not null then
    drop trigger if exists invalidate_nvl_stock_on_issue_line on public.material_issue_voucher_line;
    create trigger invalidate_nvl_stock_on_issue_line
    after insert or update or delete on public.material_issue_voucher_line
    for each statement execute function public.invalidate_stock_read_model_v2('material_stock_balance');
  end if;

  if to_regclass('public.nvl') is not null then
    drop trigger if exists invalidate_nvl_stock_on_nvl on public.nvl;
    create trigger invalidate_nvl_stock_on_nvl
    after insert or update or delete on public.nvl
    for each statement execute function public.invalidate_stock_read_model_v2('material_stock_balance');
  end if;
end $$;
