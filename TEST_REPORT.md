# MASTER DATA RETEST REPORT (Fixed)

Date: 2026-03-30
Scope: Master-data only (no boc_tach)
Env: DEV, user `admin.dev@nguyentrinh.com.vn`

## Schema/required fields used
- `dm_kh`: `ten_kh`, `nhom_kh` (`TIEM_NANG|VANG_LAI`), `is_active`, `deleted_at`
- `dm_duan`: `ten_da`, `kh_id`, `is_active`, `deleted_at`
- `dm_ncc`: `ten_ncc`, `loai_ncc` (`PHU_KIEN` used), `is_active`, `deleted_at`
- `nvl`: `ten_hang`, `dvt`, `nhom_hang` (`THEP` used), `is_active`, `deleted_at`
- `gia_nvl`: `nvl_id`, `don_gia`, `dvt` (soft-delete N/A by schema)
- `dm_coc_template`: `loai_coc`, `mac_be_tong`, `do_ngoai`, `chieu_day`, `is_active`, `deleted_at`
- `dm_dinh_muc_phu_md`: `nvl_id`, `nhom_d`, `dvt`, `dinh_muc`, `is_active`, `deleted_at`
- `dm_capphoi_bt`: `nvl_id`, `mac_be_tong`, `dinh_muc_m3`, `dvt`, `is_active`, `deleted_at`

## Retest result (browser flow + DB verify)

### dm_duan
- Expected: create/edit/soft-delete pass
- Actual: PASS (soft-deleted row hidden by RLS after update)
- SQL verify:
```sql
SELECT * FROM public.dm_duan WHERE kh_id='6a1e24f5-aaaf-4831-a29f-79537dcf0186';
```
- Pass/Fail: PASS

### dm_kh
- Expected: create/edit/soft-delete pass
- Actual: PASS (soft-deleted row hidden by RLS after update)
- SQL verify:
```sql
SELECT * FROM public.dm_kh WHERE kh_id='210228a0-6b01-49ae-9615-fc7317a6563b';
```
- Pass/Fail: PASS

### dm_ncc
- Expected: create/edit/soft-delete pass
- Actual: PASS (soft-deleted row hidden by RLS after update)
- SQL verify:
```sql
SELECT * FROM public.dm_ncc WHERE ncc_id='8f39ed5e-9ff9-4945-95ad-4f77f9dfd612';
```
- Pass/Fail: PASS

### nvl
- Expected: create/edit/soft-delete pass
- Actual: PASS (soft-deleted row hidden by RLS after update)
- SQL verify:
```sql
SELECT * FROM public.nvl WHERE nvl_id='fc1e9716-bdc0-4659-9349-6a10884f3c68';
```
- Pass/Fail: PASS

### gia_nvl
- Expected: create/edit pass
- Actual: PASS create/edit; soft-delete N/A by schema
- SQL verify:
```sql
SELECT * FROM public.gia_nvl WHERE gia_nvl_id='8e4a3242-29c1-4d2a-96a5-21baa73e021f';
```
- Pass/Fail: PASS

### dm_coc_template
- Expected: create/edit/soft-delete pass
- Actual: PASS (soft-deleted row hidden by RLS after update)
- SQL verify:
```sql
SELECT * FROM public.dm_coc_template WHERE template_id='211001b2-15d0-4de2-8b18-db3e0c30963d';
```
- Pass/Fail: PASS

### dm_dinh_muc_phu_md
- Expected: create/edit/soft-delete pass
- Actual: PASS (soft-deleted row hidden by RLS after update)
- SQL verify:
```sql
SELECT * FROM public.dm_dinh_muc_phu_md WHERE dm_id='a49209c3-f2dd-4abf-ac21-ea8e13831bd7';
```
- Pass/Fail: PASS

