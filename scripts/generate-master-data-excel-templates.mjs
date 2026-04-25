import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outputDir = path.join(repoRoot, 'templates', 'excel-import')

fs.mkdirSync(outputDir, { recursive: true })

function autoWidth(rows) {
  const widths = []
  for (const row of rows) {
    row.forEach((cell, index) => {
      const cellText = String(cell ?? '')
      const width = Math.min(Math.max(cellText.length + 2, 12), 40)
      widths[index] = Math.max(widths[index] ?? 0, width)
    })
  }
  return widths.map((width) => ({ wch: width }))
}

function createSheet(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = autoWidth(rows)
  return sheet
}

function writeWorkbook(fileName, sheets) {
  const workbook = XLSX.utils.book_new()
  for (const [sheetName, rows] of sheets) {
    XLSX.utils.book_append_sheet(workbook, createSheet(rows), sheetName)
  }
  XLSX.writeFile(workbook, path.join(outputDir, fileName))
}

function notesRows(title, description, fields) {
  return [
    [title],
    [''],
    ['Muc dich', description],
    [''],
    ['Cot', 'Bat buoc', 'Ghi chu'],
    ...fields.map((field) => [field.name, field.required ? 'YES' : 'NO', field.note]),
  ]
}

function valuesRows(title, rows) {
  return [[title], [''], ...rows]
}

writeWorkbook('01_khach_hang.xlsx', [
  [
    'Mau_nhap',
    [
      ['ten_kh', 'nhom_kh', 'contact', 'email', 'mst', 'dia_chi', 'ghi_chu'],
      ['Cong ty Tan Viet', 'TIEM_NANG', '0909123456', 'sale@tanviet.vn', '0312345678', 'Vinh Long', 'Khach cong trinh'],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['nhom_kh', 'TIEM_NANG', 'VANG_LAI'],
      ['contact', 'Nhap SDT hoac email', 'He thong kiem tra trung theo lien he'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template khach hang', 'Nhap danh muc khach hang de import sau nay.', [
      { name: 'ten_kh', required: true, note: 'Ten khach hang.' },
      { name: 'nhom_kh', required: true, note: 'TIEM_NANG hoac VANG_LAI.' },
      { name: 'contact', required: true, note: 'Lien he chinh. Co the la SDT hoac email.' },
      { name: 'email', required: false, note: 'Neu contact la SDT, co the nhap them email rieng.' },
      { name: 'mst', required: false, note: 'Ma so thue.' },
      { name: 'dia_chi', required: false, note: 'Dia chi khach hang.' },
      { name: 'ghi_chu', required: false, note: 'Thong tin bo sung.' },
    ]),
  ],
])

writeWorkbook('02_du_an.xlsx', [
  [
    'Mau_nhap',
    [
      ['ten_da', 'khach_hang', 'khu_vuc', 'vi_tri_cong_trinh', 'ghi_chu'],
      ['Khu cong nghiep Vinh Long', 'Cong ty Tan Viet', 'Vinh Long', 'Lo A2, KCN Vinh Long', 'Du an uu tien'],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['khach_hang', 'Nhap ma khach hang hoac ten khach hang', 'Nen trung voi sheet 01_khach_hang'],
      ['khu_vuc', 'Ten khu vuc/ tinh thanh', 'Dang la truong bat buoc'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template du an', 'Nhap du an va map ve khach hang.', [
      { name: 'ten_da', required: true, note: 'Ten du an.' },
      { name: 'khach_hang', required: true, note: 'Map theo ma hoac ten khach hang.' },
      { name: 'khu_vuc', required: true, note: 'Khu vuc du an.' },
      { name: 'vi_tri_cong_trinh', required: false, note: 'Dia chi/ vi tri cong trinh.' },
      { name: 'ghi_chu', required: false, note: 'Thong tin bo sung.' },
    ]),
  ],
])

