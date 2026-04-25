# V2 Tầng 3 - Hướng Dẫn Thao Tác Role Thủ kho

Mục tiêu của tài liệu này:
- hướng dẫn đúng các việc `Thủ kho` cần làm trên phần mềm `v2`
- bám đúng quy trình tầng 1 và RACI tầng 2 đã chốt
- giúp user mới biết vào đúng menu, làm đúng thứ tự và hiểu khi nào một bước được coi là hoàn tất

Tài liệu liên quan:
- [V2_BUSINESS_PROCESS_LAYER_1.md](/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_BUSINESS_PROCESS_LAYER_1.md)
- [V2_BUSINESS_PROCESS_LAYER_2_RACI.md](/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_BUSINESS_PROCESS_LAYER_2_RACI.md)

## 1. Vai trò của Thủ kho trong phần mềm hiện tại

`Thủ kho` là role trực tiếp xử lý các bước làm thay đổi tồn kho hoặc gắn với hàng hóa thực tế:
- nhận hàng NVL theo PO và ghi sổ nhập kho
- kết thúc PO NVL khi không nhận thêm
- nhập kho cọc thành phẩm mua ngoài
- lưu phiếu xuất NVL cho sản xuất
- xác nhận thực xuất NVL bán / điều chuyển
- xác nhận giao hàng cọc thành phẩm
- theo dõi tồn thực NVL, tồn thành phẩm, serial, bãi
- thực hiện một số bước kiểm kê theo quyền kho

Nguyên tắc quan trọng:
- chỉ khi `Thủ kho` xác nhận đúng bước kho thì tồn mới thay đổi
- nếu chỉ tạo phiếu, lưu nháp hoặc mở chi tiết mà chưa xác nhận thì tồn chưa thay đổi
- khi nghi ngờ số tồn, luôn đối chiếu lại ở màn `Tồn thực NVL` hoặc `Tồn cọc thành phẩm`
- trong cách dùng thực tế hiện tại, `Thủ kho` không được xem là role lập đề xuất NVL; màn `Mua hàng NVL` của kho được dùng chủ yếu cho nhận hàng và ghi sổ

## 2. Menu Thủ kho cần dùng

Theo menu hiện tại của role `Thủ kho`, các mục chính là:

### 2.1 Kho

- `Phiếu xuất hàng cọc TP`
  - route: `/don-hang/phieu-xuat`
- `Phiếu xuất hàng NVL`
  - route: `/don-hang/phieu-xuat/nvl`
- `Nhập kho cọc ngoài`
  - route: `/san-xuat/mua-coc-ngoai`
- `Nhu cầu NVL`
  - route: `/ton-kho/nvl/nhu-cau`
- `Mua hàng NVL`
  - route: `/ton-kho/nvl/mua-hang`
- `Tồn thực NVL`
  - route: `/ton-kho/nvl/ton-thuc`
- `Tồn cọc thành phẩm`
  - route: `/ton-kho/thanh-pham`
- `Tra cứu mã cọc`
  - route: `/ton-kho/thanh-pham/tra-cuu-coc`
- `Scan nội bộ`
  - route: `/ton-kho/thanh-pham/vi-tri-bai/noi-bo`
- `Serial theo bãi`
  - route: `/ton-kho/thanh-pham/vi-tri-bai`
- `Gán serial vào bãi`
  - route: `/ton-kho/thanh-pham/vi-tri-bai/gan-bai`
- `In QR bãi`
  - route: `/ton-kho/thanh-pham/vi-tri-bai/ma-qr`
- `Đối soát serial legacy`
  - route: `/ton-kho/thanh-pham/doi-soat-legacy`

### 2.2 Kiểm kê

- `Vật tư`
  - route: `/ton-kho/kiem-ke`
- `Cọc thành phẩm`
  - route: `/ton-kho/thanh-pham/kiem-ke`

### 2.3 Sản xuất

- `Kế hoạch đã chốt`
  - route: `/san-xuat/ke-hoach-ngay`

## 3. Việc Thủ kho làm hằng ngày

