# BUG REPORT (Current)

Date: 2026-03-30

## Resolved
- `dm_kh_nhom_kh_check` value set đúng: `TIEM_NANG`, `VANG_LAI`.
- Soft-delete RLS blocker xử lý bằng RPC `security definer` (`soft_delete_master_data`) + web action fallback call.
- CRUD config đã align schema thật cho 8 bảng master-data.
- Generated/read-only columns đã loại khỏi update payload.
- `Save DA_GUI` trên `public.boc_tach_nvl` đã pass sau khi bổ sung `WITH CHECK` phù hợp cho policy update.
- Giá trị mặc định `ten_doan` đã đổi sang giá trị hợp lệ (`MUI`), không còn vướng check constraint.
- Tạo `don_hang` 1:1 từ `boc_tach` đã pass sau khi align payload insert theo các cột bắt buộc thật của `public.don_hang`.
- Crash preview/save do `normalize(...)` gặp `null/undefined` trong flow cấp phối mặc định đã được fix an toàn ở engine bóc tách.
- Dòng vật tư phụ rác với `dinh_muc = 0` không còn hiển thị trong preview sau khi lọc ở engine.
- Cấp phối mặc định `FULL_XI_TRO_XI` cho `M600/M800` đã được fixture vào DEV để bóc tách mặc định ra đúng NVL thật.

## Open
- Không có bug blocker mở trong phạm vi `auth`, `master-data`, `boc_tach`, `don_hang` core.

## Retest Status
- `Save NHAP`: PASS
- `Save DA_GUI`: PASS
- `Lock sau DA_GUI`: PASS
- `Idempotency send`: PASS
- `don_hang 1:1`: PASS

Các bug blocker bóc tách hiện đã được xử lý trong DEV scope.

## Don_hang
- Không có blocker mở ở mức implementation cơ bản cho `don_hang`:
  - list: PASS
  - detail: PASS
  - timeline: PASS
  - valid transition theo `don_hang_state_machine`: PASS
  - invalid transition bị chặn server-side: PASS
  - terminal state không hiện action: PASS

## Environment Notes
- `npm run build` trong sandbox hiện tại vẫn có thể fail do Turbopack environment issue:
  - `creating new process`
  - `binding to a port`
  - `Operation not permitted`
- Đây chưa phải bug ứng dụng riêng của module `don_hang`.
