-- Backfill note pile_serial sinh từ kiểm kê cọc:
-- đổi UUID nội bộ sang mã phiếu dễ đọc kiểu KK-TP-...

with matched as (
  select
    ps.serial_id,
    ps.notes as old_note,
    ics.count_sheet_code,
    substring(ps.notes from 'dòng ([0-9]+)$') as line_no
  from public.pile_serial ps
  join public.inventory_count_sheet ics
    on ics.count_sheet_id::text = substring(ps.notes from 'Sinh từ kiểm kê cọc ([0-9a-fA-F-]{36})')
  where ps.notes ~ '^Sinh từ kiểm kê cọc [0-9a-fA-F-]{36} - dòng [0-9]+$'
),
updated as (
  update public.pile_serial ps
  set
    notes = 'Sinh từ kiểm kê cọc ' || matched.count_sheet_code || ' - dòng ' || matched.line_no,
    updated_at = now()
  from matched
  where ps.serial_id = matched.serial_id
  returning ps.serial_id, matched.old_note, ps.notes as new_note
)
select *
from updated
order by serial_id;
