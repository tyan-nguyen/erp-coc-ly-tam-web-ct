# V2 Business Process Layer 2 - RACI

Tài liệu này là tầng 2 của bộ tài liệu vận hành.

Mục tiêu:
- gán trách nhiệm cho từng bước trong các quy trình đã chốt ở tầng 1
- làm rõ ai là người trực tiếp làm, ai là người chịu trách nhiệm cuối, ai cần được hỏi, ai cần được biết
- làm nền để viết tiếp tài liệu thao tác phần mềm theo từng role

Tài liệu gốc liên quan:
- [V2_BUSINESS_PROCESS_LAYER_1.md](/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/docs/V2_BUSINESS_PROCESS_LAYER_1.md)

## 1. Ý nghĩa RACI trong hệ thống này

- `R = Responsible`
  - người trực tiếp thao tác và làm ra kết quả của bước đó
- `A = Accountable`
  - người chịu trách nhiệm cuối cùng, có quyền chốt bước hoặc chịu trách nhiệm nếu bước đó sai
- `C = Consulted`
  - người nên được hỏi ý kiến hoặc phối hợp trước khi chốt
- `I = Informed`
  - người cần được biết thông tin để theo dõi, nhưng không trực tiếp thao tác ở bước đó

Nguyên tắc áp dụng ở tài liệu này:
- mỗi bước cố gắng chỉ có 1 `A`
- tài liệu này ưu tiên bám role đang thao tác trong phần mềm hiện tại
- `Admin` không được coi là vai trò vận hành chính
- `Admin` chỉ là lớp can thiệp/hỗ trợ đặc biệt, nên không đưa vào ma trận vận hành chính để tránh làm lệch cảm nhận của user

## 2. Danh sách role dùng trong RACI

- `QLSX`
- `Thủ kho`
- `KTMH`
- `KTBH`
- `QC`
- `Kiểm kê viên`
- `Admin`

Lưu ý khi đọc ma trận:
- nếu một bước trong phần mềm cho phép hơn một role cùng thao tác, bảng sẽ ghi đúng các role đó
- ở các bước đã chốt theo cách dùng thật, tài liệu ưu tiên ghi đúng 1 role vận hành chính để tránh hiểu nhầm khi đào tạo user
- `Admin` vẫn có thể can thiệp kỹ thuật ở nhiều route, nhưng không được coi là vai trò vận hành mặc định

## 3. Quy trình 1: Mua nguyên vật liệu

### 3.1 Ma trận RACI

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Lập đề xuất NVL | R/A | I | I | I | I | I |
| 2 | Duyệt đề xuất và lập PO | C | I | R/A | I | I | I |
| 3 | Theo dõi PO đang mở để nhận hàng | I | R/A | I | I | I | I |
| 4 | Tạo đợt nhận hàng | I | R/A | I | I | I | I |
| 5 | Nhập số lượng nhận, đạt, lưu nháp | I | R/A | I | I | I | I |
| 6 | Ghi sổ đợt nhập kho | I | R/A | I | I | I | I |
| 7 | Chốt đợt đã ghi sổ, nhập SL tính tiền và đơn giá | I | I | R/A | I | I | I |
| 8 | Kết thúc đơn để chặn nhận thêm | I | R/A | I | I | I | I |
| 9 | Xác nhận cuối PO | I | I | R/A | I | I | I |

### 3.2 Diễn giải ngắn

- Bước 1:
  - tài liệu này bám theo cách dùng giao diện hiện tại, nên bước `lập đề xuất NVL` được xem là việc của `QLSX`
- Bước 2:
  - `KTMH` là người duyệt và biến đề xuất thành cam kết mua hàng
- Bước 4 đến bước 6:
  - theo cách dùng thực tế hiện tại, đây là lớp thao tác của `Thủ kho`
  - `Thủ kho` là người tạo đợt nhận, nhập số nhận và ghi sổ nhập kho
- Bước 7:
  - `KTMH` là người chốt từng đợt để ra dữ liệu công nợ
- Bước 8:
  - `Thủ kho` là người quyết định dừng nhận thêm cho PO
- Bước 9:
  - `KTMH` là người chịu trách nhiệm cuối cùng về việc PO đã chốt hết các đợt

### 3.3 Ý nghĩa vận hành

Quy trình này đang tách thành 2 lớp trách nhiệm:
- lớp kho:
  - tạo đợt
  - nhập số
  - ghi sổ
  - kết thúc nhận hàng
- lớp mua hàng:
  - duyệt mua
  - chốt từng đợt
  - xác nhận cuối PO

