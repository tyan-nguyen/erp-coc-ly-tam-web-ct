-- Cleanup cho smoke test reopen phiếu xuất / đề nghị trả hàng.

do $$
begin
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
  )
  or return_voucher_id = '00000000-0000-0000-0000-00000000c666';

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

  raise notice 'Cleaned shipment reopen smoke test rows.';
end $$;