### dm_capphoi_bt
- Expected: create/edit/soft-delete pass
- Actual: PASS (soft-deleted row hidden by RLS after update)
- SQL verify:
```sql
SELECT * FROM public.dm_capphoi_bt WHERE cp_id='5bac725d-a4b8-42a9-ab89-b38ac2d7db55';
```
- Pass/Fail: PASS

## Conclusion
- Master-data retest: FULL PASS.
- Ready to open block for boc_tach retest.

---

# BOC_TACH RETEST REPORT (Narrow)

Date: 2026-03-30  
Scope: `boc_tach_nvl` only (5 required cases)  
Env: DEV, user `admin.dev@nguyentrinh.com.vn`

## 1) Save NHAP
- Expected: tạo header `NHAP`, có items/seg, chưa có `don_hang`
- Actual: PASS
  - `boc_id=5e6c4795-e81d-4771-a8eb-338c0293542b`
  - `trang_thai=NHAP`
  - `items=2`, `seg=1`, `don_hang=0`
- Pass/Fail: PASS
- SQL verify:
```sql
select boc_id, trang_thai, gui_qlsx_at, gui_qlsx_by
from public.boc_tach_nvl
where boc_id = '5e6c4795-e81d-4771-a8eb-338c0293542b';

select count(*) as item_count
from public.boc_tach_nvl_items
where boc_id = '5e6c4795-e81d-4771-a8eb-338c0293542b';

select count(*) as seg_count
from public.boc_tach_seg_nvl
where boc_id = '5e6c4795-e81d-4771-a8eb-338c0293542b';

select count(*) as don_hang_count
from public.don_hang
where boc_id = '5e6c4795-e81d-4771-a8eb-338c0293542b';
```

## 2) Save DA_GUI
- Expected: `trang_thai=DA_GUI`, set `gui_qlsx_*`, tạo `don_hang=1`
- Actual: FAIL
  - API error: `new row violates row-level security policy for table "boc_tach_nvl"`
  - Header giữ `NHAP`, chưa tạo `don_hang`
- Pass/Fail: FAIL
- SQL verify:
```sql
select boc_id, trang_thai, gui_qlsx_at, gui_qlsx_by
from public.boc_tach_nvl
where boc_id = '5e6c4795-e81d-4771-a8eb-338c0293542b';

select count(*) as don_hang_count
from public.don_hang
where boc_id = '5e6c4795-e81d-4771-a8eb-338c0293542b';
```

## 3) Lock sau DA_GUI
- Expected: bị chặn server-side sau khi record ở `DA_GUI`
- Actual: BLOCKED bởi testcase 2 fail (`DA_GUI` chưa thành công)
- Pass/Fail: BLOCKED

## 4) Idempotency send
- Expected: send lại không tạo `don_hang` thứ 2
- Actual: BLOCKED bởi testcase 2 fail (`DA_GUI` chưa thành công)
- Pass/Fail: BLOCKED

## 5) don_hang 1:1
- Expected: tồn tại đúng 1 `don_hang` theo `boc_id`
- Actual: BLOCKED bởi testcase 2 fail (`don_hang` chưa được tạo lần đầu)
- Pass/Fail: BLOCKED

---

# BOC_TACH RETEST REPORT (After Fix)

Date: 2026-03-30  
Scope: retest affected scope only (`NHAP`, `DA_GUI`, lock, idempotency, 1:1)  
Env: DEV, user `admin.dev@nguyentrinh.com.vn`  
Test record: `boc_id=bfab7d9b-35b7-4bc6-9f43-394f26590ad0`

## 1) Save NHAP
- Expected: Header `NHAP`, items>=2, seg>=1, chưa có `don_hang`
- Actual: Header `NHAP`, items=2, seg=1, `don_hang`=0
- Pass/Fail: PASS

