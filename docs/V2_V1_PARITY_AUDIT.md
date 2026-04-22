# V2 vs V1 Parity Audit

## Mục tiêu
Tài liệu này dùng để đối chiếu giữa:
- `v1`: `/Users/duynguyen/Desktop/erp-coc-ly-tam-web`
- `v2`: `/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2`

Phạm vi audit:
- màn hình/route
- action chính
- action phụ
- mức độ parity theo UX và flow của `v1`
- nhận diện các phần `v2` đã refactor bên dưới nhưng vẫn cần test E2E trước khi coi là thay thế hoàn toàn `v1`

## Legend
- `PARITY_ROUTE`: đã có màn/route tương ứng ở `v2`
- `PARITY_ACTION`: đã có API/action tương ứng ở `v2`
- `REFACTORED_UNDER_HOOD`: `v2` đã tách `page-data / mutations / client-api / types`
- `NEEDS_E2E`: đã có đủ route/action nhưng chưa nên kết luận thay thế `v1` nếu chưa test end-to-end
- `V2_ONLY`: chức năng mới chỉ có ở `v2`

---

## 1. Dashboard / Shell / Auth

### Route parity
- `PARITY_ROUTE` `/dashboard`
- `PARITY_ROUTE` protected layout/menu
- `PARITY_ROUTE` `/me`
- `V2_ONLY` `/v2` dùng làm roadmap/checkpoint cho rebuild

### Action parity
- `PARITY_ACTION` `app/api/dev/role-override/route.ts`

### Nhận xét
- `v2` đã có shell chạy ổn, menu protected và role gate cơ bản.
- `NEEDS_E2E`: cần test lại đầy đủ theo từng role để chắc menu/redirect không lệch so với `v1`.

---

## 2. Master Data

### Route parity
- `PARITY_ROUTE` `dm-kh`
- `PARITY_ROUTE` `dm-duan`
- `PARITY_ROUTE` `dm-ncc`
- `PARITY_ROUTE` `dm-capphoi-bt`
- `PARITY_ROUTE` `dm-chi-phi-khac`
- `PARITY_ROUTE` `dm-coc-template`
- `PARITY_ROUTE` `dm-dinh-muc-phu-md`
- `PARITY_ROUTE` `dm-thue-loi-nhuan`
- `PARITY_ROUTE` `gia-nvl`
- `PARITY_ROUTE` `nvl`

### Action / sub-action parity
- `PARITY_ACTION` CRUD helper và action files vẫn có đầy đủ ở `v2`
- `PARITY_ACTION` form components, modal edit, bảng CRUD giữ nguyên như `v1`

### Refactor status
- `REFACTORED_UNDER_HOOD`: `dm-kh`, `dm-duan`, `dm-ncc` đã có helper/data module riêng
- `PARITY_ROUTE` nhưng chưa refactor sâu như 3 màn trên: các master data còn lại vẫn chủ yếu giữ structure cũ

### Nhận xét
- `v2` đã đủ mặt màn cho master data.
- `NEEDS_E2E`: cần rà action phụ từng màn, nhất là create/edit/delete/filter/search/import logic ở các màn chưa refactor sâu.

---

## 3. Bóc tách

### Route parity
- `PARITY_ROUTE` `/boc-tach/boc-tach-nvl`
- `PARITY_ROUTE` `/boc-tach/boc-tach-nvl/[boc_id]`
- `PARITY_ROUTE` `/boc-tach/boc-tach-nvl-items`
- `PARITY_ROUTE` `/boc-tach/boc-tach-seg-nvl`

### Action / sub-action parity
- `PARITY_ACTION` save/update bóc tách
- `PARITY_ACTION` bulk delete
- `PARITY_ACTION` list/detail load
- `PARITY_ACTION` client submit path đã tách riêng

### Refactor status
- `REFACTORED_UNDER_HOOD`
  - `lib/boc-tach/list-page.ts`
  - `lib/boc-tach/detail-page.ts`
  - `lib/boc-tach/mutations.ts`
  - `lib/boc-tach/client-api.ts`

### Nhận xét
- Đây là một trong các phân hệ đã khá sạch ở `v2`.
- `NEEDS_E2E`: vẫn cần test save draft, sửa draft, xóa hàng loạt, mở lại hồ sơ, điều hướng list/detail.

---

## 4. Báo giá

### Route parity
- `PARITY_ROUTE` `/don-hang/bao-gia`
- `PARITY_ROUTE` `/don-hang/bao-gia/[quote_id]`
- `PARITY_ROUTE` `/don-hang/lap-bao-gia`

### Action / sub-action parity
- `PARITY_ACTION` route đổi trạng thái báo giá
- `PARITY_ACTION` page data cho list/lập/chi tiết
- `PARITY_ACTION` client API cho status mutation

### Refactor status
- `REFACTORED_UNDER_HOOD`
  - `lib/bao-gia/page-data.ts`
  - `lib/bao-gia/mutations.ts`
  - `lib/bao-gia/client-api.ts`

