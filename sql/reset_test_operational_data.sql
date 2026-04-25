-- Reset du lieu van hanh test
-- Muc tieu: giu lai tai khoan / role / phan quyen va danh muc,
-- chi xoa du lieu giao dich van hanh theo thu tu downstream -> upstream.
--
-- Chay trong Supabase SQL Editor.
-- Khuyen nghi:
-- 1. Backup DB truoc khi chay.
-- 2. Tam dung nhap lieu.
-- 3. Chay tren moi truong test truoc.

begin;

-- ---------------------------------------------------------------------------
-- 0. Snapshot dem nhanh truoc khi xoa (de doi chieu)
-- ---------------------------------------------------------------------------
do $$
begin
  raise notice '=== Bat dau reset du lieu van hanh test ===';
end $$;

-- ---------------------------------------------------------------------------
-- 1. Phieu tra / phieu xuat hang
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.pile_serial') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'pile_serial'
        and column_name = 'current_shipment_voucher_id'
    ) then
      update public.pile_serial
      set current_shipment_voucher_id = null
      where current_shipment_voucher_id is not null;
      raise notice 'Cleared pile_serial.current_shipment_voucher_id';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'pile_serial'
        and column_name = 'last_return_voucher_id'
    ) then
      update public.pile_serial
      set last_return_voucher_id = null
      where last_return_voucher_id is not null;
      raise notice 'Cleared pile_serial.last_return_voucher_id';
    end if;
  end if;

  if to_regclass('public.return_voucher_serial') is not null then
    delete from public.return_voucher_serial;
    raise notice 'Deleted return_voucher_serial';
  end if;

  if to_regclass('public.return_voucher') is not null then
    delete from public.return_voucher;
    raise notice 'Deleted return_voucher';
  end if;

  if to_regclass('public.shipment_voucher_serial') is not null then
    delete from public.shipment_voucher_serial;
    raise notice 'Deleted shipment_voucher_serial';
  end if;

  if to_regclass('public.phieu_xuat_ban') is not null then
    delete from public.phieu_xuat_ban;
    raise notice 'Deleted phieu_xuat_ban';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. QC / phieu san xuat / xuat NVL
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.production_lot') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'production_lot'
        and column_name = 'warehouse_issue_voucher_id'
    ) then
      update public.production_lot
      set warehouse_issue_voucher_id = null
      where warehouse_issue_voucher_id is not null;
      raise notice 'Cleared production_lot.warehouse_issue_voucher_id';
    end if;
  end if;

  if to_regclass('public.pile_serial') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'pile_serial'
        and column_name = 'warehouse_issue_voucher_id'
    ) then
      update public.pile_serial
      set warehouse_issue_voucher_id = null
      where warehouse_issue_voucher_id is not null;
      raise notice 'Cleared pile_serial.warehouse_issue_voucher_id';
    end if;
  end if;

  if to_regclass('public.sx_qc_nghiem_thu') is not null then
    delete from public.sx_qc_nghiem_thu;
    raise notice 'Deleted sx_qc_nghiem_thu';
  end if;

  if to_regclass('public.sx_xuat_nvl') is not null then
    delete from public.sx_xuat_nvl;
    raise notice 'Deleted sx_xuat_nvl';
  end if;

  if to_regclass('public.material_issue_voucher_line') is not null then
    delete from public.material_issue_voucher_line;
    raise notice 'Deleted material_issue_voucher_line';
  end if;

  if to_regclass('public.material_issue_voucher') is not null then
    delete from public.material_issue_voucher;
    raise notice 'Deleted material_issue_voucher';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Lot / serial / movement
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.pile_serial_move') is not null then
    delete from public.pile_serial_move;
    raise notice 'Deleted pile_serial_move';
  end if;

  if to_regclass('public.pile_serial_history') is not null then
    delete from public.pile_serial_history;
    raise notice 'Deleted pile_serial_history';
  end if;

  if to_regclass('public.pile_serial') is not null then
    delete from public.pile_serial;
    raise notice 'Deleted pile_serial';
  end if;

  if to_regclass('public.production_lot') is not null then
    delete from public.production_lot;
    raise notice 'Deleted production_lot';
  end if;

  if to_regclass('public.material_stock_movement') is not null then
    delete from public.material_stock_movement;
    raise notice 'Deleted material_stock_movement';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Ke hoach san xuat
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.ke_hoach_sx_line') is not null then
    delete from public.ke_hoach_sx_line;
    raise notice 'Deleted ke_hoach_sx_line';
  end if;

  if to_regclass('public.ke_hoach_sx_ngay') is not null then
    delete from public.ke_hoach_sx_ngay;
    raise notice 'Deleted ke_hoach_sx_ngay';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Don hang / bao gia / boc tach
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.bao_gia_boc_tach') is not null then
    delete from public.bao_gia_boc_tach;
    raise notice 'Deleted bao_gia_boc_tach';
  end if;

  if to_regclass('public.bao_gia_version') is not null then
    delete from public.bao_gia_version;
    raise notice 'Deleted bao_gia_version';
  end if;

  if to_regclass('public.bao_gia') is not null then
    delete from public.bao_gia;
    raise notice 'Deleted bao_gia';
  end if;

  if to_regclass('public.don_hang_trang_thai_log') is not null then
    delete from public.don_hang_trang_thai_log;
    raise notice 'Deleted don_hang_trang_thai_log';
  end if;

  if to_regclass('public.don_hang') is not null then
    delete from public.don_hang;
    raise notice 'Deleted don_hang';
  end if;

  if to_regclass('public.boc_tach_nvl_items') is not null then
    delete from public.boc_tach_nvl_items;
    raise notice 'Deleted boc_tach_nvl_items';
  end if;

  if to_regclass('public.boc_tach_seg_nvl') is not null then
    delete from public.boc_tach_seg_nvl;
    raise notice 'Deleted boc_tach_seg_nvl';
  end if;

  if to_regclass('public.boc_tach_nvl') is not null then
    delete from public.boc_tach_nvl;
    raise notice 'Deleted boc_tach_nvl';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Kiem ke / ton dau ky / dieu chinh ton
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.inventory_count_serial') is not null then
    delete from public.inventory_count_serial;
    raise notice 'Deleted inventory_count_serial';
  end if;

  if to_regclass('public.inventory_count_line') is not null then
    delete from public.inventory_count_line;
    raise notice 'Deleted inventory_count_line';
  end if;

  if to_regclass('public.inventory_count_sheet') is not null then
    delete from public.inventory_count_sheet;
    raise notice 'Deleted inventory_count_sheet';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Read model ton kho
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.finished_goods_stock_summary') is not null then
    delete from public.finished_goods_stock_summary;
    raise notice 'Deleted finished_goods_stock_summary';
  end if;

  if to_regclass('public.material_stock_balance') is not null then
    delete from public.material_stock_balance;
    raise notice 'Deleted material_stock_balance';
  end if;

  if to_regclass('public.stock_read_model_health') is not null then
    delete from public.stock_read_model_health;
    raise notice 'Deleted stock_read_model_health';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- 8. Kiem tra nhanh sau khi xoa (an toan ca khi mot so bang chua ton tai)
