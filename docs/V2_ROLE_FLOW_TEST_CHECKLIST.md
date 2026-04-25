# V2 Role & Flow Test Checklist

Tài liệu này dùng sau khi đã có parity audit:
- [/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_V1_PARITY_AUDIT.md](/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_V1_PARITY_AUDIT.md)

Mục tiêu:
- test `v2` theo đúng vai trò người dùng thật
- rà đủ `màn`, `action chính`, `action phụ`
- đánh dấu pass/fail trước khi cân nhắc thay `v1`

## Cách dùng
- `TODO`: chưa test
- `PASS`: đã test ổn
- `FAIL`: test lỗi, cần sửa
- `NA`: không áp dụng cho role/flow đó

Mỗi mục nên ghi thêm ngắn:
- người test
- ngày test
- note nếu có dữ liệu sample đặc biệt

---

## 1. Admin

### 1.1 Shell / quyền / điều hướng
- [ ] `TODO` vào được `dashboard`
- [ ] `TODO` thấy đúng toàn bộ menu protected
- [ ] `TODO` chuyển được giữa các phân hệ mà không redirect sai
- [ ] `TODO` mở được `v2` checkpoint page

### 1.2 Master data
- [ ] `TODO` mở `dm-kh`
- [ ] `TODO` tạo khách hàng mới
- [ ] `TODO` sửa khách hàng
- [ ] `TODO` tìm kiếm/lọc khách hàng
- [ ] `TODO` mở `dm-duan`
- [ ] `TODO` tạo dự án mới
- [ ] `TODO` sửa dự án
- [ ] `TODO` liên kết dự án với khách hàng đúng
- [ ] `TODO` mở `dm-ncc`
- [ ] `TODO` CRUD nhà cung cấp
- [ ] `TODO` rà các màn master data còn lại mở và lưu ổn

### 1.3 Flow tổng
- [ ] `TODO` tạo bóc tách mới
- [ ] `TODO` tạo báo giá từ bóc tách
- [ ] `TODO` tạo/chuyển đơn hàng
- [ ] `TODO` tạo kế hoạch sản xuất
- [ ] `TODO` xác nhận thực SX + sinh lot/serial
- [ ] `TODO` QC theo serial
- [ ] `TODO` tạo phiếu xuất
- [ ] `TODO` xác nhận xuất theo serial
- [ ] `TODO` đề nghị trả hàng
- [ ] `TODO` xác nhận hàng trả lại
- [ ] `TODO` kiểm tra tồn kho summary/detail sau toàn bộ flow

---

## 2. Kỹ thuật

### 2.1 Bóc tách
- [ ] `TODO` mở list bóc tách
- [ ] `TODO` tạo bóc tách mới
- [ ] `TODO` lưu nháp bóc tách
- [ ] `TODO` mở lại bóc tách đã lưu
- [ ] `TODO` sửa bóc tách
- [ ] `TODO` xóa nhiều bóc tách
- [ ] `TODO` mở được các màn phụ `boc-tach-nvl-items`, `boc-tach-seg-nvl`

### 2.2 Từ bóc tách sang báo giá
- [ ] `TODO` dữ liệu bóc tách kéo sang báo giá đúng
- [ ] `TODO` không lệch đơn vị/số lượng khi chuyển sang báo giá

---

## 3. KTBH


### Ghi chú audit tĩnh KTBH
- Đã rà tĩnh 3 màn chính của KTBH trong `v2`:
  - báo giá
  - detail đơn hàng
  - phiếu xuất
- Hiện chưa thấy thiếu action lớn so với `v1`.
- Ưu tiên test thực tế trước các flow sau:
  - đổi trạng thái báo giá
  - duyệt sản xuất từ báo giá
  - chuyển trạng thái đơn hàng
  - tạo phiếu xuất theo đơn hàng
  - tạo phiếu bán tồn kho
  - đề nghị trả hàng sau giao
- Ghi chú hiệu năng: sau vòng tối ưu đầu tiên, `báo giá` và `đơn hàng` đã bỏ full refresh ở action chính của KTBH; `phiếu xuất` cũng đã bỏ full refresh ở `lập phiếu xuất` và `gửi đề nghị trả hàng`. Các refresh còn lại chủ yếu nằm ở action của kho hoặc builder phụ, nên vòng test KTBH tiếp theo nên tập trung xác nhận cảm giác mượt ở các thao tác chính.