writeWorkbook('03_nha_cung_cap.xlsx', [
  [
    'Mau_nhap',
    [
      ['ten_ncc', 'loai_ncc', 'nguoi_lien_he', 'sdt', 'email', 'dia_chi', 'ghi_chu'],
      ['CTY Thep ABC', 'NVL', 'Anh Long', '0909000111', 'mua@abc.vn', 'TP HCM', 'NCC thep chinh'],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['loai_ncc', 'PHU_KIEN', 'NVL', 'TAI_SAN', 'CCDC', 'VAN_CHUYEN'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template nha cung cap', 'Nhap nha cung cap phuc vu mua hang va chi phi.', [
      { name: 'ten_ncc', required: true, note: 'Ten nha cung cap.' },
      { name: 'loai_ncc', required: true, note: 'PHU_KIEN, NVL, TAI_SAN, CCDC, VAN_CHUYEN.' },
      { name: 'nguoi_lien_he', required: false, note: 'Nguoi lien he.' },
      { name: 'sdt', required: false, note: 'So dien thoai.' },
      { name: 'email', required: false, note: 'Email nha cung cap.' },
      { name: 'dia_chi', required: false, note: 'Dia chi.' },
      { name: 'ghi_chu', required: false, note: 'Thong tin bo sung.' },
    ]),
  ],
])

writeWorkbook('04_nvl.xlsx', [
  [
    'Mau_nhap',
    [
      ['nhom_hang', 'ten_hang', 'dvt', 'don_gia', 'hao_hut_pct', 'phu_kien_kind', 'thep_kind', 'ngang_mm', 'rong_mm', 'day_mm', 'so_lo', 'duong_kinh_mm'],
      ['THEP', '', 'kg', '18500', '0', '', 'THEP_PC', '', '', '', '', '7.1'],
      ['PHU_KIEN', '', 'cai', '75240', '0', 'MAT_BICH', '', '400', '320', '8', '7', ''],
      ['NVL', 'Xi mang PCB40', 'kg', '1450', '0', '', '', '', '', '', '', ''],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['nhom_hang', 'THEP', 'NVL', 'VAT_TU_PHU', 'PHU_KIEN', 'TAI_SAN', 'CONG_CU_DUNG_CU'],
      ['dvt', 'kg', 'm3', 'cai', 'lit', 'kwh', 'que', 'bo', 'md', 'tan'],
      ['phu_kien_kind', 'MAT_BICH', 'MANG_XONG', 'MUI_COC_ROI', 'MUI_COC_LIEN', 'TAM_VUONG'],
      ['thep_kind', 'THEP_PC', 'THEP_DAI', 'THEP_BUOC'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template NVL', 'Nhap NVL, thep va phu kien. Với THEP/PHU_KIEN, ten_hang co the de trong de he thong tu sinh tu thong so.', [
      { name: 'nhom_hang', required: true, note: 'Nhom vat tu.' },
      { name: 'ten_hang', required: true, note: 'Bat buoc voi nhom thuong; THEP/PHU_KIEN co the de trong neu nhap du thong so.' },
      { name: 'dvt', required: true, note: 'Don vi tinh.' },
      { name: 'don_gia', required: false, note: 'Don gia chua VAT.' },
      { name: 'hao_hut_pct', required: false, note: 'Ty le hao hut cho phep (0-100).' },
      { name: 'phu_kien_kind', required: false, note: 'Bat buoc khi nhom_hang = PHU_KIEN.' },
      { name: 'thep_kind', required: false, note: 'Bat buoc khi nhom_hang = THEP.' },
      { name: 'ngang_mm/rong_mm/day_mm/so_lo', required: false, note: 'Dung de sinh ten phu kien.' },
      { name: 'duong_kinh_mm', required: false, note: 'Dung de sinh ten thep.' },
    ]),
  ],
])

