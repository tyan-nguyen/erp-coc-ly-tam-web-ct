import { applyPileTemplate, computeBocTachPreview, createDefaultPayload } from './lib/boc-tach/calc.ts'
import type { BocTachDetailPayload, BocTachReferenceData, PileTemplateReference } from './lib/boc-tach/types.ts'

const template: PileTemplateReference = {
  template_id: 'tpl-a500',
  label: 'PHC - A500',
  loai_coc: 'PHC - A500',
  mac_be_tong: '80',
  do_ngoai: 500,
  chieu_day: 100,
  pc_dia_mm: 9,
  pc_nos: 14,
  dai_dia_mm: 4,
  buoc_dia_mm: 1,
  dtam_mm: 400,
  a1_mm: 100,
  a2_mm: 0,
  a3_mm: 100,
  p1_pct: 20,
  p2_pct: 0,
  p3_pct: 80,
  don_kep_factor: 2,
}

const payload: BocTachDetailPayload = applyPileTemplate({
  ...createDefaultPayload(),
  header: {
    ...createDefaultPayload().header,
    da_id: 'demo-da',
    kh_id: 'demo-kh',
    loai_coc: 'PHC - A500',
    md_per_tim: 28,
    total_md: 560,
    don_gia_van_chuyen: 0,
  },
  segments: [
    {
      ...createDefaultPayload().segments[0],
      ten_doan: 'MUI',
      len_m: 10,
      cnt: 20,
      so_luong_doan: 20,
      mui_segments: 20,
    },
    {
      ...createDefaultPayload().segments[0],
      ten_doan: 'THAN_1',
      len_m: 9,
      cnt: 20,
      so_luong_doan: 20,
      mui_segments: 0,
    },
    {
      ...createDefaultPayload().segments[0],
      ten_doan: 'THAN_2',
      len_m: 9,
      cnt: 20,
      so_luong_doan: 20,
      mui_segments: 0,
    },
  ],
  items: [],
}, template)

const refs: BocTachReferenceData = {
  concreteMixes: [],
  pileTemplates: [template],
  auxiliaryRates: [
    { nvl_id: 'than-da', ten_nvl: 'Than đá sản xuất', nhom_d: '500', dinh_muc: 1.5, dvt: 'kg' },
    { nvl_id: 'que-han', ten_nvl: 'Que hàn', nhom_d: '500', dinh_muc: 0.12, dvt: 'que' },
    { nvl_id: 'dau-lau', ten_nvl: 'Dầu lau khuôn', nhom_d: '500', dinh_muc: 0.022, dvt: 'lít' },
    { nvl_id: 'dau-do', ten_nvl: 'Dầu DO vận hành', nhom_d: '500', dinh_muc: 0.028, dvt: 'lít' },
    { nvl_id: 'dien', ten_nvl: 'Điện', nhom_d: '500', dinh_muc: 0.5, dvt: 'kwh' },
    { nvl_id: 'gie', ten_nvl: 'Giẻ lau/bao tay', nhom_d: '500', dinh_muc: 0.04, dvt: 'bộ' },
  ],
}

const preview = computeBocTachPreview(payload, refs)
console.log(JSON.stringify({
  segments: preview.segment_snapshots,
  auxiliary_materials: preview.auxiliary_materials,
}, null, 2))