Thứ tự nên theo dõi mỗi ngày:
1. mở `Dashboard` để xem việc ưu tiên của kho
2. xử lý `Mua hàng NVL` nếu có PO đang nhận hoặc receipt chờ ghi sổ
3. xử lý `Kế hoạch đã chốt` để lưu phiếu xuất NVL sản xuất
4. xử lý `Phiếu xuất hàng NVL` nếu có phiếu chờ xác nhận
5. xử lý `Phiếu xuất hàng cọc TP` nếu có phiếu chờ giao
6. kiểm tra `Tồn thực NVL` và `Tồn cọc thành phẩm` nếu cần đối chiếu

## 4. Flow 1 - Nhận hàng nguyên vật liệu

Màn dùng:
- `/ton-kho/nvl/mua-hang`

Khi nào dùng:
- có PO NVL đang mở
- NCC giao hàng về kho
- cần tạo đợt nhập, lưu số nhận và ghi sổ

Các bước thao tác:
1. vào `Mua hàng NVL`
2. ở bảng trên, bấm vào dòng `PO` cần nhận
3. ở block chi tiết bên dưới:
   - kiểm tra các mặt hàng trong PO
   - xem các đợt nhập đã có
4. nếu là đợt hàng mới:
   - bấm `Tạo phiếu nhập`
5. nhập số liệu cho từng dòng:
   - `SL nhận`
   - `SL đạt`
6. nếu chưa chốt được ngay:
   - bấm `Lưu nháp`
7. khi số liệu đã đúng:
   - bấm `Ghi sổ`
8. kiểm tra thông báo thành công
9. nếu PO không nhận thêm nữa:
   - dùng thao tác `Kết thúc đơn`

Kết quả đúng sau khi xong:
- receipt chuyển khỏi trạng thái nháp
- tồn thực NVL tăng theo phần được ghi nhận
- KTMH có thể vào chốt đợt đó

Điểm cần chú ý:
- tạo PO hoặc tạo receipt chưa làm tăng tồn
- chỉ `Ghi sổ` mới làm tăng tồn
- nếu PO còn khả năng nhận thêm thì chưa nên `Kết thúc đơn`

## 5. Flow 2 - Nhập kho cọc thành phẩm mua ngoài

Màn dùng:
- `/san-xuat/mua-coc-ngoai`

Khi nào dùng:
- KTMH đã lập xong PO cọc ngoài
- hàng cọc ngoài về kho

Các bước thao tác:
1. vào `Nhập kho cọc ngoài`
2. mở đúng PO cần nhận
3. nhập số lượng thực nhận theo từng dòng
4. xác nhận nhập kho
5. kiểm tra hệ thống đã sinh lô và serial

Kết quả đúng sau khi xong:
- tồn cọc thành phẩm tăng
- xem được bucket mới ở `Tồn cọc thành phẩm`
- mở chi tiết sẽ thấy serial tương ứng

Điểm cần chú ý:
- chỉ sau bước nhập kho thành công thì serial mới sinh
- nếu hàng chưa đủ điều kiện nhập thì không nên xác nhận

## 6. Flow 3 - Lưu phiếu xuất NVL cho sản xuất

Màn dùng:
- `/san-xuat/ke-hoach-ngay`
- `/san-xuat/ke-hoach-ngay/[plan_id]`

Khi nào dùng:
- kế hoạch ngày đã được chốt
- kho cần cấp NVL cho sản xuất

Các bước thao tác:
1. vào `Kế hoạch đã chốt`
2. mở đúng kế hoạch cần vận hành
3. nhập dữ liệu xuất NVL theo kế hoạch
4. lưu phiếu xuất NVL sản xuất
5. nếu có quyền và cần thao tác tiếp ở từng dòng:
   - xác nhận thực sản xuất cho dòng kế hoạch

Kết quả đúng sau khi xong:
- movement xuất NVL sản xuất được ghi nhận
- tồn thực NVL giảm theo số xuất
- kế hoạch đủ điều kiện hơn để đi tiếp sang nghiệm thu QC

Điểm cần chú ý:
- phần mềm hiện tại tách thành:
  - lưu phiếu xuất NVL sản xuất
  - xác nhận thực sản xuất từng dòng
- nếu chưa lưu/xác nhận đúng thì QC chưa nên nghiệm thu

## 7. Flow 4 - Xác nhận phiếu xuất NVL bán / điều chuyển

Màn dùng:
- `/don-hang/phieu-xuat/nvl`

Khi nào dùng:
- KTBH đã tạo phiếu xuất NVL
- kho chuẩn bị xuất thực tế

