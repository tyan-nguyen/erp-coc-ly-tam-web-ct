# NEXT_STEPS

## DONE
- Auth PASS
- Master-data FULL PASS
- Bóc tách PASS
- Bóc tách segment-level / default mix PASS trong DEV scope:
  - tính theo từng đoạn / tổ hợp tim
  - đai kép chỉ A1
  - phụ kiện theo `số cái`
  - quy đổi bê tông mặc định ra NVL thật từ `dm_capphoi_bt`
  - vật tư phụ theo `dm_dinh_muc_phu_md`
- Don_hang core implementation PASS trong DEV scope:
  - list
  - detail
  - timeline `don_hang_trang_thai_log`
  - state transition theo `don_hang_state_machine`
  - role-based actions theo `actor_roles`
  - invalid transition bị chặn server-side

## BLOCKED
- Không có blocker mở hiện tại cho `auth`, `master-data`, `boc_tach`, `don_hang` core flow
- `npm run build` trong sandbox có thể fail do Turbopack environment issue, chưa quy kết là bug app

## NEXT
### Bóc tách / dự toán
1. giữ nguyên engine segment-level + default mix đã pass
2. nếu mở tiếp sản xuất, bổ sung bước chọn `variant` cấp phối thực tế ở flow downstream
3. nếu mở tiếp dự toán giá, nối lớp giá NVL/phụ kiện/vật tư phụ vào tổng dự toán

### Don_hang
1. giữ nguyên core flow đã pass
2. retest rộng hơn theo nhiều trạng thái/role nếu cần trước khi downstream modules dùng chung

### Sau đó mới sang
1. `bao_gia`
2. `bao_gia_don_hang`
3. `bao_gia_line`

## QUY TẮC TEST
- Mỗi mốc phải có:
  - browser flow
  - DB verify
  - report `expected / actual / pass-fail`

## KHÔNG ĐƯỢC ĐỔI
- `public schema`
- `single-role`
- `next_ma(...)`
- soft delete `is_active + deleted_at`
- `/me` giữ làm debug session
- không làm sang `bao_gia` trước khi `don_hang` được chốt pass
