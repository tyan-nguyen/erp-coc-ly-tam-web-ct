# V2 Business Process Layer 1

Mục tiêu của tài liệu này:
- chốt lại tầng 1 là quy trình nghiệp vụ bám theo phần mềm hiện tại
- trả lời rõ công việc bắt đầu từ đâu, đi qua những bước nào, ai làm ở mỗi bước
- chỉ ra bước duyệt, bước xác nhận, dữ liệu đầu ra của từng bước và khi nào kết thúc

Phạm vi tài liệu này:
- mô tả quy trình vận hành theo hệ thống `v2` đang có
- chưa đi sâu RACI chi tiết
- chưa đi sâu thao tác nút bấm theo màn hình

## 1. Role đang tham gia trong các quy trình lõi

- `QLSX`: lập kế hoạch, lập đề xuất NVL, lập đề xuất mua cọc ngoài
- `Thủ kho`: nhận hàng, ghi sổ nhập kho, xác nhận thực xuất, xác nhận thực sản xuất
- `KTMH`: duyệt mua, chọn NCC, lập PO, chốt đợt, xác nhận cuối PO
- `KTBH`: lập phiếu xuất hàng, lập phiếu xuất NVL bán/điều chuyển
- `QC`: nghiệm thu thành phẩm sau sản xuất
- `Kiểm kê viên`: nhập tồn đầu kỳ, lập phiếu kiểm kê vận hành, rà chênh lệch tồn
- `Admin`: quyền hỗ trợ/ghi đè trong trường hợp đặc biệt

## 2. Nguyên tắc chung của hệ thống hiện tại

- kế hoạch, đề xuất, PO là dữ liệu điều hành, chưa làm thay đổi tồn kho
- tồn kho chỉ thay đổi khi có movement thật do kho hoặc hệ thống ghi nhận
- một chứng từ đầu ra của bước trước là đầu vào của bước sau
- một số luồng cho phép chia nhiều đợt thay vì bắt buộc hoàn thành một lần

## 3. Quy trình 1: Mua nguyên vật liệu

### 3.1 Điểm bắt đầu

Luồng bắt đầu khi có nhu cầu NVL từ sản xuất.

Nguồn bắt đầu thực tế trong hệ thống:
- `QLSX` tạo đề xuất mua NVL

### 3.2 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | QLSX | Khởi tạo | Lập đề xuất NVL theo nhu cầu thực tế | Bản đề xuất mua NVL |
| 2 | KTMH | Duyệt | Xem đề xuất, chọn NCC nếu cần, lập phiếu mua | Phiếu mua NVL `PO-NVL` |
| 3 | Thủ kho | Thực hiện | Chọn một PO đang mở để theo dõi nhận hàng | PO được mở chi tiết để thao tác |
| 4 | Thủ kho | Thực hiện | Tạo một đợt nhận hàng mới cho PO khi hàng về | Phiếu nhập / đợt nhận `RCV-NVL` |
| 5 | Thủ kho | Xác nhận kho | Nhập số lượng nhận, số đạt, lưu nháp nếu cần | Phiếu nhập nháp hoặc đã đủ dữ liệu ghi sổ |
| 6 | Thủ kho | Xác nhận kho | Bấm `Ghi sổ` để ghi nhận tồn kho NVL | Movement nhập kho NVL của đợt nhận |
| 7 | KTMH | Chốt đợt | Chọn đúng đợt đã ghi sổ, chọn NCC của đợt, nhập SL tính tiền và đơn giá | Dữ liệu chốt công nợ cho từng đợt |
| 8 | Thủ kho | Kết thúc nhận hàng | Khi PO không nhận thêm nữa, dùng thao tác `Kết thúc đơn` | PO chuyển sang trạng thái đã dừng nhận thêm |
| 9 | KTMH | Xác nhận cuối | Sau khi tất cả đợt đã được chốt, xác nhận cuối PO | PO hoàn tất về mặt mua hàng |

### 3.3 Bước duyệt và bước xác nhận

- Bước duyệt:
  - `KTMH` duyệt đề xuất để tạo phiếu mua