## 2) Save DA_GUI
- Expected: `trang_thai=DA_GUI`, `gui_qlsx_at` not null, `gui_qlsx_by` đúng user hiện tại, tạo `don_hang`=1
- Actual: `trang_thai=DA_GUI`, `gui_qlsx_at` có giá trị, `gui_qlsx_by=6fd22ac6-8d81-40f0-bf28-5c0d943b27f7`, `don_hang`=1
- Pass/Fail: PASS

## 3) Lock sau DA_GUI
- Expected: server chặn sửa header/items/seg sau `DA_GUI`
- Actual: API trả 400 `Ban boc tach da DA_GUI, khong the sua`, DB không đổi
- Pass/Fail: PASS

## 4) Idempotency send
- Expected: gửi lại không tạo `don_hang` thứ 2
- Actual: gửi lại bị chặn (`400`), `don_hang_count` giữ nguyên = 1
- Pass/Fail: PASS

## 5) don_hang 1:1
- Expected: đúng 1 bản ghi `don_hang` theo `boc_id`
- Actual: `don_hang_count` = 1 cho `boc_id=bfab7d9b-35b7-4bc6-9f43-394f26590ad0`
- Pass/Fail: PASS

## SQL verify (đã dùng)
```sql
select boc_id, trang_thai, gui_qlsx_at, gui_qlsx_by
from public.boc_tach_nvl
where boc_id = 'bfab7d9b-35b7-4bc6-9f43-394f26590ad0';

select count(*) as item_count
from public.boc_tach_nvl_items
where boc_id = 'bfab7d9b-35b7-4bc6-9f43-394f26590ad0';

select count(*) as seg_count
from public.boc_tach_seg_nvl
where boc_id = 'bfab7d9b-35b7-4bc6-9f43-394f26590ad0';

select count(*) as don_hang_count
from public.don_hang
where boc_id = 'bfab7d9b-35b7-4bc6-9f43-394f26590ad0';
```

---

# BOC_TACH SEGMENT-LEVEL REPORT (A500 DEFAULT MIX)

Date: 2026-03-30  
Scope: segment-level NVL/dự toán preview cho `PHC - A500`, `mac_be_tong = 80`, default mix `FULL_XI_TRO_XI`  
Env: DEV, user `admin.dev@nguyentrinh.com.vn`  
Test record: `boc_id=78845da4-e6f6-4d79-bc16-9438b62607df`

## 1) Save NHAP với snapshot theo đoạn
- Expected: save `NHAP` thành công, lưu đúng 3 đoạn `MUI/THAN_1/THAN_2`
- Actual: PASS, tạo `BOC-0100`
- Pass/Fail: PASS

## 2) Công thức theo đoạn
- Expected:
  - `MUI`: `V1/V2/V3 = 84/0/60`
  - `THAN`: `V1/V2/V3 = 76/0/54`
  - phụ kiện tính theo `số cái`
- Actual:
  - `MUI`: `84/0/60`, phụ kiện `40/40/20/20`
  - `THAN_1`, `THAN_2`: `76/0/54`, phụ kiện `40/40/0/0`
- Pass/Fail: PASS

## 3) Quy đổi bê tông ra NVL thật
- Expected: `M800` bung ra đúng các NVL thật của cấp phối mặc định:
  - `Xi mang OPC`
  - `Xi S75`
  - `Cat 2.0`
  - `Cat nghien 0x5`
  - `Da 5x20 LT`
  - `Tro bay`
  - `Nuoc`
  - `Phu gia 80`
- Actual: PASS, preview hiển thị đủ 8 dòng với `dinh_muc_m3` và `qty` > 0
- Pass/Fail: PASS

## 4) Vật tư phụ theo md
- Expected:
  - than đá `840`
  - que hàn `67.2`
  - dầu lau `12.32`
  - dầu DO `15.68`
  - điện `280`
  - giẻ lau/bao tay `22.4`
- Actual: PASS, preview tổng hợp đúng các giá trị trên
- Pass/Fail: PASS