writeWorkbook('04a_phu_kien.xlsx', [
  [
    'Mau_nhap',
    [
      ['nhom_hang', 'ten_hang', 'dvt', 'don_gia', 'hao_hut_pct', 'phu_kien_kind', 'ngang_mm', 'rong_mm', 'day_mm', 'so_lo', 'ghi_chu'],
      ['PHU_KIEN', '', 'cai', '75240', '0', 'MAT_BICH', '300', '180', '12', '6', 'Neu de trong ten_hang, importer co the tu sinh ten tu thong so'],
      ['PHU_KIEN', '', 'cai', '18500', '0', 'MANG_XONG', '300', '60', '1.5', '', ''],
      ['PHU_KIEN', '', 'cai', '9200', '0', 'TAM_VUONG', '201', '201', '4', '', ''],
      ['PHU_KIEN', '', 'cai', '15400', '0', 'MUI_COC_ROI', '300', '60', '6', '', ''],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['nhom_hang', 'PHU_KIEN'],
      ['dvt', 'cai', 'bo'],
      ['phu_kien_kind', 'MAT_BICH', 'MANG_XONG', 'MUI_COC_ROI', 'MUI_COC_LIEN', 'TAM_VUONG'],
      ['ten_hang', 'Co the de trong neu nhap du thong so', 'Nen de importer tu sinh ten chuan de tranh trung/lech cach viet'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template phu kien', 'Nhap rieng danh muc phu kien de sau do map vao coc mau.', [
      { name: 'nhom_hang', required: true, note: 'Co dinh la PHU_KIEN.' },
      { name: 'ten_hang', required: false, note: 'Co the de trong neu muon he thong tu sinh ten chuan tu thong so.' },
      { name: 'dvt', required: true, note: 'Thuong la cai hoac bo.' },
      { name: 'don_gia', required: false, note: 'Don gia chua VAT.' },
      { name: 'hao_hut_pct', required: false, note: 'Ty le hao hut cho phep (0-100).' },
      { name: 'phu_kien_kind', required: true, note: 'MAT_BICH, MANG_XONG, MUI_COC_ROI, MUI_COC_LIEN, TAM_VUONG.' },
      { name: 'ngang_mm/rong_mm/day_mm', required: true, note: 'Thong so chinh de sinh ten phu kien.' },
      { name: 'so_lo', required: false, note: 'Chi dung cho MAT_BICH neu co so lo.' },
      { name: 'ghi_chu', required: false, note: 'Thong tin bo sung.' },
    ]),
  ],
])

writeWorkbook('05_khu_vuc_ton.xlsx', [
  [
    'Mau_nhap',
    [
      ['location_code', 'location_name', 'location_type', 'parent_location_code'],
      ['BAI_A', 'Bai A', 'STORAGE', ''],
      ['KHU_LOI_A', 'Khu loi A', 'DEFECT', ''],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['location_type', 'STORAGE', 'STAGING', 'DEFECT'],
      ['location_code', 'Nen viet hoa, khong dau, neu co khoang trang se doi thanh _', 'Vi du: KHO_THANH_PHAM'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template khu vuc ton', 'Nhap cac bai/kho/cho xu ly de gan serial.', [
      { name: 'location_code', required: true, note: 'Ma khu vuc duy nhat.' },
      { name: 'location_name', required: false, note: 'Ten hien thi; de trong se lay bang ma.' },
      { name: 'location_type', required: true, note: 'STORAGE, STAGING hoac DEFECT.' },
      { name: 'parent_location_code', required: false, note: 'Ma khu cha neu can phan cap.' },
    ]),
  ],
])