- Bước xác nhận:
  - `Thủ kho` ghi sổ từng đợt nhập
  - `KTMH` chốt từng đợt
  - `KTMH` xác nhận cuối PO

### 3.4 Điều kiện chuyển bước quan trọng

- đề xuất NVL phải có dòng hợp lệ thì mới tạo PO được
- PO có thể có nhiều đợt nhận
- đợt nhận phải được `Thủ kho ghi sổ` thì `KTMH` mới chốt được
- `Thủ kho` có thể kết thúc đơn để chặn nhận thêm
- `KTMH` chỉ xác nhận cuối khi:
  - PO đã được kết thúc nhận hàng
  - tất cả đợt đã được chốt

### 3.5 Khi nào quy trình kết thúc

Quy trình kết thúc khi:
- không còn nhận thêm hàng cho PO
- tất cả đợt nhập của PO đã được chốt
- `KTMH` đã xác nhận cuối PO

### 3.6 Kết quả cuối cùng của quy trình

- tồn kho NVL đã tăng theo các đợt `ghi sổ`
- PO có trạng thái hoàn tất
- từng đợt có dữ liệu tính tiền và đơn giá để phục vụ công nợ

## 4. Quy trình 2: Mua cọc thành phẩm ngoài

### 4.1 Điểm bắt đầu

Luồng bắt đầu khi `QLSX` thấy cần mua cọc thành phẩm ngoài để đáp ứng sản xuất/tiến độ.

### 4.2 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | QLSX | Khởi tạo | Lập phiếu đề xuất mua cọc ngoài | Đề xuất mua cọc ngoài `PR-COC` |
| 2 | KTMH | Duyệt | Duyệt đề xuất, chọn NCC, lập phiếu mua | Phiếu mua cọc ngoài `PO-COC` |
| 3 | Thủ kho | Thực hiện | Theo dõi PO cọc ngoài và nhập kho theo thực nhận | Dữ liệu nhận hàng của PO |
| 4 | Thủ kho | Xác nhận kho | Xác nhận nhập kho cọc ngoài | Lô và serial thành phẩm được sinh |
| 5 | Hệ thống | Ghi nhận | Đưa cọc mua ngoài vào tồn kho thành phẩm | Tồn kho thành phẩm tăng |

### 4.3 Bước duyệt và bước xác nhận

- Bước duyệt:
  - `KTMH` duyệt đề xuất và lập phiếu mua
- Bước xác nhận:
  - `Thủ kho` xác nhận nhập kho đợt nhận

### 4.4 Điều kiện chuyển bước quan trọng

- đề xuất phải có dòng hàng hợp lệ
- `KTMH` phải chọn NCC trước khi lập phiếu mua
- khi `Thủ kho` nhập kho thành công thì hệ thống mới sinh lô/serial

### 4.5 Khi nào quy trình kết thúc

Quy trình kết thúc khi PO cọc ngoài đã được nhận đủ hoặc không còn phát sinh nhận thêm.

### 4.6 Kết quả cuối cùng của quy trình

- cọc mua ngoài xuất hiện trong tồn kho thành phẩm
- serial và lô được tạo để truy xuất tiếp ở các luồng sau

## 5. Quy trình 3: Kế hoạch sản xuất ngày -> Xuất NVL sản xuất -> QC nghiệm thu -> Nhập kho thành phẩm

### 5.1 Điểm bắt đầu

Luồng bắt đầu khi `QLSX` lập kế hoạch sản xuất ngày từ nhu cầu đơn hàng đã sẵn sàng.

### 5.2 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | QLSX | Khởi tạo | Lập kế hoạch sản xuất ngày | Kế hoạch ngày |
| 2 | KTBH / role duyệt sản xuất theo hệ thống hiện tại | Duyệt | Chốt kế hoạch ngày để cho phép xuống bước vận hành | Kế hoạch đã chốt |
| 3 | Thủ kho | Thực hiện | Xác nhận thực sản xuất và xuất NVL theo ngày thao tác | Phiếu xuất NVL sản xuất, movement xuất kho NVL |
| 4 | QC | Xác nhận chất lượng | Mở kế hoạch đã đủ điều kiện, nhập kết quả QC và xác nhận nghiệm thu | Phiếu nghiệm thu QC |
| 5 | Hệ thống | Ghi nhận | Từ phiếu nghiệm thu QC đã xác nhận, sinh lô/serial thành phẩm | Thành phẩm vào tồn kho, có serial truy xuất |

