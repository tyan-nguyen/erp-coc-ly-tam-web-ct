# V2 KTBH Test Runbook

Mục tiêu:
- test nhanh nhưng không bỏ sót các flow KTBH quan trọng trong `v2`
- bám đúng UX của `v1`
- phát hiện fail nghiệp vụ tách biệt với fail hiệu năng

Repo:
- `v1`: `/Users/duynguyen/Desktop/erp-coc-ly-tam-web`
- `v2`: `/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2`

Môi trường chạy `v2`:
- [http://localhost:3010](http://localhost:3010)

Tài liệu liên quan:
- [/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_V1_PARITY_AUDIT.md](/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_V1_PARITY_AUDIT.md)
- [/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_ROLE_FLOW_TEST_CHECKLIST.md](/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_ROLE_FLOW_TEST_CHECKLIST.md)

## 1. Thứ tự test đề xuất
1. Báo giá
2. Đơn hàng
3. Phiếu xuất theo đơn hàng
4. Phiếu xuất bán tồn kho
5. Trả hàng sau giao
6. Đối chiếu tồn sau xử lý trả hàng

Lý do:
- đây là đúng nhịp dữ liệu của KTBH
- nếu fail ở đầu chuỗi thì không kéo nhiễu sang bước sau

## 2. Flow 1: Báo giá
Route:
- [http://localhost:3010/don-hang/bao-gia](http://localhost:3010/don-hang/bao-gia)
- [http://localhost:3010/don-hang/lap-bao-gia](http://localhost:3010/don-hang/lap-bao-gia)

Cần test:
- mở list báo giá
- tìm/lọc theo mã, dự án, khách hàng
- mở chi tiết một báo giá
- đổi trạng thái `Đã gửi khách`
- đổi trạng thái `Thành công`
- duyệt sản xuất nếu role phù hợp
- lập báo giá từ dữ liệu bóc tách

Kỳ vọng:
- đổi trạng thái không reload cả page
- sau đổi trạng thái, dòng vừa chọn cập nhật ngay trên list
- duyệt sản xuất xong, báo giá bị khóa đúng như `v1`

## 3. Flow 2: Đơn hàng
Route:
- [http://localhost:3010/don-hang](http://localhost:3010/don-hang)
- [http://localhost:3010/don-hang/[order_id]](http://localhost:3010/don-hang)

Cần test:
- mở list đơn hàng
- mở detail một đơn hàng
- chuyển trạng thái đúng quyền của KTBH/Admin

Kỳ vọng:
- detail mở giống `v1`
- chuyển trạng thái không reload cả route
- trạng thái và timeline cập nhật ngay tại detail

## 4. Flow 3: Phiếu xuất theo đơn hàng
Route:
- [http://localhost:3010/don-hang/phieu-xuat](http://localhost:3010/don-hang/phieu-xuat)

Cần test:
- chọn `Theo đơn hàng`
- chọn đúng đơn hàng có nhiều đoạn
- thấy đủ tất cả đoạn của báo giá kể cả `Có thể giao = 0`
- nhập `SL đề nghị xuất` vượt `Có thể giao`
- lập phiếu xuất
- mở lại detail phiếu vừa tạo

Kỳ vọng:
- tạo phiếu xong không reload cả page
- phiếu mới xuất hiện ngay trong list
- phiếu mới tự mở detail
- UX và bố cục giống `v1`

## 5. Flow 4: Phiếu xuất bán tồn kho
Route:
- [http://localhost:3010/don-hang/phieu-xuat](http://localhost:3010/don-hang/phieu-xuat)

Cần test:
- chọn `Bán tồn kho`
- chọn khách hàng
- thêm 1 hoặc nhiều dòng hàng tồn
- nhập đơn giá
- lập phiếu xuất

Kỳ vọng:
- chỉ hiện hàng tồn phù hợp để bán
- không cho đơn giá bằng `0`
- tạo phiếu xong cập nhật ngay tại list

## 6. Flow 5: Trả hàng sau giao
Route:
- [http://localhost:3010/don-hang/phieu-xuat](http://localhost:3010/don-hang/phieu-xuat)

Cần test ở vai KTBH:
- mở phiếu đã xuất
- nhập `SL trả lại`
- gửi đề nghị trả hàng

Kỳ vọng:
- không bị đòi serial ở bước KTBH
- gửi đề nghị xong không reload cả page
- detail phiếu cập nhật ngay trạng thái đề nghị trả

## 7. Flow 6: Đối chiếu sau kho xử lý
Sau khi kho xử lý trả hàng:
- quay lại `Theo đơn hàng`
- kiểm tra `Đã giao` là số giao ròng
- kiểm tra `Bán tồn kho` và `Tồn kho thành phẩm` nếu case có hàng `NHAP_KHACH_LE`

Kỳ vọng:
- `Đã giao` phản ánh giao ròng
- hướng `Nhập về cho dự án` làm dự án + khách lẻ cùng thấy
- hướng `Nhập về khách lẻ` chỉ khách lẻ thấy

## 8. Ghi lỗi khi test
Mỗi fail nên ghi tối thiểu:
- route
- role
- bước bấm cuối cùng
- kỳ vọng
- thực tế
- có chậm bất thường hay không

Format ngắn gợi ý:
- `FAIL | KTBH | /don-hang/phieu-xuat | bấm Lập phiếu xuất | kỳ vọng phiếu mới tự hiện | thực tế đứng spinner 5s rồi mới lên`

## 9. Trạng thái tối ưu hiện tại
Đã tối ưu trong `v2`:
- `báo giá`: đổi trạng thái, duyệt sản xuất
- `đơn hàng`: chuyển trạng thái
- `phiếu xuất`: lập phiếu, gửi đề nghị trả hàng

Chưa ưu tiên tối ưu ở vòng này:
- action của kho
- builder phụ
- các flow không phải trục chính của KTBH