writeWorkbook('06_coc_mau.xlsx', [
  [
    'Mau_nhap',
    [
      ['template_scope', 'cuong_do', 'mac_thep', 'do_ngoai', 'chieu_day', 'mac_be_tong', 'thep_pc', 'pc_nos', 'thep_dai', 'don_kep_factor', 'thep_buoc', 'a1_mm', 'a2_mm', 'a3_mm', 'p1_pct', 'p2_pct', 'p3_pct', 'mat_bich', 'mang_xong', 'tap_vuong', 'mui_coc', 'khoi_luong_kg_md', 'ghi_chu'],
      ['FACTORY', 'PC', 'A', '400', '40', '600', 'Thép PC 7.1', '6', 'Thép đai 3', '1', 'Thép buộc 1', '50', '0', '100', '0.2', '0', '0.8', 'Mặt bích 400x240x7x8LO', 'Măng xông 400x320x5', 'Tấm vuông 400x320x5', 'Mũi cọc rời 400x320x10', '150', 'Mẫu nhà máy'],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['template_scope', 'FACTORY', 'CUSTOM'],
      ['cuong_do', 'PC', 'PHC'],
      ['mac_thep', 'A', 'B', 'C'],
      ['don_kep_factor', '1', '2'],
      ['thep_pc/thep_dai/thep_buoc/mat_bich/mang_xong/tap_vuong/mui_coc', 'Nhap theo ten NVL da co trong sheet 04_nvl', 'Nen khop 100% ten hang'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template coc mau', 'He thong se tu sinh ma_coc. File nay chi nhap thong so dau vao cua loai coc mau.', [
      { name: 'template_scope', required: true, note: 'FACTORY = nha may, CUSTOM = khach phat sinh.' },
      { name: 'cuong_do', required: true, note: 'PC hoac PHC.' },
      { name: 'mac_thep', required: true, note: 'A/B/C.' },
      { name: 'do_ngoai', required: true, note: 'Duong kinh ngoai mm.' },
      { name: 'chieu_day', required: true, note: 'Thanh coc mm.' },
      { name: 'mac_be_tong', required: true, note: 'Vi du 600, 800.' },
      { name: 'thep_pc', required: true, note: 'Ten NVL thep PC da ton tai.' },
      { name: 'pc_nos', required: true, note: 'So thanh PC.' },
      { name: 'thep_dai', required: true, note: 'Ten NVL thep dai.' },
      { name: 'don_kep_factor', required: true, note: '1 = don, 2 = kep.' },
      { name: 'thep_buoc', required: true, note: 'Ten NVL thep buoc.' },
      { name: 'a1_mm/a2_mm/a3_mm', required: true, note: 'Thong so bo tri thep.' },
      { name: 'p1_pct/p2_pct/p3_pct', required: true, note: 'Ty le %. Nhap so, khong can dau %.' },
      { name: 'mat_bich/mang_xong/tap_vuong/mui_coc', required: true, note: 'Ten NVL phu kien da ton tai.' },
      { name: 'khoi_luong_kg_md', required: false, note: 'Thong so tham khao; khong dung tach ma coc.' },
      { name: 'ghi_chu', required: false, note: 'Thong tin bo sung.' },
    ]),
  ],
])

writeWorkbook('07_cap_phoi_be_tong.xlsx', [
  [
    'Mau_nhap',
    [
      ['variant', 'mac_be_tong', 'nvl', 'dvt', 'dinh_muc_m3'],
      ['FULL_XI_TRO_XI', '600', 'Xi mang PCB40', 'kg', '420'],
      ['FULL_XI_TRO_XI', '600', 'Da 1x2', 'kg', '1100'],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['variant', 'FULL_XI_TRO_XI', 'XI_XI', 'XI_TRO', 'XI'],
      ['nvl', 'Nhap theo ten NVL nhom_hang = NVL', 'Nen trung voi sheet 04_nvl'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template cap phoi be tong', 'Moi dong la 1 NVL trong 1 bo cap phoi.', [
      { name: 'variant', required: true, note: 'Loai variant cap phoi.' },
      { name: 'mac_be_tong', required: true, note: 'Mac be tong.' },
      { name: 'nvl', required: true, note: 'Ten NVL thuoc nhom NVL.' },
      { name: 'dvt', required: true, note: 'Don vi tinh.' },
      { name: 'dinh_muc_m3', required: true, note: 'Dinh muc tren 1 m3.' },
    ]),
  ],
])

