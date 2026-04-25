-- Smoke seed cho reopen phiếu xuất hàng / đề nghị trả hàng.
-- Mục tiêu:
-- 1) Voucher A: Admin mở lại phiếu xuất thành công
-- 2) Voucher B: KTBH/Admin mở lại đề nghị trả hàng thành công
-- 3) Voucher C: Bị chặn vì đã có return_voucher downstream
--
-- Sau khi test xong, chạy file:
--   sql/reopen_shipment_smoke_cleanup.sql

do $$
declare
  v_admin_user_id uuid;
  v_kho_tp_id uuid;
  v_today date := current_date;
begin
  select user_id
  into v_admin_user_id
  from public.user_profiles
  where is_active = true
    and lower(trim(coalesce(role, ''))) = 'admin'
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_admin_user_id is null then
    raise exception 'Không tìm thấy user Admin hoạt động để seed smoke test.';
  end if;

  select location_id
  into v_kho_tp_id
  from public.warehouse_location
  where location_code = 'KHO_THANH_PHAM'
  limit 1;

  if v_kho_tp_id is null then
    raise exception 'Không tìm thấy warehouse_location KHO_THANH_PHAM.';
  end if;

  delete from public.return_voucher_serial
  where shipment_voucher_id in (
    '00000000-0000-0000-0000-00000000a111',
    '00000000-0000-0000-0000-00000000b111',
    '00000000-0000-0000-0000-00000000c111'
  );

  delete from public.return_voucher
  where shipment_voucher_id in (
    '00000000-0000-0000-0000-00000000a111',
    '00000000-0000-0000-0000-00000000b111',
    '00000000-0000-0000-0000-00000000c111'
  );

  delete from public.shipment_voucher_serial
  where voucher_id in (
    '00000000-0000-0000-0000-00000000a111',
    '00000000-0000-0000-0000-00000000b111',
    '00000000-0000-0000-0000-00000000c111'
  );

  delete from public.pile_serial_history
  where serial_id in (
    '00000000-0000-0000-0000-00000000a333',
    '00000000-0000-0000-0000-00000000b333',
    '00000000-0000-0000-0000-00000000c333'
  );

  update public.pile_serial
  set current_shipment_voucher_id = null,
      last_return_voucher_id = null
  where serial_id in (
    '00000000-0000-0000-0000-00000000a333',
    '00000000-0000-0000-0000-00000000b333',
    '00000000-0000-0000-0000-00000000c333'
  );

  delete from public.pile_serial
  where serial_id in (
    '00000000-0000-0000-0000-00000000a333',
    '00000000-0000-0000-0000-00000000b333',
    '00000000-0000-0000-0000-00000000c333'
  );

  delete from public.production_lot
  where lot_id in (
    '00000000-0000-0000-0000-00000000a222',
    '00000000-0000-0000-0000-00000000b222',
    '00000000-0000-0000-0000-00000000c222'
  );

  delete from public.phieu_xuat_ban
  where voucher_id in (
    '00000000-0000-0000-0000-00000000a111',
    '00000000-0000-0000-0000-00000000b111',
    '00000000-0000-0000-0000-00000000c111'
  );

  insert into public.phieu_xuat_ban (
    voucher_id,
    source_type,
    trang_thai,
    ngay_thao_tac,
    ghi_chu,
    payload_json,
    is_active,
    created_by,
    updated_by
  )
  values
  (
    '00000000-0000-0000-0000-00000000a111',
    'TON_KHO',
    'DA_XUAT',
    v_today,
    'SMOKE TEST A - reopen shipment',
    jsonb_build_object(
      'note', 'SMOKE TEST A - reopen shipment',
      'summary', jsonb_build_object(
        'customerName', 'Smoke Test',
        'projectName', 'Manual QA',
        'maOrder', null,
        'maBaoGia', null
      ),
      'lines', jsonb_build_array(
        jsonb_build_object(
          'lineId', '00000000-0000-0000-0000-00000000a444',
          'sourceMode', 'TON_KHO',
          'templateId', null,
          'maCoc', 'M600 - A400 - 40 - 8',
          'loaiCoc', 'PC - A400 - 40',
          'tenDoan', 'MUI',
          'chieuDaiM', 10,
          'requestedQty', 1,
          'actualQty', 1,
          'itemLabel', 'M600 - A400 - 40 - 8 | MUI | 10m',
          'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
          'actualSource', jsonb_build_object(
            'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
            'itemLabel', 'M600 - A400 - 40 - 8 | MUI | 10m',
            'availableQty', 1
          )
        )
      ),
      'confirmedSerials', jsonb_build_array(
        jsonb_build_object(
          'lineId', '00000000-0000-0000-0000-00000000a444',
          'serialId', '00000000-0000-0000-0000-00000000a333',
          'serialCode', 'SMOKE-REOPEN-A-001',
          'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
          'orderSourceKey', null
        )
      ),
      'returnedSerials', jsonb_build_array(),
      'returnFeatureReady', true
    ),
    true,
    v_admin_user_id,
    v_admin_user_id
  ),
  (
    '00000000-0000-0000-0000-00000000b111',
    'TON_KHO',
    'DA_XUAT',
    v_today,
    'SMOKE TEST B - reopen return request',
    jsonb_build_object(
      'note', 'SMOKE TEST B - reopen return request',
      'summary', jsonb_build_object(
        'customerName', 'Smoke Test',
        'projectName', 'Manual QA',
        'maOrder', null,
        'maBaoGia', null
      ),
      'lines', jsonb_build_array(
        jsonb_build_object(
          'lineId', '00000000-0000-0000-0000-00000000b444',
          'sourceMode', 'TON_KHO',
          'templateId', null,
          'maCoc', 'M600 - A400 - 40 - 8',
          'loaiCoc', 'PC - A400 - 40',
          'tenDoan', 'MUI',
          'chieuDaiM', 10,
          'requestedQty', 1,
          'actualQty', 1,
          'itemLabel', 'M600 - A400 - 40 - 8 | MUI | 10m',
          'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
          'actualSource', jsonb_build_object(
            'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
            'itemLabel', 'M600 - A400 - 40 - 8 | MUI | 10m',
            'availableQty', 1
          )
        )
      ),
      'confirmedSerials', jsonb_build_array(
        jsonb_build_object(
          'lineId', '00000000-0000-0000-0000-00000000b444',
          'serialId', '00000000-0000-0000-0000-00000000b333',
          'serialCode', 'SMOKE-REOPEN-B-001',
          'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
          'orderSourceKey', null
        )
      ),
      'returnedSerials', jsonb_build_array(),
      'returnRequest', jsonb_build_object(
        'status', 'PENDING',
        'note', 'SMOKE TEST pending return request',
        'requestedQtyTotal', 1,
        'requestedLines', jsonb_build_array(
          jsonb_build_object(
            'lineId', '00000000-0000-0000-0000-00000000b444',
            'requestedQty', 1
          )
        ),
        'requestedAt', now(),
        'requestedBy', v_admin_user_id::text,
        'completedAt', null,
        'completedBy', null
      ),
      'returnFeatureReady', true
    ),
    true,
    v_admin_user_id,
    v_admin_user_id
  ),
  (
    '00000000-0000-0000-0000-00000000c111',
    'TON_KHO',
    'DA_XUAT',
    v_today,
    'SMOKE TEST C - blocked by return voucher',
    jsonb_build_object(
      'note', 'SMOKE TEST C - blocked by return voucher',
      'summary', jsonb_build_object(
        'customerName', 'Smoke Test',
        'projectName', 'Manual QA',
        'maOrder', null,
        'maBaoGia', null
      ),
      'lines', jsonb_build_array(
        jsonb_build_object(
          'lineId', '00000000-0000-0000-0000-00000000c444',
          'sourceMode', 'TON_KHO',
          'templateId', null,
          'maCoc', 'M600 - A400 - 40 - 8',
          'loaiCoc', 'PC - A400 - 40',
          'tenDoan', 'MUI',
          'chieuDaiM', 10,
          'requestedQty', 1,
          'actualQty', 1,
          'itemLabel', 'M600 - A400 - 40 - 8 | MUI | 10m',
          'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
          'actualSource', jsonb_build_object(
            'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
            'itemLabel', 'M600 - A400 - 40 - 8 | MUI | 10m',
            'availableQty', 1
          )
        )
      ),
      'confirmedSerials', jsonb_build_array(
        jsonb_build_object(
          'lineId', '00000000-0000-0000-0000-00000000c444',
          'serialId', '00000000-0000-0000-0000-00000000c333',
          'serialCode', 'SMOKE-REOPEN-C-001',
          'stockSourceKey', 'M600 - A400 - 40 - 8::MUI::10',
          'orderSourceKey', null
        )
      ),
      'returnedSerials', jsonb_build_array(),
      'returnRequest', jsonb_build_object(
        'status', 'PENDING',
        'note', 'SMOKE TEST blocked by downstream return voucher',
        'requestedQtyTotal', 1,
        'requestedLines', jsonb_build_array(
          jsonb_build_object(
            'lineId', '00000000-0000-0000-0000-00000000c444',
            'requestedQty', 1
          )
        ),
        'requestedAt', now(),
        'requestedBy', v_admin_user_id::text,
        'completedAt', null,
        'completedBy', null
      ),
      'returnFeatureReady', true
    ),
    true,
    v_admin_user_id,
    v_admin_user_id
  );

  insert into public.production_lot (
    lot_id,
    lot_code,
    template_id,
    ma_coc,
    loai_coc,
    ten_doan,
    chieu_dai_m,
    production_date,
    actual_qty,
    created_by,
    updated_by,
    is_active
  )
  values
  (
    '00000000-0000-0000-0000-00000000a222',
    'SMOKE-LOT-A',
    null,
    'M600 - A400 - 40 - 8',
    'PC - A400 - 40',
    'MUI',
    10,
    v_today,
    1,
    v_admin_user_id,
    v_admin_user_id,
    true
  ),
  (
    '00000000-0000-0000-0000-00000000b222',
    'SMOKE-LOT-B',
    null,
    'M600 - A400 - 40 - 8',
    'PC - A400 - 40',
    'MUI',
    10,
    v_today,
    1,
    v_admin_user_id,
    v_admin_user_id,
    true
  ),
  (
    '00000000-0000-0000-0000-00000000c222',
    'SMOKE-LOT-C',
    null,
    'M600 - A400 - 40 - 8',
    'PC - A400 - 40',
    'MUI',
    10,
    v_today,
    1,
    v_admin_user_id,
    v_admin_user_id,
    true
  );

  insert into public.pile_serial (
    serial_id,
    serial_code,
    lot_id,
    template_id,
    ma_coc,
    loai_coc,
    ten_doan,
    chieu_dai_m,
    lifecycle_status,
    qc_status,
    disposition_status,
    visible_in_project,
    visible_in_retail,
    current_location_id,
    current_shipment_voucher_id,
    is_active
  )
  values
  (
    '00000000-0000-0000-0000-00000000a333',
    'SMOKE-REOPEN-A-001',
    '00000000-0000-0000-0000-00000000a222',
    null,
    'M600 - A400 - 40 - 8',
    'PC - A400 - 40',
    'MUI',
    10,
    'DA_XUAT',
    'DAT',
    'BINH_THUONG',
    true,
    true,
    v_kho_tp_id,
    '00000000-0000-0000-0000-00000000a111',
    true
  ),
  (
    '00000000-0000-0000-0000-00000000b333',
    'SMOKE-REOPEN-B-001',
    '00000000-0000-0000-0000-00000000b222',
    null,
    'M600 - A400 - 40 - 8',
    'PC - A400 - 40',
    'MUI',
    10,
    'DA_XUAT',
    'DAT',
    'BINH_THUONG',
    true,
    true,
    v_kho_tp_id,
    '00000000-0000-0000-0000-00000000b111',
    true
  ),
  (
    '00000000-0000-0000-0000-00000000c333',
    'SMOKE-REOPEN-C-001',
    '00000000-0000-0000-0000-00000000c222',
    null,
    'M600 - A400 - 40 - 8',
    'PC - A400 - 40',
    'MUI',
    10,
    'DA_XUAT',
    'DAT',
    'BINH_THUONG',
    true,
    true,
    v_kho_tp_id,
    '00000000-0000-0000-0000-00000000c111',
    true
  );

  insert into public.shipment_voucher_serial (
    voucher_serial_id,
    voucher_id,
    voucher_line_id,
    serial_id,
    reserved_at,
    confirmed_at,
    created_by
  )
  values
  (
    '00000000-0000-0000-0000-00000000a555',
    '00000000-0000-0000-0000-00000000a111',
    '00000000-0000-0000-0000-00000000a444',
    '00000000-0000-0000-0000-00000000a333',
    now(),
    now(),
    v_admin_user_id
  ),
  (
    '00000000-0000-0000-0000-00000000b555',
    '00000000-0000-0000-0000-00000000b111',
    '00000000-0000-0000-0000-00000000b444',
    '00000000-0000-0000-0000-00000000b333',
    now(),
    now(),
    v_admin_user_id
  ),
  (
    '00000000-0000-0000-0000-00000000c555',
    '00000000-0000-0000-0000-00000000c111',
    '00000000-0000-0000-0000-00000000c444',
    '00000000-0000-0000-0000-00000000c333',
    now(),
    now(),
    v_admin_user_id
  );

  insert into public.return_voucher (
    return_voucher_id,
    shipment_voucher_id,
    ghi_chu,
    created_by,
    updated_by,
    is_active
  )
  values (
    '00000000-0000-0000-0000-00000000c666',
    '00000000-0000-0000-0000-00000000c111',
    'SMOKE TEST downstream blocker',
    v_admin_user_id,
    v_admin_user_id,
    true
  );

  raise notice 'Seeded smoke vouchers: A=reopen shipment, B=reopen return request, C=blocked by return voucher';
end $$;