### 3.1 Báo giá
- [ ] `TODO` mở list báo giá
- [ ] `TODO` lọc/tìm báo giá
- [ ] `TODO` mở chi tiết báo giá
- [ ] `TODO` đổi trạng thái báo giá
- [ ] `TODO` lập báo giá từ dữ liệu bóc tách

### 3.2 Đơn hàng
- [ ] `TODO` mở list đơn hàng
- [ ] `TODO` mở detail đơn hàng
- [ ] `TODO` chuyển trạng thái đơn hàng đúng quyền

### 3.3 Phiếu xuất
- [ ] `TODO` vào `Theo đơn hàng`
- [ ] `TODO` thấy đủ tất cả đoạn của báo giá kể cả `Có thể giao = 0`
- [ ] `TODO` nhập `SL đề nghị xuất` vượt `Có thể giao` vẫn tạo đề nghị được
- [ ] `TODO` vào `Bán tồn kho`
- [ ] `TODO` tạo phiếu bán tồn kho
- [ ] `TODO` mở lại detail phiếu xuất

### 3.4 Trả hàng sau giao
- [ ] `TODO` từ phiếu đã xuất gửi đề nghị trả hàng
- [ ] `TODO` chỉ nhập theo số lượng, không bị đòi serial ở bước KTBH
- [ ] `TODO` trạng thái đề nghị trả hàng hiện đúng ở phiếu
- [ ] `TODO` số `Đã giao` ở bảng nguồn phản ánh giao ròng sau khi kho xử lý trả hàng

---

## 4. QLSX

### 4.1 Kế hoạch sản xuất
- [ ] `TODO` mở list kế hoạch ngày
- [ ] `TODO` tạo kế hoạch ngày mới
- [ ] `TODO` thêm line kế hoạch
- [ ] `TODO` xóa line kế hoạch
- [ ] `TODO` chốt kế hoạch ngày
- [ ] `TODO` mở detail kế hoạch ngày

### 4.2 Liên kết với đơn hàng
- [ ] `TODO` dữ liệu đơn hàng kéo đúng sang kế hoạch SX
- [ ] `TODO` các đoạn hiển thị không lệch số lượng đặt/sản xuất

---

## 5. Thủ kho

### 5.1 Thực sản xuất
- [ ] `TODO` mở detail kế hoạch ngày
- [ ] `TODO` xác nhận thực SX
- [ ] `TODO` sinh lot
- [ ] `TODO` sinh serial
- [ ] `TODO` in/xem tem QR

### 5.2 Xuất NVL
- [ ] `TODO` lưu phiếu xuất NVL
- [ ] `TODO` mở lại phiếu xuất NVL

### 5.3 Phiếu xuất hàng
- [ ] `TODO` mở phiếu `chờ xác nhận`
- [ ] `TODO` nhập tay thực xuất
- [ ] `TODO` scan live QR khi xuất
- [ ] `TODO` dán mã khi xuất
- [ ] `TODO` chọn ảnh QR khi xuất
- [ ] `TODO` xác nhận xuất hàng thành công
- [ ] `TODO` payload/detail sau xác nhận phản ánh đúng serial đã xuất

### 5.4 Hàng trả lại
- [ ] `TODO` mở phiếu có đề nghị trả hàng
- [ ] `TODO` chọn serial thủ công
- [ ] `TODO` quét live QR khi nhận hàng trả lại
- [ ] `TODO` dán mã khi nhận hàng trả lại
- [ ] `TODO` chọn ảnh QR khi nhận hàng trả lại
- [ ] `TODO` xác nhận hàng trả lại với từng hướng xử lý:
  - [ ] `TODO` nhập về cho dự án
  - [ ] `TODO` nhập về khách lẻ
  - [ ] `TODO` hủy

### 5.5 Legacy reconciliation
- [ ] `TODO` mở list phiếu legacy gap
- [ ] `TODO` mở detail một phiếu legacy
- [ ] `TODO` tick tay serial ứng viên
- [ ] `TODO` dán mã để thêm vào draft legacy
- [ ] `TODO` chọn ảnh QR để thêm vào draft legacy
- [ ] `TODO` quét live QR để thêm vào draft legacy
- [ ] `TODO` xác nhận gán serial legacy
- [ ] `TODO` sau gán, `unresolvedQty` giảm đúng

---

## 6. QC

### 6.1 QC nghiệm thu
- [ ] `TODO` mở list QC
- [ ] `TODO` mở detail QC theo kế hoạch
- [ ] `TODO` nếu không nhập lỗi nào, hệ thống hiểu `0 lỗi` và toàn bộ còn lại là `Đạt`
- [ ] `TODO` nhập lỗi thủ công theo serial
- [ ] `TODO` scan live QR lỗi
- [ ] `TODO` dán mã serial lỗi
- [ ] `TODO` chọn ảnh QR lỗi
- [ ] `TODO` xác nhận QC thành công