## 4. Quy trình 2: Mua cọc thành phẩm ngoài

### 4.1 Ma trận RACI

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Lập đề xuất mua cọc ngoài | R/A | I | I | I | I | I |
| 2 | Duyệt đề xuất, chọn NCC, lập phiếu mua | I | I | R/A | I | I | I |
| 3 | Theo dõi PO cọc ngoài và nhận hàng | I | R/A | I | I | I | I |
| 4 | Xác nhận nhập kho cọc ngoài | I | R/A | I | I | I | I |
| 5 | Hệ thống sinh lô, serial và tăng tồn thành phẩm | I | I | I | I | I | I |

### 4.2 Diễn giải ngắn

- `QLSX` là người phát sinh nhu cầu mua ngoài nên giữ vai trò `R/A` ở bước đầu
- `KTMH` chịu trách nhiệm lựa chọn NCC và tạo cam kết mua
- `Thủ kho` chịu trách nhiệm vật lý khi hàng về và nhập vào kho

## 5. Quy trình 3: Kế hoạch ngày -> Xuất NVL sản xuất -> QC nghiệm thu -> Nhập kho thành phẩm

### 5.1 Ma trận RACI

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Lập kế hoạch sản xuất ngày | R/A | I | I | I | I | I |
| 2 | Chốt kế hoạch ngày | I | I | I | R/A | I | I |
| 3 | Lưu phiếu xuất NVL sản xuất theo kế hoạch | I | R/A | I | I | I | I |
| 4 | Xác nhận thực sản xuất từng dòng kế hoạch | I | R/A | I | I | I | I |
| 5 | Nghiệm thu QC | I | I | I | I | R/A | I |
| 6 | Hệ thống sinh serial và nhập kho thành phẩm | I | I | I | I | I | I |

### 5.2 Diễn giải ngắn

- theo phần mềm hiện tại, lớp duyệt kế hoạch ngày đang thuộc role duyệt sản xuất, hiện được map vào `KTBH / sales accounting`
- `Thủ kho` là role lưu phiếu xuất NVL sản xuất
- bước xác nhận thực sản xuất từng dòng kế hoạch bám theo cách dùng thật hiện tại là thao tác của `Thủ kho`
- `QC` là lớp xác nhận chất lượng cuối cùng trước khi thành phẩm được ghi nhận vào kho

### 5.3 Ý nghĩa vận hành

Quy trình này có 3 điểm khóa:
- kế hoạch phải được chốt
- kho phải lưu phiếu xuất NVL sản xuất
- thực sản xuất từng dòng phải được xác nhận
- QC phải xác nhận nghiệm thu

Thiếu một trong ba điểm trên thì không được coi là hoàn thành quy trình.

## 6. Quy trình 4: Phiếu xuất NVL bán / điều chuyển

### 6.1 Ma trận RACI

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Lập phiếu xuất NVL | I | I | I | R/A | I | I |
| 2 | Mở phiếu và nhập thực xuất | I | R/A | I | I | I | I |
| 3 | Xác nhận thực xuất | I | R/A | I | I | I | I |
| 4 | Hệ thống ghi movement và giảm tồn | I | I | I | I | I | I |

### 6.2 Diễn giải ngắn

- `KTBH` chịu trách nhiệm đầu vào nghiệp vụ
- `Thủ kho` chịu trách nhiệm đầu ra vật lý và việc tồn kho có được trừ thật hay không
- quy trình này hiện không có bước duyệt riêng, nên `KTBH` vừa là người lập vừa là người chịu trách nhiệm đầu vào

## 7. Quy trình 5: Xuất hàng cọc thành phẩm

### 7.1 Ma trận RACI

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Lập phiếu xuất hàng | I | I | I | R/A | I | I |
| 2 | Chọn / quét serial thực giao | I | R/A | I | I | I | I |
| 3 | Xác nhận giao hàng | I | R/A | I | I | I | I |
| 4 | Hệ thống cập nhật tồn và trạng thái serial | I | I | I | I | I | I |

### 7.2 Diễn giải ngắn

- `KTBH` chịu trách nhiệm đề nghị giao đúng cho khách / đơn hàng
- `Thủ kho` chịu trách nhiệm serial nào thực tế ra khỏi kho
- phần trả hàng sau giao được tách riêng ở quy trình hỗ trợ phía dưới để dễ đào tạo

## 8. Quy trình 6: Tra cứu tồn và đối chiếu sau vận hành

Đây là quy trình theo dõi, không phải quy trình tạo chứng từ chính. Vì vậy RACI ở đây nên hiểu theo quyền sử dụng chính.