Các bước thao tác:
1. vào `Phiếu xuất hàng NVL`
2. chọn đúng phiếu trong `Danh sách phiếu`
3. xem chi tiết phiếu phía dưới
4. nhập `SL thực xuất` cho từng dòng
5. nhập `Ghi chú xác nhận` nếu cần
6. bấm `Xác nhận xuất`

Kết quả đúng sau khi xong:
- trạng thái phiếu chuyển theo số đã xuất
- tồn thực NVL giảm theo `SL thực xuất`
- lịch sử biến động NVL có thêm dòng movement tương ứng

Điểm cần chú ý:
- kho không được xác nhận vượt tồn khả dụng
- phiếu có thể được lập dù tồn chưa đủ, nhưng bước xác nhận kho sẽ chặn nếu vượt tồn

## 8. Flow 5 - Xác nhận giao hàng cọc thành phẩm

Màn dùng:
- `/don-hang/phieu-xuat`

Khi nào dùng:
- KTBH đã lập phiếu xuất hàng cọc thành phẩm
- kho chuẩn bị giao hàng thực tế

Các bước thao tác:
1. vào `Phiếu xuất hàng cọc TP`
2. mở đúng phiếu cần giao
3. quét hoặc chọn các serial thực giao
4. kiểm tra lại số lượng thực tế
5. xác nhận giao hàng

Kết quả đúng sau khi xong:
- serial chuyển trạng thái ra khỏi kho
- tồn cọc thành phẩm giảm
- lịch sử serial và phiếu xuất được cập nhật

Điểm cần chú ý:
- phải chọn đúng serial thực giao
- nếu cần đối chiếu trước khi giao, vào `Tồn cọc thành phẩm` hoặc `Serial theo bãi`

## 9. Flow 6 - Theo dõi tồn thực NVL

Màn dùng:
- `/ton-kho/nvl/ton-thuc`

Mục đích:
- kiểm tra tồn vật lý
- kiểm tra có thể xuất
- xem chờ xử lý
- xem lịch sử movement của từng mã NVL

Các bước thao tác:
1. vào `Tồn thực NVL`
2. dùng ô tìm kiếm và bộ lọc để tìm đúng mã hàng
3. bấm vào dòng NVL cần xem
4. đọc phần lịch sử biến động ở dưới

Hiểu nhanh các chỉ số:
- `Tồn vật lý`: số đang có theo movement hiện tại
- `Có thể xuất`: số còn có thể xuất ngay
- `Chờ xử lý`: phần đang giữ lại theo logic xử lý hiện có

Khi nào nên dùng:
- sau khi ghi sổ receipt NVL
- sau khi xuất NVL cho sản xuất
- sau khi xác nhận phiếu xuất NVL bán / điều chuyển
- khi cần kiểm tra vì sao số tồn lệch với dự kiến

## 10. Flow 7 - Theo dõi tồn cọc thành phẩm và serial

Màn dùng:
- `/ton-kho/thanh-pham`
- `/ton-kho/thanh-pham/vi-tri-bai`
- `/ton-kho/thanh-pham/vi-tri-bai/gan-bai`
- `/ton-kho/thanh-pham/vi-tri-bai/ma-qr`

Mục đích:
- xem tổng tồn theo mã cọc
- mở danh sách serial của từng mã
- biết serial đang ở bãi nào
- gán serial vào bãi hoặc in QR bãi khi cần

Các bước thao tác cơ bản:
1. vào `Tồn cọc thành phẩm`
2. tìm đúng mã cọc
3. bấm vào dòng để mở chi tiết serial ở dưới
4. nếu cần quản lý vị trí:
   - vào `Serial theo bãi`
   - hoặc `Gán serial vào bãi`
5. nếu cần tem bãi:
   - vào `In QR bãi`

Khi nào nên dùng:
- sau khi QC nghiệm thu xong
- sau khi nhập kho cọc mua ngoài
- trước khi giao hàng
- khi cần truy tìm serial đang nằm ở khu nào

## 11. Flow 8 - Tra cứu mã cọc và scan nội bộ

Màn dùng:
- `/ton-kho/thanh-pham/tra-cuu-coc`
- `/ton-kho/thanh-pham/vi-tri-bai/noi-bo`