-- ---------------------------------------------------------------------------
do $$
declare
  table_name text;
  row_count bigint;
  table_names text[] := array[
    'phieu_xuat_ban',
    'return_voucher',
    'shipment_voucher_serial',
    'return_voucher_serial',
    'sx_qc_nghiem_thu',
    'sx_xuat_nvl',
    'material_issue_voucher',
    'material_issue_voucher_line',
    'pile_serial',
    'production_lot',
    'material_stock_movement',
    'ke_hoach_sx_ngay',
    'ke_hoach_sx_line',
    'don_hang',
    'don_hang_trang_thai_log',
    'bao_gia',
    'bao_gia_version',
    'bao_gia_boc_tach',
    'boc_tach_nvl',
    'boc_tach_nvl_items',
    'boc_tach_seg_nvl',
    'inventory_count_sheet',
    'inventory_count_line',
    'inventory_count_serial',
    'finished_goods_stock_summary',
    'material_stock_balance',
    'stock_read_model_health'
  ];
begin
  raise notice '=== Kiem tra nhanh sau reset ===';

  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select count(*) from public.%I', table_name) into row_count;
      raise notice '% => % row(s)', table_name, row_count;
    else
      raise notice '% => table not found, skipped', table_name;
    end if;
  end loop;
end $$;