### 8.1 Ma trận RACI

| Chức năng theo dõi | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- |
| Tồn thực NVL | R | R | R | R | I | R |
| Tồn cọc thành phẩm | R | R | I | R | I | R |
| Tra cứu mã cọc | R | R | I | R | I | R |
| Tra cứu serial | I | R | I | R | I | R |
| Theo dõi bãi / vị trí | R | R | I | I | I | R |

### 8.2 Diễn giải ngắn

- `Thủ kho` là role theo dõi thường xuyên nhất vì trực tiếp vận hành vật lý
- `QLSX`, `KTMH`, `KTBH` được mở quyền xem ở các màn liên quan đúng như phần mềm hiện tại
- `Kiểm kê viên` được mở quyền ở các màn kiểm kê và tra cứu liên quan đến đối chiếu tồn
- bảng này phản ánh quyền sử dụng thực tế hơn là quan hệ duyệt

## 9. Quy trình 7: Mở tồn đầu kỳ

### 9.1 Ma trận RACI cho NVL

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Tạo phiếu nhập tồn đầu kỳ NVL | I | R | I | I | I | R |
| 2 | Nhập số đếm đầu kỳ, lưu phiếu | I | R | I | I | I | R |
| 3 | Xác nhận kho | I | R/A | I | I | I | C |
| 4 | Duyệt chênh lệch và ghi tồn đầu kỳ | I | I | R/A | I | I | I |

### 9.2 Ma trận RACI cho cọc thành phẩm

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Nhập dữ liệu mở tồn đầu kỳ cọc thành phẩm | I | R/A | I | I | I | R |
| 2 | Tạo lô / serial tồn đầu kỳ | I | R/A | I | I | I | R |
| 3 | Hệ thống sinh serial và đưa vào tồn | I | I | I | I | I | I |

### 9.3 Diễn giải ngắn

- `NVL` mở tồn đầu kỳ đang đi theo mô hình kiểm kê:
  - kho nhập số liệu
  - `KTMH` hoặc `Admin` duyệt chênh lệch để ghi movement đầu kỳ
- `Cọc thành phẩm` mở tồn đầu kỳ là nhánh riêng:
  - `Thủ kho` hoặc `Kiểm kê viên` nhập dữ liệu lô đầu kỳ
  - hệ thống sinh serial ngay

## 10. Quy trình 8: Kiểm kê vận hành và điều chỉnh tồn

### 10.1 Ma trận RACI cho NVL

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Tạo phiếu kiểm kê NVL | I | R | I | I | I | R |
| 2 | Nhập số kiểm kê, lưu nháp | I | R | I | I | I | R |
| 3 | Xác nhận kho | I | R/A | I | I | I | C |
| 4 | Duyệt chênh lệch để ghi điều chỉnh tồn | I | I | R/A | I | I | I |

### 10.2 Ma trận RACI cho cọc thành phẩm

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Tạo phiếu kiểm kê thành phẩm | I | R | I | I | I | R |
| 2 | Nhập số kiểm kê, serial, lưu nháp | I | R | I | I | I | R |
| 3 | Xác nhận kho | I | R/A | I | I | I | C |
| 4 | Hệ thống ghi điều chỉnh tồn sau khi được duyệt | I | I | I | I | I | I |

### 10.3 Diễn giải ngắn

- `NVL`:
  - `Thủ kho` và `Kiểm kê viên` là lớp chuẩn bị dữ liệu
  - `Thủ kho` là lớp xác nhận kho
  - `KTMH` duyệt chênh lệch cuối
- `Cọc thành phẩm`:
  - `Thủ kho` và `Kiểm kê viên` là lớp làm phiếu
  - `Admin` là lớp duyệt cuối cùng theo phần mềm hiện tại
  - bước duyệt cuối của `Admin` không đưa vào cột vận hành chính vì đây là quyền can thiệp/hỗ trợ đặc biệt

## 11. Quy trình 9: Trả hàng sau giao và hoàn nhập thành phẩm

### 11.1 Ma trận RACI

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Tạo đề nghị trả hàng từ phiếu đã giao | I | I | I | R/A | I | I |
| 2 | Chọn serial trả lại và hướng xử lý | I | R/A | I | I | I | I |
| 3 | Hệ thống cập nhật lại serial và tồn | I | I | I | I | I | I |

### 11.2 Diễn giải ngắn

- `KTBH` chịu trách nhiệm đầu vào vì nắm lý do khách trả
- `Thủ kho` chịu trách nhiệm xác nhận serial nào thực quay về và nhập theo hướng nào