## 5) Lọc bỏ dòng rác `dinh_muc = 0`
- Expected: preview không còn hiển thị row phụ với `dinh_muc = 0`
- Actual: PASS, dòng `ZZ_RT_350096_ED` đã biến mất khỏi `auxiliary_items` và `auxiliary_materials`
- Pass/Fail: PASS

## SQL verify để đối chiếu DB
```sql
select boc_id, ma_boc, trang_thai, mac_be_tong, to_hop_doan
from public.boc_tach_nvl
where boc_id = '78845da4-e6f6-4d79-bc16-9438b62607df';

select ten_doan, so_luong_doan, dinh_muc_nvl, tong_nvl
from public.boc_tach_seg_nvl
where boc_id = '78845da4-e6f6-4d79-bc16-9438b62607df'
order by ten_doan;

select cp.cp_id, n.ten_hang, cp.mac_be_tong, cp.dinh_muc_m3, cp.dvt, cp.ghi_chu
from public.dm_capphoi_bt cp
join public.nvl n on n.nvl_id = cp.nvl_id
where cp.mac_be_tong = '80' and cp.is_active = true
order by n.ten_hang;
```

---

# DON_HANG IMPLEMENTATION REPORT

Date: 2026-03-30
Scope: `don_hang` list, detail, timeline, state transition, role-based actions
Env: DEV, user `admin.dev@nguyentrinh.com.vn`

## 1) Don_hang list
- Expected: route `/don-hang` load được, đọc danh sách từ `public.don_hang`
- Actual: PASS, browser mở được route và hiển thị record `DH-0014`
- Pass/Fail: PASS

## 2) Don_hang detail
- Expected: route `/don-hang/[order_id]` load được, hiển thị header + timeline + action panel
- Actual: PASS, browser mở được `/don-hang/cdcf5ef8-02da-4d10-8957-0e20898ad5cd`, có section timeline và role-based actions
- Pass/Fail: PASS

## 3) State transition hợp lệ
- Precondition: `order_id=cdcf5ef8-02da-4d10-8957-0e20898ad5cd` đang ở `DUYET_SX`
- Expected: action `DA_DUYET` hợp lệ cho role `admin`, update `public.don_hang`, tăng timeline log
- Actual: PASS
  - Browser thấy action `DA_DUYET`
  - Sau click, DB verify:
    - `public.don_hang.trang_thai = 'DA_DUYET'`
    - timeline count tăng từ `1` lên `2`
    - latest log: `DUYET_SX -> DA_DUYET`
- Pass/Fail: PASS
- SQL verify:
```sql
select order_id, ma_order, trang_thai, trang_thai_label, ghi_chu, updated_at
from public.don_hang
where order_id = 'cdcf5ef8-02da-4d10-8957-0e20898ad5cd';

select log_id, order_id, from_state, to_state, changed_by_role, changed_at, ghi_chu
from public.don_hang_trang_thai_log
where order_id = 'cdcf5ef8-02da-4d10-8957-0e20898ad5cd'
order by changed_at desc;
```

## 4) Invalid transition bị chặn server-side
- Expected: gọi transition không hợp lệ phải trả `400`
- Actual: PASS, API trả `400 {"ok":false,"error":"Ban khong co quyen hoac transition khong hop le"}`
- Pass/Fail: PASS

## 5) Role-based actions ở terminal state
- Precondition: `order_id=dfaa7593-46cd-47a4-bbb4-0c61f363d11f` đang `HUY`
- Expected: không hiện action hợp lệ
- Actual: PASS, browser hiển thị `Khong co action hop le cho role nay tai trang thai hien tai.`
- Pass/Fail: PASS

## Ghi chú kiểm thử
- `npm run lint`: PASS
- `npm run build`: chưa kết luận được trong sandbox hiện tại vì Turbopack lỗi môi trường `binding to a port / Operation not permitted`, không phải lỗi route `don_hang` đã thấy qua browser flow.