### 5.3 Bước duyệt và bước xác nhận

- Bước duyệt:
  - kế hoạch ngày phải được chốt trước khi vận hành
- Bước xác nhận:
  - `Thủ kho` xác nhận thực sản xuất và xuất NVL
  - `QC` xác nhận nghiệm thu QC

### 5.4 Điều kiện chuyển bước quan trọng

- chỉ được nghiệm thu QC khi kế hoạch đã chốt
- chỉ được nghiệm thu QC sau khi `Thủ kho` đã xác nhận thực sản xuất và xuất NVL
- chỉ khi QC xác nhận xong thì thành phẩm mới vào tồn kho thành phẩm

### 5.5 Khi nào quy trình kết thúc

Quy trình kết thúc khi:
- NVL cho ngày đó đã được xuất
- QC đã xác nhận nghiệm thu
- thành phẩm đã được nhập vào tồn kho thành phẩm và có serial

### 5.6 Kết quả cuối cùng của quy trình

- tồn kho NVL giảm theo phiếu xuất sản xuất
- tồn kho thành phẩm tăng theo kết quả nghiệm thu
- serial thành phẩm sẵn sàng cho tra cứu, xuất hàng, quản lý bãi

## 6. Quy trình 4: Phiếu xuất NVL bán / điều chuyển

### 6.1 Điểm bắt đầu

Luồng bắt đầu khi `KTBH` cần đề nghị xuất NVL ra ngoài kho để:
- xuất bán vật tư
- điều chuyển

Theo phần mềm hiện tại, phiếu đề xuất không bị giới hạn bởi tồn hiện tại lúc lập phiếu, nhưng `Thủ kho` không được xác nhận xuất vượt tồn khả dụng.

### 6.2 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | KTBH | Khởi tạo | Tạo phiếu xuất NVL, chọn loại phiếu, khách hàng, các dòng NVL, số lượng, đơn giá | Phiếu xuất NVL `PX-NVL` |
| 2 | Thủ kho | Thực hiện | Mở phiếu xuất NVL chờ xác nhận | Chi tiết phiếu để nhập `SL thực xuất` |
| 3 | Thủ kho | Xác nhận kho | Nhập số lượng thực xuất, ghi chú nếu cần, xác nhận xuất | Movement xuất kho NVL |
| 4 | Hệ thống | Ghi nhận | Cập nhật tồn kho NVL và lịch sử biến động | Tồn vật lý và khả dụng của NVL được cập nhật |

### 6.3 Bước duyệt và bước xác nhận

- không có lớp duyệt riêng trong luồng hiện tại
- bước xác nhận quyết định là `Thủ kho xác nhận xuất`

### 6.4 Điều kiện chuyển bước quan trọng

- `KTBH` tạo phiếu được dù NVL đang không có tồn
- nhưng `Thủ kho` không được xác nhận thực xuất vượt tồn khả dụng
- chỉ khi xác nhận xuất thành công thì tồn kho mới giảm

### 6.5 Khi nào quy trình kết thúc

Quy trình kết thúc khi `Thủ kho` đã xác nhận thực xuất đủ phần cần xuất của phiếu.

### 6.6 Kết quả cuối cùng của quy trình

- tồn kho NVL giảm theo số thực xuất
- lịch sử biến động NVL có thêm dòng xuất bán hoặc điều chuyển

## 7. Quy trình 5: Xuất hàng cọc thành phẩm

### 7.1 Điểm bắt đầu

Luồng bắt đầu khi `KTBH` cần lập phiếu xuất hàng:
- xuất theo đơn hàng
- hoặc xuất bán từ tồn kho