### Nhận xét
- Route và action chính đã có mặt ở `v2`.
- `NEEDS_E2E`: cần rà action phụ như builder interactions, trạng thái quote, điều hướng từ bóc tách sang báo giá.

---

## 5. Đơn hàng

### Route parity
- `PARITY_ROUTE` `/don-hang`
- `PARITY_ROUTE` `/don-hang/[order_id]`

### Action / sub-action parity
- `PARITY_ACTION` transition route `/api/don-hang/[order_id]/transition`
- `PARITY_ACTION` list/detail loader
- `PARITY_ACTION` detail client mutation path sạch hơn

### Refactor status
- `REFACTORED_UNDER_HOOD`
  - `lib/don-hang/page-data.ts`
  - `lib/don-hang/mutations.ts`
  - `lib/don-hang/client-api.ts`

### Nhận xét
- Cụm đơn hàng đã có parity route/action tốt.
- `NEEDS_E2E`: cần test tạo từ báo giá, chuyển trạng thái, mở detail, và các quyền theo role.

---

## 6. Sản xuất

### Route parity
- `PARITY_ROUTE` `/san-xuat/ke-hoach-ngay`
- `PARITY_ROUTE` `/san-xuat/ke-hoach-ngay/[plan_id]`
- `PARITY_ROUTE` `/san-xuat/qc-nghiem-thu`
- `PARITY_ROUTE` `/san-xuat/tem-serial`

### Action / sub-action parity
- `PARITY_ACTION` tạo kế hoạch ngày
- `PARITY_ACTION` đổi trạng thái kế hoạch
- `PARITY_ACTION` thêm/xóa line kế hoạch
- `PARITY_ACTION` lưu phiếu xuất NVL
- `PARITY_ACTION` mở lại phiếu xuất NVL
- `PARITY_ACTION` lưu QC
- `PARITY_ACTION` luồng tem serial có route màn tương ứng

### Action phụ đã có ở client
- `PARITY_ACTION` QC scan live QR
- `PARITY_ACTION` QC nhập mã/paste
- `PARITY_ACTION` QC chọn ảnh QR

### Refactor status
- `REFACTORED_UNDER_HOOD`
  - `lib/san-xuat/page-data.ts`
  - `lib/san-xuat/mutations.ts`
  - `lib/san-xuat/client-api.ts`
  - `lib/san-xuat/types.ts`

### Nhận xét
- Đây là một trục lõi đã được đưa khá xa ở `v2`.
- `NEEDS_E2E`: cần test lại trọn vòng kế hoạch -> thực SX -> sinh lot/serial -> tem -> QC.

---

## 7. Xuất hàng

### Route parity
- `PARITY_ROUTE` `/don-hang/phieu-xuat`

### Action / sub-action parity
- `PARITY_ACTION` tạo phiếu xuất
- `PARITY_ACTION` tải detail phiếu
- `PARITY_ACTION` confirm xuất hàng
- `PARITY_ACTION` scan serial xuất hàng
- `PARITY_ACTION` đề nghị trả hàng
- `PARITY_ACTION` xác nhận hàng trả lại

### Action phụ ở client
- `PARITY_ACTION` nhập tay thực xuất
- `PARITY_ACTION` scan live QR khi xuất
- `PARITY_ACTION` dán mã khi xuất
- `PARITY_ACTION` chọn ảnh QR khi xuất
- `PARITY_ACTION` scan live QR khi trả hàng
- `PARITY_ACTION` dán mã khi trả hàng
- `PARITY_ACTION` chọn ảnh QR khi trả hàng

### Refactor status
- `REFACTORED_UNDER_HOOD`
  - `lib/xuat-hang/page-data.ts`
  - `lib/xuat-hang/mutations.ts`
  - `lib/xuat-hang/client-api.ts`

### Nhận xét
- Về mặt action coverage, `v2` đã bám sát `v1`.
- `NEEDS_E2E`: đây là phân hệ phải test kỹ nhất vì liên quan trực tiếp tới tồn kho, serial, và trả hàng.

---

## 8. Tồn kho cọc thành phẩm

### Route parity
- `PARITY_ROUTE` `/ton-kho/thanh-pham`

### Action / sub-action parity
- `PARITY_ACTION` summary theo mặt hàng
- `PARITY_ACTION` detail theo serial
- `PARITY_ACTION` filter/scope/query

### Refactor status
- `REFACTORED_UNDER_HOOD`
  - `lib/ton-kho-thanh-pham/types.ts`
  - `lib/ton-kho-thanh-pham/page-data.ts`
  - `lib/ton-kho-thanh-pham/internal.ts`
  - `lib/ton-kho-thanh-pham/selectors.ts`
  - `lib/ton-kho-thanh-pham/repository.ts`
- Kiến trúc đã có thêm:
  - `V2_FINISHED_GOODS_INVENTORY_ARCHITECTURE.md`
  - `V2_INVENTORY_MOVEMENT_CONTRACT.md`
  - `V2_LEGACY_RECONCILIATION.md`