writeWorkbook('08_dinh_muc_vat_tu_phu.xlsx', [
  [
    'Mau_nhap',
    [
      ['pile_group', 'nvl', 'dvt', 'dinh_muc'],
      ['PC - A400 - 40', 'Dau mo khuon', 'kg', '0.25'],
    ],
  ],
  [
    'Gia_tri_hop_le',
    valuesRows('Gia tri hop le', [
      ['pile_group', 'Nhap theo loai coc nhom ky thuat', 'Vi du: PC - A400 - 40'],
      ['nvl', 'Nhap theo ten NVL', 'Nen trung voi sheet 04_nvl'],
    ]),
  ],
  [
    'Huong_dan',
    notesRows('Template dinh muc vat tu phu', 'Moi dong la 1 vat tu phu ap cho 1 nhom coc.', [
      { name: 'pile_group', required: true, note: 'Loai coc/nhom D.' },
      { name: 'nvl', required: true, note: 'Ten NVL.' },
      { name: 'dvt', required: true, note: 'Don vi tinh.' },
      { name: 'dinh_muc', required: true, note: 'Dinh muc tieu hao.' },
    ]),
  ],
])

writeWorkbook('09_chi_phi_khac.xlsx', [
  [
    'Mau_nhap',
    [
      ['item_name', 'dvt', 'duong_kinh_mm', 'chi_phi_vnd_md', 'sort_order'],
      ['Nang ha', 'vnd/md', '400', '12000', '1'],
      ['Nang ha', 'vnd/md', '500', '14500', '1'],
    ],
  ],
  [
    'Huong_dan',
    notesRows('Template chi phi khac', 'Moi dong la 1 muc chi phi cho 1 duong kinh coc.', [
      { name: 'item_name', required: true, note: 'Ten khoan muc chi phi.' },
      { name: 'dvt', required: true, note: 'Thuong la vnd/md.' },
      { name: 'duong_kinh_mm', required: true, note: 'Duong kinh coc.' },
      { name: 'chi_phi_vnd_md', required: true, note: 'Chi phi tren md.' },
      { name: 'sort_order', required: false, note: 'Thu tu hien thi.' },
    ]),
  ],
])

writeWorkbook('10_thue_loi_nhuan.xlsx', [
  [
    'VAT',
    [
      ['loai_ap_dung', 'vat_pct'],
      ['COC', '8'],
      ['PHU_KIEN', '10'],
    ],
  ],
  [
    'Bien_loi_nhuan',
    [
      ['duong_kinh_mm', 'min_md', 'loi_nhuan_pct'],
      ['400', '0', '6'],
      ['400', '200', '5.5'],
    ],
  ],
  [
    'Huong_dan',
    notesRows('Template thue va bien loi nhuan', 'Workbook nay gom 2 sheet: VAT va Bien_loi_nhuan.', [
      { name: 'VAT.loai_ap_dung', required: true, note: 'COC hoac PHU_KIEN.' },
      { name: 'VAT.vat_pct', required: true, note: 'Ty le VAT %.' },
      { name: 'Bien_loi_nhuan.duong_kinh_mm', required: true, note: 'Duong kinh coc.' },
      { name: 'Bien_loi_nhuan.min_md', required: true, note: 'Moc md tu bao nhieu tro len.' },
      { name: 'Bien_loi_nhuan.loi_nhuan_pct', required: true, note: 'Ty le loi nhuan %.' },
    ]),
  ],
])

const readme = `# Excel import templates

Bo file nay duoc sinh tu cac truong dau vao dang co trong phan mem.

## Thu tu nen nhap du lieu
1. 01_khach_hang.xlsx
2. 02_du_an.xlsx
3. 03_nha_cung_cap.xlsx
4. 04_nvl.xlsx
5. 05_khu_vuc_ton.xlsx
6. 06_coc_mau.xlsx
7. 07_cap_phoi_be_tong.xlsx
8. 08_dinh_muc_vat_tu_phu.xlsx
9. 09_chi_phi_khac.xlsx
10. 10_thue_loi_nhuan.xlsx

## Ghi chu
- Day la bo template de nhap lieu ngoai Excel truoc.
- Chua phai file import tu dong. Buoc tiep theo co the viet script/importer doc cac cot nay de dua vao DB.
- O cac file co cot tham chieu nhu khach_hang, nvl, thep_pc..., nen giu ten giong danh muc goc de map cho de.
`

fs.writeFileSync(path.join(outputDir, 'README.md'), readme, 'utf8')

console.log(`Da tao template Excel tai: ${outputDir}`)