### 7.2 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | KTBH | Khởi tạo | Lập phiếu xuất hàng từ đơn hàng hoặc từ tồn kho | Phiếu xuất hàng |
| 2 | Thủ kho | Thực hiện | Mở phiếu, quét/chọn serial thực giao | Danh sách serial gắn với phiếu |
| 3 | Thủ kho | Xác nhận kho | Xác nhận giao hàng | Movement serial thành phẩm ra khỏi kho |
| 4 | Hệ thống | Ghi nhận | Cập nhật trạng thái serial và tồn kho thành phẩm | Tồn thành phẩm giảm, lịch sử serial tăng |
| 5 | KTBH / Thủ kho | Xử lý ngoại lệ | Nếu có trả hàng sau giao thì gửi đề nghị trả và kho xử lý | Hàng trả về được nhập lại theo hướng xử lý phù hợp |

### 7.3 Bước duyệt và bước xác nhận

- không có lớp duyệt mua hàng trong luồng này
- bước xác nhận quyết định là `Thủ kho xác nhận giao`

### 7.4 Điều kiện chuyển bước quan trọng

- serial phải hợp lệ và đủ điều kiện giao
- trạng thái phiếu, số lượng và hướng xử lý trả hàng phải khớp thực tế

### 7.5 Khi nào quy trình kết thúc

Quy trình kết thúc khi:
- phiếu xuất đã giao xong
- hoặc hàng trả sau giao đã được xử lý hết

### 7.6 Kết quả cuối cùng của quy trình

- tồn kho thành phẩm giảm theo serial giao đi
- nếu có trả hàng thì tồn được nhập lại theo đúng hướng xử lý

## 8. Quy trình 6: Tra cứu tồn và đối chiếu sau vận hành

### 8.1 Mục đích

Đây không phải luồng tạo chứng từ mới, nhưng là luồng theo dõi vận hành sau khi các bước chính đã diễn ra.

### 8.2 Nội dung theo dõi

- `Tồn thực NVL`
  - xem tồn vật lý
  - xem có thể xuất
  - xem chờ xử lý
  - xem lịch sử biến động
- `Tồn cọc thành phẩm`
  - xem tổng hợp theo mã cọc
  - mở danh sách serial
  - tra cứu vị trí bãi, kho, trạng thái
- `Tra cứu mã cọc`
  - từ thông số kỹ thuật tra ra mã cọc phù hợp
- `Tra cứu serial`
  - từ serial tra ra đầy đủ thông số, lô, bãi, hiển thị và trạng thái

### 8.3 Khi nào dùng

- sau khi mua NVL để kiểm tra kho đã ghi sổ chưa
- sau khi xuất NVL để kiểm tra movement đã trừ tồn chưa
- sau khi nghiệm thu để kiểm tra thành phẩm đã vào kho chưa
- trước khi xuất hàng để kiểm tra serial có sẵn và đang ở đâu

## 9. Quy trình 7: Mở tồn đầu kỳ

### 9.1 Điểm bắt đầu

Luồng này dùng khi bắt đầu vận hành chính thức hoặc cần đưa tồn có thật ngoài hệ thống vào hệ thống làm mốc ban đầu.

Có 2 nhánh đang có trong phần mềm:
- `NVL`: đi qua màn `Kiểm kê vật tư` với loại phiếu `Nhập tồn đầu kỳ`
- `Cọc thành phẩm`: đi qua màn `Mở tồn đầu kỳ cọc thành phẩm`

### 9.2 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | Thủ kho / Kiểm kê viên | Khởi tạo | Nhập số tồn đầu kỳ thực tế vào phiếu hoặc màn mở tồn | Phiếu tồn đầu kỳ / dữ liệu lô đầu kỳ |
| 2 | Thủ kho / Kiểm kê viên | Xác nhận đầu vào | Kiểm tra lại số lượng, kho, vị trí, ghi chú | Dữ liệu chờ ghi nhận vào tồn |
| 3 | KTMH / Admin | Duyệt chênh lệch NVL | Với nhánh NVL, duyệt phiếu tồn đầu kỳ để ghi movement `OPENING_BALANCE` | Movement tồn đầu kỳ NVL |
| 4 | Hệ thống | Ghi nhận | Với nhánh cọc thành phẩm, sinh lô và serial tồn đầu kỳ | Lô/serial thành phẩm đầu kỳ |

