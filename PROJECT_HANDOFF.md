# PROJECT_HANDOFF

Project: ERP Cọc Ly Tâm — Next.js + Supabase

## Kiến trúc đã chốt
- Frontend: Next.js
- Backend/data/auth: Supabase
- Giữ nguyên baseline SQL 01→04
- Dùng public schema
- 1 user = 1 role qua public.user_profiles.role
- Sinh mã bằng next_ma(...) + PostgreSQL sequence
- Soft delete theo is_active + deleted_at
- Không tạo schema mới
- Không multi-role
- Không đổi DB/schema/role model nếu chưa được yêu cầu rõ

## Ràng buộc nghiệp vụ đã chốt thêm
- Bóc tách phải tính theo từng đoạn cọc và từng tổ hợp tim, không được bình quân theo tổng mét dài rồi nhân ngược.
- Snapshot để QLSX và xuất NVL về sau phải bám dữ liệu segment-level trong `public.boc_tach_seg_nvl`.
- Mác bê tông chỉ là tham số tính; khi bóc tách và xuất kho phải quy đổi ra NVL thật theo `public.dm_capphoi_bt`.
- Logic đai kép chỉ áp cho bước thép A1, các bước còn lại là đai đơn.
- Cấp phối mặc định cho bóc tách / dự toán / báo giá dùng `FULL_XI_TRO_XI`.
- Cấp phối chạy thực tế khi sản xuất sẽ được chọn sau ở flow sản xuất; không nhét nhiều variant vào `dm_capphoi_bt` hiện tại.

## Nhận diện thương hiệu
- Primary blue: #02567A
- Accent red: #ED1C22
- Background: #F7F9FB
- Surface: #FFFFFF
- Text: #0F172A
- Border: #D9E2E8

## Trạng thái hiện tại
### PASS
- Auth/session/protected routing ổn định
- `/dashboard`, `/login`, `/me` hoạt động đúng
- Master-data CRUD FULL PASS:
  - `dm_kh`
  - `dm_duan`
  - `dm_ncc`
  - `nvl`
  - `gia_nvl`
  - `dm_coc_template`
  - `dm_dinh_muc_phu_md`
  - `dm_capphoi_bt`
- Module `boc_tach` PASS end-to-end:
  - Save `NHAP`
  - Save `DA_GUI`
  - lock sau `DA_GUI`
  - idempotency send
  - `don_hang` 1:1 theo `boc_id`
- Engine bóc tách đang được nâng tiếp theo baseline nghiệp vụ:
  - tự suy ra `V1/V2/V3` từ `a1/a2/a3 + % bước` khi có dữ liệu
  - lưu snapshot NVL theo từng đoạn
  - quy đổi bê tông mặc định sang NVL cấp phối thật từ `dm_capphoi_bt`
  - vật tư phụ theo `dm_dinh_muc_phu_md`
  - lọc bỏ preview rows có `dinh_muc = 0`
- Module `don_hang` core flow PASS trong DEV scope:
  - list
  - detail
  - timeline `don_hang_trang_thai_log`
  - state transition theo `don_hang_state_machine`
  - role-based actions
  - invalid transition bị chặn server-side

### Route debug
- Giữ `/me` làm debug session/profile

## Quy tắc làm việc
- Làm xong mốc nào thì test ngay mốc đó
- Chỉ kết luận PASS khi có:
  - browser flow
  - DB verify
- Nếu FAIL thì fix tối thiểu đúng chỗ, rồi chỉ retest affected scope

## Roadmap hiện tại
1. don_hang
2. bao_gia
3. các module sau đó

## Không được đổi
- public schema
- single-role
- next_ma(...)
- soft delete is_active + deleted_at
- không triển khai bao_gia trước khi don_hang pass