### Nhận xét
- Đây là nơi `v2` đang đi xa hơn `v1` về mặt kiến trúc.
- `NEEDS_E2E`: cần đối chiếu số summary/detail với dữ liệu thực sau mỗi flow lớn.

---


### Audit focus: KTBH (2026-04-07)
- Đã đối chiếu tĩnh trực tiếp giữa `v1` và `v2` ở 3 màn KTBH dùng nhiều nhất:
  - `bao-gia-list-client`
  - `don-hang-detail-client`
  - `phieu-xuat-page-client`
- Kết luận hiện tại: chưa thấy thiếu route/action lớn ở `v2` so với `v1` cho KTBH.
- Rủi ro chính còn lại không phải parity logic mà là hiệu năng thao tác ở một số action còn lại.
- Đã tối ưu xong trong `v2` cho KTBH:
  - `bao-gia-list-client`: đổi trạng thái và duyệt sản xuất cập nhật local state, không refresh cả page
  - `don-hang-detail-client`: chuyển trạng thái cập nhật local detail/timeline, không refresh cả route
  - `phieu-xuat-page-client`: `lập phiếu xuất` và `gửi đề nghị trả hàng` cập nhật local voucher state, không refresh cả page
- Refresh còn giữ lại chủ yếu ở action của kho hoặc các màn builder phụ.
- Vì vậy pha tiếp theo của KTBH trong `v2` nên là:
  1. test E2E bằng dữ liệu thật
  2. chỉ vá parity nếu có fail thật
  3. sau đó mới tối ưu các action phụ nếu thực sự cần

## 9. Legacy Reconciliation

### Route parity
- `V2_ONLY` `/ton-kho/thanh-pham/doi-soat-legacy`
- `V2_ONLY` `/ton-kho/thanh-pham/doi-soat-legacy/[voucher_id]`

### Action / sub-action coverage
- `V2_ONLY` list voucher còn legacy gap
- `V2_ONLY` detail một phiếu legacy theo item
- `V2_ONLY` chọn serial ứng viên bằng:
  - tick tay
  - dán mã
  - chọn ảnh QR
  - quét live QR
- `V2_ONLY` gán serial legacy vào phiếu cũ qua API `assign`

### Nhận xét
- Không có màn này ở `v1`, nhưng đây là phần rất quan trọng để dữ liệu cũ hội tụ về cấu trúc serial chuẩn.
- `NEEDS_E2E`: cần test trên phiếu legacy thật, đặc biệt với các case có trả hàng trước đó.

---

## 10. Parity tổng quan theo nhóm

### Nhóm đã có parity route gần như đầy đủ
- Master data
- Bóc tách
- Báo giá
- Đơn hàng
- Sản xuất
- Xuất hàng
- Tồn kho thành phẩm

### Nhóm đã có refactor dưới nền khá rõ
- Bóc tách
- Báo giá
- Đơn hàng
- Sản xuất
- Xuất hàng
- Tồn kho thành phẩm
- Một phần master data

### Nhóm có chức năng mới ở `v2`
- `V2_ONLY` roadmap/checkpoint `/v2`
- `V2_ONLY` legacy reconciliation list/detail/assign
- `V2_ONLY` inventory architecture contracts/docs

---

## 11. Những gì chưa nên kết luận là “đã thay v1 hoàn toàn”

Dù coverage đã khá sâu, vẫn còn các việc bắt buộc trước khi thay `v1`:

1. `NEEDS_E2E` theo vai trò
- Kỹ thuật
- QLSX
- QC
- KTBH
- Thủ kho
- Admin

2. Rà `action phụ` trên từng màn master data chưa refactor sâu
- create/edit/delete
- duplicate check
- search/filter
- modal state

3. Rà trọn flow nghiệp vụ lớn
- bóc tách -> báo giá -> đơn hàng
- kế hoạch sản xuất -> thực SX -> lot/serial -> QC
- phiếu xuất -> xuất serial -> trả hàng
- tồn kho summary/detail
- legacy reconciliation

4. Audit hiệu năng
- `xuat-hang`
- `ton-kho thanh-pham`
- `san-xuat`

---

## 12. Kết luận hiện tại

### Kết luận ngắn
- `v2` **chưa thể tuyên bố thay `v1` ngay lập tức**.
- Nhưng `v2` **đã có parity route rất cao** với `v1`, và các trục khó nhất đã được dựng lại khá bài bản.

### Đánh giá thực tế
- Nếu nhìn theo `màn` và `action chính`: `v2` đã đi rất xa.
- Nếu nhìn theo tiêu chuẩn ERP “thay bản đang dùng”: vẫn cần thêm một vòng kiểm `action phụ + E2E + performance`.

### Việc nên làm tiếp ngay
1. test E2E theo checklist role
2. đánh dấu pass/fail trực tiếp vào tài liệu này
3. sau đó mới chốt cutover hoặc tiếp tục vá các lỗ parity còn lại