### 9.3 Bước duyệt và bước xác nhận

- Với `NVL`:
  - `Thủ kho` hoặc `Kiểm kê viên` nhập dữ liệu đầu kỳ
  - `Thủ kho` xác nhận kho
  - `KTMH` hoặc `Admin` duyệt để ghi điều chỉnh tồn đầu kỳ
- Với `Cọc thành phẩm`:
  - `Thủ kho` hoặc `Kiểm kê viên` nhập dữ liệu mở tồn
  - hệ thống sinh lô/serial ngay theo dữ liệu đã nhập

### 9.4 Khi nào quy trình kết thúc

Quy trình kết thúc khi:
- tồn đầu kỳ NVL đã được ghi movement
- hoặc tồn đầu kỳ cọc thành phẩm đã sinh đủ lô/serial và xuất hiện trong tồn

### 9.5 Kết quả cuối cùng của quy trình

- hệ thống có mốc tồn đầu kỳ để vận hành thật
- các báo cáo tồn và tra cứu serial có dữ liệu gốc ban đầu

## 10. Quy trình 8: Kiểm kê vận hành và điều chỉnh tồn

### 10.1 Điểm bắt đầu

Luồng này dùng khi cần đối chiếu tồn hệ thống với tồn thực tế trong kho trong quá trình vận hành.

Phần mềm hiện có 2 nhóm:
- `Kiểm kê NVL`
- `Kiểm kê cọc thành phẩm`

### 10.2 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | Thủ kho / Kiểm kê viên | Khởi tạo | Tạo phiếu kiểm kê vận hành | Phiếu kiểm kê |
| 2 | Thủ kho / Kiểm kê viên | Nhập số liệu | Nhập số đếm thực tế, chênh lệch, ghi chú | Phiếu kiểm kê đã có chênh lệch |
| 3 | Thủ kho | Xác nhận kho | Xác nhận số liệu kho đã kiểm lại | Phiếu chờ duyệt chênh lệch |
| 4 | KTMH / Admin | Duyệt chênh lệch | Duyệt phiếu để hệ thống ghi movement tăng/giảm tồn | Movement điều chỉnh tồn |
| 5 | Hệ thống | Ghi nhận | Cập nhật tồn thực theo kết quả duyệt | Tồn kho sau điều chỉnh |

### 10.3 Bước duyệt và bước xác nhận

- `Thủ kho` là lớp xác nhận kho
- `KTMH` duyệt chênh lệch với `NVL`
- `Admin` duyệt chênh lệch với `cọc thành phẩm`

### 10.4 Khi nào quy trình kết thúc

Quy trình kết thúc khi phiếu kiểm kê đã được duyệt chênh lệch và hệ thống ghi điều chỉnh tồn xong.

### 10.5 Kết quả cuối cùng của quy trình

- tồn hệ thống được kéo về sát tồn thực tế
- lịch sử biến động thể hiện rõ đây là tăng/giảm do kiểm kê, không phải mua bán hay sản xuất

## 11. Quy trình 9: Trả hàng sau giao và hoàn nhập thành phẩm

### 11.1 Điểm bắt đầu

Luồng này bắt đầu khi một phiếu xuất hàng đã giao xong nhưng phát sinh nhu cầu nhận lại hàng từ khách.

### 11.2 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | KTBH | Khởi tạo | Tạo đề nghị trả hàng trên phiếu xuất đã khóa | Đề nghị trả hàng chờ xử lý |
| 2 | Thủ kho | Xác nhận kho | Chọn đúng serial trả lại, chọn hướng xử lý `Nhập dự án / Nhập khách lẻ / Hủy` | Dữ liệu serial hoàn nhập |
| 3 | Hệ thống | Ghi nhận | Cập nhật serial, lịch sử serial và trạng thái hiển thị lại trong tồn | Serial quay về kho hoặc bị hủy |

### 11.3 Bước duyệt và bước xác nhận

