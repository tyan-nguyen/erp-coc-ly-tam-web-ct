# V2 Go-Live Checklist

Checklist này dùng để rà lần cuối trước khi đưa hệ thống cho người dùng nội bộ sử dụng thật.

Nguyên tắc dùng:

- Chỉ tick khi đã test xong bằng thao tác thực tế.
- Nếu lỗi, ghi rõ lỗi vào cuối mục đó rồi fix theo scope nhỏ.
- Không sửa lan man ngoài checklist khi đang gần go-live.

## 1. Chốt bản dùng

- [ ] Đã lưu một bản backup source code an toàn trước khi tiếp tục sửa.
- [ ] Đã xác định rõ folder đang làm việc chính và folder backup.
- [ ] Đã chốt danh sách module sẽ đưa vào đợt go-live đầu tiên.
- [ ] Đã thống nhất các mục nào để sau go-live mới làm tiếp.

## 2. Dữ liệu đầu kỳ

- [ ] Đã xóa hoặc tách riêng toàn bộ dữ liệu test.
- [ ] Đã chốt danh mục khách hàng thật.
- [ ] Đã chốt danh mục nhà cung cấp thật.
- [ ] Đã chốt danh mục dự án thật.
- [ ] Đã chốt danh mục NVL thật.
- [ ] Đã chốt loại cọc mẫu, định mức, cấp phối dùng thật.
- [ ] Đã chốt tồn đầu kỳ NVL.
- [ ] Đã chốt tồn đầu kỳ cọc thành phẩm.
- [ ] Đã chốt khu vực tồn, bãi, quy ước kho.

## 3. Quyền theo role

- [ ] Menu, page và API của `QLSX` đi đúng nhau.
- [ ] Menu, page và API của `Kỹ thuật` đi đúng nhau.
- [ ] Menu, page và API của `KTBH` đi đúng nhau.
- [ ] Menu, page và API của `KTMH` đi đúng nhau.
- [ ] Menu, page và API của `Thủ kho` đi đúng nhau.
- [ ] Menu, page và API của `QC` đi đúng nhau.
- [ ] Menu, page và API của `Admin` đi đúng nhau.
- [ ] Không còn tình trạng thấy menu nhưng bấm vào bị đá về dashboard.

## 4. Chuẩn mã và dữ liệu khóa

- [ ] Mã NVL hiển thị đã thống nhất một chuẩn.
- [ ] Mã cọc hiển thị đã thống nhất một chuẩn.
- [ ] Mã phiếu mua, phiếu nhập, phiếu xuất, đề xuất mua cọc ngoài, phiếu xuất NVL đã theo đúng quy tắc đã chốt.
- [ ] Không còn chỗ dùng UUID thô để hiển thị cho user nếu đã có mã nghiệp vụ.
- [ ] Các read-model tồn kho đang đọc đúng mã chuẩn thay vì lệch giữa UUID và mã hiển thị.

## 5. Luồng nghiệp vụ chính

### 5.1 QLSX

- [ ] Lập dự toán.
- [ ] Duyệt dự toán.
- [ ] Tạo và chốt kế hoạch sản xuất ngày.
- [ ] Theo dõi đúng số lượng cần sản xuất và đã sản xuất.

### 5.2 Xuất NVL cho sản xuất

- [ ] Thủ kho xác nhận xuất NVL cho sản xuất.
- [ ] Có sinh movement kho.
- [ ] Tồn thực NVL giảm đúng.
- [ ] Lịch sử biến động hiện đúng dòng `Xuất SX`.

### 5.3 QC và nhập kho thành phẩm

- [ ] QC nghiệm thu thành phẩm.
- [ ] Thành phẩm vào tồn kho đúng số lượng.
- [ ] Serial/lô sinh đúng quy tắc đã chốt.

### 5.4 Mua NVL

- [ ] QLSX/KTMH tạo đề xuất NVL.
- [ ] KTMH lập PO đúng.
- [ ] Thủ kho nhận từng đợt đúng.
- [ ] KTMH chốt từng đợt đúng.
- [ ] Tồn thực NVL tăng đúng theo hàng đạt.

### 5.5 Phiếu xuất NVL

- [ ] KTBH lập phiếu xuất NVL.
- [ ] Thủ kho xác nhận số thực xuất.
- [ ] Tồn thực NVL giảm đúng theo số thực xuất.
- [ ] Lịch sử biến động hiện đúng `Xuất bán NVL` hoặc `Điều chuyển NVL`.

### 5.6 Phiếu xuất cọc thành phẩm

- [ ] KTBH lập phiếu xuất cọc.
- [ ] Thủ kho xác nhận xuất.
- [ ] Serial/cọc bị trừ đúng.
- [ ] Lịch sử xuất hiện đúng.

## 6. Tồn kho và đối chiếu

- [ ] `Tồn vật lý` khớp với lịch sử nhập trừ xuất.
- [ ] `Có thể xuất` khớp công thức `Tồn vật lý - Chờ xử lý`.
- [ ] `Chờ xử lý` không vượt quá tồn vật lý.
- [ ] Không còn mã NVL bị âm bất thường nếu không có chủ đích.
- [ ] Không còn mã cọc hoặc serial sai trạng thái.
- [ ] Các phiếu đã xác nhận đều phản ánh vào tồn kho.

## 7. Màn hình và thao tác

- [ ] Các màn quan trọng dùng desktop đã ổn.
- [ ] Các màn cần xem nhanh trên điện thoại đã dùng được.
- [ ] Các bảng lớn có tìm kiếm/bộ lọc hoạt động đúng.
- [ ] Click row mở/đóng detail hoạt động đúng.
- [ ] Không còn lỗi render giật, hydration mismatch, useEffect dependency lỗi ở các màn chính.
- [ ] Không còn block thông tin trùng gây rối thao tác.

## 8. Dashboard theo role

- [ ] Dashboard `QLSX` chỉ hiện việc liên quan role đó.
- [ ] Dashboard `KTBH` chỉ hiện việc liên quan role đó.
- [ ] Dashboard `KTMH` chỉ hiện việc liên quan role đó.
- [ ] Dashboard `Thủ kho` chỉ hiện việc liên quan role đó.
- [ ] Dashboard `QC` chỉ hiện việc liên quan role đó.
- [ ] Số liệu trên dashboard không lệch với số liệu ở màn nghiệp vụ.

## 9. Hạ tầng và vận hành

- [ ] Đã xác định domain/subdomain chạy thật.
- [ ] Đã xác định ai phụ trách deploy production.
- [ ] Đã chuẩn bị danh sách environment variables cần dùng.
- [ ] Đã chuẩn bị SQL/schema cần chạy trên database production.
- [ ] Đã có phương án backup source code.
- [ ] Đã có phương án backup database.
- [ ] Đã có người hỗ trợ xử lý sự cố trong tuần đầu go-live.

## 10. UAT cuối cùng

- [ ] Mỗi role đã test ít nhất 1 vòng nghiệp vụ hoàn chỉnh.
- [ ] Đã có xác nhận từ user đại diện từng role.
- [ ] Không còn lỗi chặn vận hành.
- [ ] Các lỗi nhỏ còn lại đã được ghi vào backlog sau go-live.

## 11. Không sửa thêm nếu chưa thật sự cần

- [ ] Không tiếp tục thay đổi giao diện lớn khi nghiệp vụ đã ổn.
- [ ] Không refactor rộng trước go-live.
- [ ] Chỉ sửa các lỗi ảnh hưởng trực tiếp tới thao tác hoặc số liệu.

## Ghi chú lỗi / backlog

- ...
- ...
- ...