## 12. Quy trình 10: Mở lại chứng từ ngoại lệ

### 12.1 Ma trận RACI

| Bước | Công việc | QLSX | Thủ kho | KTMH | KTBH | QC | Kiểm kê viên |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Mở lại phiếu thực sản xuất và xuất NVL đã khóa | I | I | I | I | I | I |
| 2 | Nhập lại số liệu sau khi mở lại | I | R/A | I | I | I | I |
| 3 | Xác nhận lại phiếu | I | R/A | I | I | I | I |

### 12.2 Diễn giải ngắn

- `Admin` là người có quyền can thiệp kỹ thuật để mở lại
- sau khi mở lại, quy trình thao tác quay về đúng vai vận hành của `Thủ kho`
- bước `mở lại` do `Admin` thực hiện nên không tách thành cột `Admin` trong ma trận chính của tài liệu này

## 13. Ma trận trách nhiệm rút gọn theo role

### 13.1 QLSX

- `R/A`
  - lập kế hoạch ngày
  - lập đề xuất NVL
  - lập đề xuất mua cọc ngoài
- `C`
  - duyệt PO NVL
  - chốt đợt nhập NVL
  - xác nhận cuối PO NVL

### 13.2 Thủ kho

- `R/A`
  - tạo đợt nhận hàng
  - ghi sổ nhập kho
  - nhập số lượng nhận, đạt, lưu nháp
  - kết thúc nhận hàng PO
  - xác nhận thực xuất NVL
  - xác nhận thực sản xuất từng dòng kế hoạch
  - xác nhận giao hàng
  - nhập kho cọc ngoài
  - lưu phiếu xuất NVL sản xuất
  - tạo / xác nhận phiếu kiểm kê
  - mở tồn đầu kỳ
  - xác nhận serial trả lại sau giao
  - theo dõi tồn và serial

### 13.3 KTMH

- `R/A`
  - duyệt đề xuất mua NVL
  - lập PO NVL
  - duyệt đề xuất mua cọc ngoài
  - lập PO cọc ngoài
  - chốt từng đợt nhập NVL
  - xác nhận cuối PO NVL
  - duyệt chênh lệch kiểm kê NVL

### 13.4 KTBH

- `R/A`
  - lập phiếu xuất hàng
  - lập phiếu xuất NVL bán / điều chuyển
  - chốt kế hoạch ngày theo thiết kế quyền hiện tại
  - tạo đề nghị trả hàng sau giao

### 13.5 QC

- `R/A`
  - nghiệm thu QC cho thành phẩm sau sản xuất

### 13.6 Kiểm kê viên

- `R`
  - nhập tồn đầu kỳ NVL
  - mở tồn đầu kỳ cọc thành phẩm
  - tạo phiếu kiểm kê vận hành
  - rà chênh lệch tồn
  - theo dõi tồn và serial phục vụ kiểm kê

### 13.7 Admin

- `A`
  - lớp dự phòng / can thiệp hỗ trợ ở gần như mọi luồng
- lưu ý:
  - không nên xem `Admin` là vai vận hành chính khi đào tạo user
  - riêng kiểm kê cọc thành phẩm, `Admin` đang là lớp duyệt cuối theo code hiện tại

## 14. Ghi chú bám phần mềm hiện tại

- file này ưu tiên bám quyền và luồng đang mở trong phần mềm, không cố ép theo mô hình vận hành ngoài hệ thống
- riêng bước `lập đề xuất NVL`, tài liệu bám theo cách user đang dùng thật trên giao diện hiện tại, nên xem đây là bước của `QLSX`
- riêng các bước `tạo đợt nhận hàng`, `nhập số nhận`, `ghi sổ receipt`, tài liệu cũng bám theo cách dùng thật trên giao diện hiện tại, nên xem đây là bước của `Thủ kho`
- `Admin` là lớp can thiệp kỹ thuật và hỗ trợ đặc biệt, nên không đưa vào ma trận vận hành chính
- các quy trình `tồn đầu kỳ`, `kiểm kê`, `trả hàng sau giao`, `mở lại phiếu` là quy trình hỗ trợ / ngoại lệ, không phải lúc nào cũng chạy hằng ngày nhưng vẫn có thật trong phần mềm

## 15. Bước tiếp theo

Sau tài liệu này, nên làm tiếp:
- tài liệu tầng 3 theo từng role:
  - `Thủ kho`
  - `KTMH`
  - `QLSX`
  - `KTBH`
  - `QC`
- mỗi tài liệu role sẽ bám đúng các bước có `R` hoặc `A` trong file này
