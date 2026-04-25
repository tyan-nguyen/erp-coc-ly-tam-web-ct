# Reopen Smoke Test Checklist

Chạy trước:

1. `/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/sql/reopen_shipment_voucher_atomic.sql`
2. `/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/sql/reopen_shipment_smoke_seed.sql`

Sau đó vào màn **Chi tiết phiếu xuất hàng** và test 4 case:

## Case 1 - Admin mở lại phiếu xuất thành công

- Mở phiếu có mã kết thúc bằng `00A111`
- Kỳ vọng:
  - Admin thấy nút **Mở lại phiếu**
  - Bấm xong phiếu về `Chờ xác nhận`
  - Serial `SMOKE-REOPEN-A-001` trở về tồn

## Case 2 - Mở lại đề nghị trả hàng thành công

- Mở phiếu có mã kết thúc bằng `00B111`
- Kỳ vọng:
  - Có đề nghị trả `PENDING`
  - KTBH/Admin bấm **Mở lại đề nghị**
  - Đề nghị trả biến mất
  - Không phát sinh lỗi downstream

## Case 3 - Bị chặn vì đã có return_voucher downstream

- Mở phiếu có mã kết thúc bằng `00C111`
- Kỳ vọng:
  - **Mở lại đề nghị** bị chặn
  - **Mở lại phiếu xuất** cũng bị chặn
  - Thông điệp báo đã có bước trả hàng downstream

## Case 4 - User không phải Admin

- Đăng nhập bằng user không phải Admin
- Thử mở lại phiếu `00A111`
- Kỳ vọng:
  - route app bị chặn
  - nếu gọi thẳng RPC cũng bị chặn vì SQL tự check `auth.uid()` + role Admin

Xong test thì dọn bằng:

- `/Users/duynguyen/Desktop/erp-coc-ly-tam-web-v2/sql/reopen_shipment_smoke_cleanup.sql`