- `KTBH` là người tạo đề nghị trả hàng
- `Thủ kho` là người xác nhận serial nào thực sự quay về

### 11.4 Khi nào quy trình kết thúc

Quy trình kết thúc khi tất cả serial trong đề nghị trả đã được xử lý xong.

### 11.5 Kết quả cuối cùng của quy trình

- serial đã giao có thể quay lại trạng thái trong kho
- tồn thành phẩm và lịch sử serial phản ánh đúng sau trả hàng

## 12. Quy trình 10: Mở lại chứng từ ngoại lệ

### 12.1 Điểm bắt đầu

Luồng này chỉ dùng khi một chứng từ đã xác nhận xong nhưng cần mở lại để sửa sai nghiệp vụ hoặc nhập lại đúng số liệu.

### 12.2 Phạm vi đang thấy rõ trong phần mềm

- `Phiếu thực sản xuất và xuất NVL` của kế hoạch ngày có route `Mở lại phiếu`
- đây là luồng hỗ trợ ngoại lệ, không phải luồng vận hành thường ngày

### 12.3 Trình tự nghiệp vụ

| Bước | Role chính | Loại bước | Mô tả nghiệp vụ | Dữ liệu sinh ra cho bước sau |
| --- | --- | --- | --- | --- |
| 1 | Admin | Can thiệp ngoại lệ | Mở lại phiếu đã xác nhận | Phiếu quay về trạng thái có thể nhập lại |
| 2 | Thủ kho | Thực hiện lại | Nhập lại số liệu thực sản xuất / xuất NVL | Phiếu sửa đúng số |
| 3 | Thủ kho | Xác nhận lại | Xác nhận lại phiếu sau khi sửa | Movement mới đúng với thực tế |

### 12.4 Khi nào quy trình kết thúc

Quy trình kết thúc khi chứng từ đã được mở lại, nhập lại và xác nhận lại thành công.

### 12.5 Ghi chú

- không dùng luồng này như bước vận hành chuẩn
- chỉ dùng khi cần sửa sai chứng từ đã khóa

## 13. Tóm tắt điểm chốt của tầng 1

### 13.1 Các bước làm thay đổi tồn kho NVL

- Thủ kho ghi sổ phiếu nhập NVL
- Thủ kho xác nhận xuất NVL bán/điều chuyển
- Thủ kho xác nhận thực sản xuất và xuất NVL cho kế hoạch ngày
- mở tồn đầu kỳ NVL
- kiểm kê / điều chỉnh tồn NVL

### 13.2 Các bước làm thay đổi tồn kho thành phẩm

- QC xác nhận nghiệm thu thành phẩm
- Thủ kho nhập kho cọc mua ngoài
- Thủ kho xác nhận phiếu xuất hàng
- mở tồn đầu kỳ cọc thành phẩm
- xử lý hàng trả lại
- kiểm kê / điều chỉnh tồn cọc thành phẩm

### 13.3 Các bước duyệt chính theo hệ thống hiện tại

- KTMH duyệt đề xuất NVL để lập PO
- KTMH duyệt đề xuất mua cọc ngoài để lập PO
- role duyệt sản xuất chốt kế hoạch ngày
- KTMH / Admin duyệt chênh lệch kiểm kê NVL
- Admin duyệt chênh lệch kiểm kê cọc thành phẩm

### 13.4 Các bước xác nhận chính theo hệ thống hiện tại

- Thủ kho ghi sổ nhập NVL
- KTMH chốt đợt nhập NVL
- KTMH xác nhận cuối PO NVL
- Thủ kho xác nhận xuất NVL
- Thủ kho xác nhận thực sản xuất
- QC xác nhận nghiệm thu
- Thủ kho xác nhận giao hàng
- Thủ kho xác nhận kho trên phiếu kiểm kê
- Thủ kho xác nhận serial trả lại sau giao

## 14. Bước tiếp theo của bộ tài liệu 3 tầng

Sau tài liệu này, nên làm tiếp:
- tầng 2: ma trận trách nhiệm / RACI cho từng bước ở trên
- tầng 3: hướng dẫn thao tác phần mềm theo từng role bám đúng các bước đã chốt