### 6.2 Rule hậu QC
- [ ] `TODO` `LOI + THANH_LY` không còn cho dự án
- [ ] `TODO` `LOI + THANH_LY` vẫn vào nhánh khách lẻ
- [ ] `TODO` các số `Đạt / Lỗi` khớp với summary line

---

## 7. Tồn kho cọc thành phẩm

### 7.1 Summary view
- [ ] `TODO` mở `Tồn kho cọc thành phẩm`
- [ ] `TODO` lọc theo query
- [ ] `TODO` đổi scope `Tất cả / Có dự án / Có khách lẻ / Chờ xử lý`
- [ ] `TODO` summary vật lý / dự án / khách lẻ / chờ xử lý khớp dữ liệu nghiệp vụ

### 7.2 Detail view
- [ ] `TODO` mở serial detail của một item
- [ ] `TODO` detail khớp summary khi không có legacy gap
- [ ] `TODO` khi có legacy gap, cảnh báo/flow hiển thị đúng

### 7.3 Sau các flow chính
- [ ] `TODO` sau xuất hàng, summary/detail cập nhật đúng
- [ ] `TODO` sau trả hàng, summary/detail cập nhật đúng
- [ ] `TODO` sau QC lỗi thanh lý, dự án/khách lẻ hiển thị đúng
- [ ] `TODO` sau legacy reconciliation, gap và tồn hội tụ đúng

---

## 8. Cross-flow E2E bắt buộc

### 8.1 Flow chuẩn mới hoàn toàn
- [ ] `TODO` bóc tách -> báo giá -> đơn hàng -> kế hoạch SX -> thực SX -> lot/serial -> QC -> phiếu xuất -> xuất theo serial -> trả hàng -> tồn kho

### 8.2 Flow khách lẻ
- [ ] `TODO` hàng thanh lý / khách lẻ đi đúng sang `Bán tồn kho`
- [ ] `TODO` xuất khách lẻ không làm sai số dự án

### 8.3 Flow trả hàng
- [ ] `TODO` xuất 2, trả 2 thì `Đã giao` về 0 cho dòng đó
- [ ] `TODO` `Thực xuất` của chính phiếu giữ nguyên theo lịch sử phiếu
- [ ] `TODO` hướng `Nhập về cho dự án` làm dự án + khách lẻ cùng thấy
- [ ] `TODO` hướng `Nhập về khách lẻ` chỉ khách lẻ thấy

### 8.4 Flow legacy
- [ ] `TODO` một phiếu xuất tay cũ có thể được đối soát dần bằng serial
- [ ] `TODO` sau đối soát, summary tồn thay đổi đúng
- [ ] `TODO` sau đối soát đủ hết, phiếu biến mất khỏi danh sách legacy gap

---

## 9. Performance checklist

### 9.1 Màn nặng cần đo
- [ ] `TODO` `don-hang/phieu-xuat`
- [ ] `TODO` `ton-kho/thanh-pham`
- [ ] `TODO` `san-xuat/ke-hoach-ngay/[plan_id]`
- [ ] `TODO` `san-xuat/qc-nghiem-thu`
- [ ] `TODO` `boc-tach/boc-tach-nvl/[boc_id]`

### 9.2 Dấu hiệu cần note khi test
- [ ] `TODO` click action có bị full refresh không cần thiết không
- [ ] `TODO` mở detail có chậm bất thường không
- [ ] `TODO` scan/submit có lag không
- [ ] `TODO` filter/search có render chậm không

---

## 10. Điều kiện để chốt thay `v1`
- [ ] `TODO` tất cả flow chính pass ở `v2`
- [ ] `TODO` các action phụ quan trọng pass
- [ ] `TODO` không còn lỗi nghiêm trọng theo role
- [ ] `TODO` tồn kho thành phẩm khớp sau các flow chính
- [ ] `TODO` legacy reconciliation hoạt động ổn trên dữ liệu thật
- [ ] `TODO` performance ở các màn nặng chấp nhận được

## Gợi ý cách làm việc tiếp theo
1. test theo role và đánh dấu trực tiếp vào file này
2. mỗi lỗi fail thì link về đúng file/module ở `v2`
3. sau khi checklist gần đầy đủ, mới cân nhắc cutover khỏi `v1`