Mục đích:
- tra từ thông số ra mã cọc phù hợp
- tra nhanh serial trong thao tác nội bộ

Khi nào nên dùng:
- khi kho cần xác minh nhanh hàng thực tế là mã nào
- khi đối chiếu hàng ở bãi hoặc trên tem

## 12. Flow 9 - Kiểm kê

Màn dùng:
- `/ton-kho/kiem-ke`
- `/ton-kho/thanh-pham/kiem-ke`

Mục đích:
- hỗ trợ kho kiểm kê vật tư và cọc thành phẩm theo đúng quyền

Lưu ý:
- kiểm kê là luồng riêng
- chỉ làm khi có kế hoạch kiểm kê hoặc cần điều chỉnh tồn theo quy trình đã thống nhất

## 13. Cách tự kiểm tra sau mỗi thao tác kho

Sau mỗi nghiệp vụ, `Thủ kho` nên tự kiểm tra nhanh:

### 13.1 Sau khi ghi sổ receipt NVL

- vào `Tồn thực NVL`
- tìm đúng mã vừa nhập
- kiểm tra tồn tăng lên đúng số

### 13.2 Sau khi lưu/xác nhận xuất NVL sản xuất

- vào `Tồn thực NVL`
- kiểm tra movement xuất sản xuất đã xuất hiện
- kiểm tra tồn giảm đúng

### 13.3 Sau khi xác nhận xuất NVL bán / điều chuyển

- vào `Tồn thực NVL`
- kiểm tra movement của phiếu `PX-NVL`
- kiểm tra tồn giảm đúng theo `SL thực xuất`

### 13.4 Sau khi nhập kho cọc ngoài hoặc QC nghiệm thu

- vào `Tồn cọc thành phẩm`
- tìm đúng mã cọc
- mở dòng ra xem serial có xuất hiện chưa

### 13.5 Sau khi xác nhận giao hàng

- vào `Tồn cọc thành phẩm`
- kiểm tra số bucket/serial đã giảm
- nếu cần, mở phiếu để đối chiếu serial đã giao

## 14. Các lỗi user kho hay gặp

### 14.1 Tạo phiếu xong tưởng đã đổi tồn

Không đúng.
Chỉ bước `Ghi sổ`, `Xác nhận xuất`, `Xác nhận giao`, hoặc bước kho tương đương mới đổi tồn.

### 14.2 Chưa kiểm tra tồn nhưng đã xác nhận xuất

Kho phải đọc lại `Có thể xuất` trước khi chốt phiếu xuất NVL.

### 14.3 Nhầm giữa lưu nháp và hoàn tất

- `Lưu nháp`: chỉ giữ số liệu
- `Ghi sổ` hoặc `Xác nhận`: mới tạo movement thật

### 14.4 Không mở lại màn tồn để tự đối chiếu

Sau mỗi bước kho quan trọng, nên kiểm tra lại ngay ở:
- `Tồn thực NVL`
- hoặc `Tồn cọc thành phẩm`

## 15. Checklist thao tác nhanh cho Thủ kho

Đầu ngày:
- mở `Dashboard`
- xem `PO đang nhận`
- xem `Chờ ghi sổ`
- xem `Phiếu xuất hàng`
- xem `Kế hoạch đã chốt`

Khi hàng NVL về:
- mở `Mua hàng NVL`
- chọn đúng PO
- tạo đợt nhận
- nhập số nhận / đạt
- ghi sổ

Khi xuất NVL cho sản xuất:
- mở `Kế hoạch đã chốt`
- lưu phiếu xuất NVL sản xuất
- xác nhận thực sản xuất nếu cần
- kiểm tra lại `Tồn thực NVL`

Khi có phiếu xuất NVL bán / điều chuyển:
- mở `Phiếu xuất hàng NVL`
- nhập `SL thực xuất`
- xác nhận xuất
- kiểm tra lại `Tồn thực NVL`

Khi giao cọc thành phẩm:
- mở `Phiếu xuất hàng cọc TP`
- chọn đúng serial
- xác nhận giao
- kiểm tra lại `Tồn cọc thành phẩm`

## 16. Bước tiếp theo

Sau tài liệu `Thủ kho`, nên làm tiếp:
- `KTMH`
- `QLSX`
- `KTBH`
- `QC`
