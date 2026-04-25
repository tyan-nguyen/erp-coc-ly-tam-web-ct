import { createDefaultPayload } from '@/lib/boc-tach/calc'
import type { BocTachDetailPayload, BocTachReferenceData } from '@/lib/boc-tach/types'

const BOC_META_PREFIX = 'ERP_BOC_META::'

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parseBocMeta(row: Record<string, unknown>) {
  const raw = String(row.ghi_chu || '').trim()
  if (!raw.startsWith(BOC_META_PREFIX)) return {} as Record<string, unknown>
  try {
    return JSON.parse(raw.slice(BOC_META_PREFIX.length)) as Record<string, unknown>
  } catch {
    return {} as Record<string, unknown>
  }
}

function readBocMetaNote(row: Record<string, unknown>) {
  const meta = parseBocMeta(row)
  const note = String(meta.note ?? '').trim()
  if (note) return note
  const raw = String(row.ghi_chu || '').trim()
  return raw.startsWith(BOC_META_PREFIX) ? '' : raw
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function accessoryKindFromName(value: string | null | undefined) {
  const normalized = normalizeText(value)
  if (normalized.includes('MAT BICH')) return 'mat_bich'
  if (normalized.includes('MANG XONG') || normalized.includes('MANGXONG')) return 'mang_xong'
  if (normalized.includes('MUI COC')) return 'mui_coc'
  if (
    normalized.includes('TAP') ||
    normalized.includes('TAM VUONG') ||
    normalized.includes('TAMVUONG') ||
    normalized.includes('TAP VUONG') ||
    normalized.includes('TAPVUONG')
  ) {
    return 'tap'
  }
  return null
}

function steelKindFromName(value: string | null | undefined) {
  const normalized = normalizeText(value)
  if (normalized.includes('PC')) return 'pc'
  if (normalized.includes('DAI')) return 'dai'
  if (normalized.includes('BUOC')) return 'buoc'
  return null
}

function parseMaterialDiameter(value: string | null | undefined) {
  const match = normalizeText(value).match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

function findSteelMaterial(
  materials: BocTachReferenceData['materials'],
  kind: 'pc' | 'dai' | 'buoc',
  label: string,
  diameter: number
) {
  const normalizedLabel = normalizeText(label)
  const exactByLabel = materials.find((item) => {
    return (
      normalizeText(item.nhom_hang) === 'THEP' &&
      normalizedLabel.length > 0 &&
      normalizeText(item.ten_hang) === normalizedLabel
    )
  })
  if (exactByLabel) return exactByLabel

  return (
    materials.find((item) => {
      if (normalizeText(item.nhom_hang) !== 'THEP') return false
      return (
        steelKindFromName(item.ten_hang) === kind &&
        parseMaterialDiameter(item.ten_hang) === Number(diameter || 0)
      )
    }) || null
  )
}

export function mapStoredBocTachToPayload(
  bocId: string,
  header: Record<string, unknown>,
  items: Record<string, unknown>[],
  segments: Record<string, unknown>[],
  refs: BocTachReferenceData
): BocTachDetailPayload {
  const base = createDefaultPayload()
  const bocMeta = parseBocMeta(header)
  const materialNameMap = new Map(
    (refs.materials || []).map((item) => [String(item.nvl_id || ''), String(item.ten_hang || '')])
  )
  const headerSegments = Array.isArray(header.to_hop_doan)
    ? (header.to_hop_doan as Array<Record<string, unknown>>)
    : []
  const firstHeaderSegment = headerSegments[0] || {}
  const headerVariant =
    String(firstHeaderSegment?.cap_phoi_variant || '').trim() ||
    String(
      ((segments[0]?.dinh_muc_nvl || {}) as Record<string, unknown>)?.cap_phoi_variant || ''
    ).trim()
  const firstSegmentDm = ((segments[0]?.dinh_muc_nvl || {}) as Record<string, unknown>) || {}
  const normalizedItems =
    items.length > 0
      ? items.map((item) => ({
          nvl_id: String(item.nvl_id || ''),
          ten_nvl:
            String(item.ten_nvl || '').trim() ||
            materialNameMap.get(String(item.nvl_id || '')) ||
            '',
          loai_nvl:
            (item.loai_nvl as BocTachDetailPayload['items'][number]['loai_nvl']) ||
            'KHAC',
          so_luong: toNumber(item.so_luong, 0),
          dvt: String(item.dvt || ''),
          don_gia: toNumber(item.don_gia, 0),
        }))
      : [...base.items]

  const accessorySnapshotSpecs = [
    {
      kind: 'mat_bich',
      nvlId: String(firstHeaderSegment.mat_bich_nvl_id || firstSegmentDm.mat_bich_nvl_id || ''),
      label: String(firstHeaderSegment.mat_bich_label || firstSegmentDm.mat_bich_label || ''),
    },
    {
      kind: 'mang_xong',
      nvlId: String(firstHeaderSegment.mang_xong_nvl_id || firstSegmentDm.mang_xong_nvl_id || ''),
      label: String(firstHeaderSegment.mang_xong_label || firstSegmentDm.mang_xong_label || ''),
    },
    {
      kind: 'mui_coc',
      nvlId: String(firstHeaderSegment.mui_coc_nvl_id || firstSegmentDm.mui_coc_nvl_id || ''),
      label: String(firstHeaderSegment.mui_coc_label || firstSegmentDm.mui_coc_label || ''),
    },
    {
      kind: 'tap',
      nvlId: String(firstHeaderSegment.tap_nvl_id || firstSegmentDm.tap_nvl_id || ''),
      label: String(firstHeaderSegment.tap_label || firstSegmentDm.tap_label || ''),
    },
  ] as const

  const steelSnapshotSpecs = [
    {
      kind: 'pc',
      label: String(header.loai_thep || firstHeaderSegment.loai_thep || firstSegmentDm.loai_thep || ''),
      diameter: toNumber(
        header.pc_dia_mm,
        toNumber(firstHeaderSegment.pc_dia_mm, toNumber(firstSegmentDm.pc_dia_mm, 0))
      ),
    },
    {
      kind: 'dai',
      label: String(firstHeaderSegment.dai_label || firstSegmentDm.dai_label || ''),
      diameter: toNumber(
        header.dai_dia_mm,
        toNumber(firstHeaderSegment.dai_dia_mm, toNumber(firstSegmentDm.dai_dia_mm, 0))
      ),
    },
    {
      kind: 'buoc',
      label: String(firstHeaderSegment.buoc_label || firstSegmentDm.buoc_label || ''),
      diameter: toNumber(
        header.buoc_dia_mm,
        toNumber(firstHeaderSegment.buoc_dia_mm, toNumber(firstSegmentDm.buoc_dia_mm, 0))
      ),
    },
  ] as const

  for (const spec of steelSnapshotSpecs) {
    const hasKind = normalizedItems.some((item) => {
      if (item.loai_nvl !== 'THEP') return false
      return (
        steelKindFromName(item.ten_nvl || materialNameMap.get(String(item.nvl_id || '')) || '') ===
        spec.kind
      )
    })
    if (hasKind) continue

    const matchedMaterial = findSteelMaterial(refs.materials, spec.kind, spec.label, spec.diameter)
    if (!matchedMaterial) continue

    normalizedItems.push({
      nvl_id: matchedMaterial.nvl_id,
      ten_nvl: matchedMaterial.ten_hang,
      loai_nvl: 'THEP',
      so_luong: 0,
      dvt: matchedMaterial.dvt || 'kg',
      don_gia: 0,
    })
  }

  for (const spec of accessorySnapshotSpecs) {
    const hasKind = normalizedItems.some((item) => {
      if (item.loai_nvl !== 'PHU_KIEN') return false
      return (
        accessoryKindFromName(
          item.ten_nvl || materialNameMap.get(String(item.nvl_id || '')) || ''
        ) === spec.kind
      )
    })
    if (hasKind || !spec.nvlId) continue
    normalizedItems.push({
      nvl_id: spec.nvlId,
      ten_nvl: spec.label || materialNameMap.get(spec.nvlId) || '',
      loai_nvl: 'PHU_KIEN',
      so_luong: 0,
      dvt: '',
      don_gia: 0,
    })
  }

  return {
    bocId,
    header: {
      ...base.header,
      da_id: String(header.da_id || ''),
      kh_id: String(header.kh_id || ''),
      ma_coc: String(header.ma_coc || bocMeta.ma_coc || ''),
      loai_coc: String(header.loai_coc || base.header.loai_coc),
      do_ngoai: toNumber(header.do_ngoai, toNumber(header.do_mm, base.header.do_ngoai)),
      chieu_day: toNumber(header.chieu_day, toNumber(header.t_mm, base.header.chieu_day)),
      kg_md: toNumber(
        header.kg_md,
        toNumber(
          firstHeaderSegment.kg_md,
          toNumber(((segments[0]?.dinh_muc_nvl || {}) as Record<string, unknown>).kg_md, base.header.kg_md)
        )
      ),
      mac_be_tong: String(header.mac_be_tong || base.header.mac_be_tong),
      cap_phoi_variant: headerVariant || base.header.cap_phoi_variant,
      ten_boc_tach: readBocMetaNote(header),
      loai_thep: String(header.loai_thep || firstHeaderSegment.loai_thep || firstSegmentDm.loai_thep || ''),
      phuong_thuc_van_chuyen:
        (header.phuong_thuc_van_chuyen as BocTachDetailPayload['header']['phuong_thuc_van_chuyen']) ||
        (firstHeaderSegment.phuong_thuc_van_chuyen as BocTachDetailPayload['header']['phuong_thuc_van_chuyen']) ||
        (firstSegmentDm.phuong_thuc_van_chuyen as BocTachDetailPayload['header']['phuong_thuc_van_chuyen']) ||
        base.header.phuong_thuc_van_chuyen,
      trang_thai:
        (header.trang_thai as BocTachDetailPayload['header']['trang_thai']) ||
        base.header.trang_thai,
      do_mm: toNumber(header.do_mm, toNumber(header.do_ngoai, base.header.do_mm)),
      t_mm: toNumber(header.t_mm, toNumber(header.chieu_day, base.header.t_mm)),
      pc_dia_mm: toNumber(
        header.pc_dia_mm,
        toNumber(firstHeaderSegment.pc_dia_mm, toNumber(firstSegmentDm.pc_dia_mm, base.header.pc_dia_mm))
      ),
      pc_nos: toNumber(
        header.pc_nos,
        toNumber(firstHeaderSegment.pc_nos, toNumber(firstSegmentDm.pc_nos, base.header.pc_nos))
      ),
      dai_dia_mm: toNumber(
        header.dai_dia_mm,
        toNumber(firstHeaderSegment.dai_dia_mm, toNumber(firstSegmentDm.dai_dia_mm, base.header.dai_dia_mm))
      ),
      buoc_dia_mm: toNumber(
        header.buoc_dia_mm,
        toNumber(firstHeaderSegment.buoc_dia_mm, toNumber(firstSegmentDm.buoc_dia_mm, base.header.buoc_dia_mm))
      ),
      dtam_mm: toNumber(
        header.dtam_mm,
        toNumber(firstHeaderSegment.dtam_mm, toNumber(firstSegmentDm.dtam_mm, base.header.dtam_mm))
      ),
      sigma_cu: toNumber(
        header.sigma_cu,
        toNumber(firstHeaderSegment.sigma_cu, toNumber(firstSegmentDm.sigma_cu, base.header.sigma_cu))
      ),
      sigma_pu: toNumber(
        header.sigma_pu,
        toNumber(firstHeaderSegment.sigma_pu, toNumber(firstSegmentDm.sigma_pu, base.header.sigma_pu))
      ),
      sigma_py: toNumber(
        header.sigma_py,
        toNumber(firstHeaderSegment.sigma_py, toNumber(firstSegmentDm.sigma_py, base.header.sigma_py))
      ),
      r: toNumber(header.r, toNumber(firstHeaderSegment.r, toNumber(firstSegmentDm.r, base.header.r))),
      k: toNumber(header.k, toNumber(firstHeaderSegment.k, toNumber(firstSegmentDm.k, base.header.k))),
      ep: toNumber(
        header.ep,
        toNumber(firstHeaderSegment.ep, toNumber(firstSegmentDm.ep, base.header.ep))
      ),
      md_per_tim: toNumber(header.md_per_tim, base.header.md_per_tim),
      total_md: toNumber(header.total_md, base.header.total_md),
      md_per_trip_input: toNumber(
        header.md_per_trip_input,
        toNumber(
          firstHeaderSegment.md_per_trip_input,
          toNumber(firstSegmentDm.md_per_trip_input, base.header.md_per_trip_input)
        )
      ),
      don_gia_van_chuyen: toNumber(
        header.don_gia_van_chuyen,
        toNumber(
          firstHeaderSegment.don_gia_van_chuyen,
          toNumber(firstSegmentDm.don_gia_van_chuyen, base.header.don_gia_van_chuyen)
        )
      ),
      profit_pct: toNumber(bocMeta.profit_pct, toNumber(header.profit_pct, 0)),
      tax_pct: toNumber(bocMeta.tax_pct, toNumber(header.tax_pct, 0)),
      qlsx_ly_do_code: String(bocMeta.qlsx_reason_code || ''),
      qlsx_ly_do_text: String(bocMeta.qlsx_reason_text || ''),
      qlsx_tra_lai_at: String(bocMeta.qlsx_tra_lai_at || ''),
      qlsx_duyet_at: String(bocMeta.qlsx_duyet_at || ''),
    },
    items: normalizedItems,
    segments:
      segments.length > 0
        ? segments.map((seg) => {
            const dm = (seg.dinh_muc_nvl || {}) as Record<string, unknown>
            return {
              template_id: String(seg.template_id || ''),
              ma_coc: String(seg.ma_coc || header.ma_coc || bocMeta.ma_coc || ''),
              ten_doan: String(seg.ten_doan || ''),
              len_m: toNumber(dm.len_m, toNumber(seg.len_m, 0)),
              cnt: toNumber(dm.cnt, 0),
              so_luong_doan: toNumber(seg.so_luong_doan, 0),
              the_tich_m3: toNumber(seg.the_tich_m3, 0),
              v1: toNumber(dm.v1, 0),
              v2: toNumber(dm.v2, 0),
              v3: toNumber(dm.v3, 0),
              mui_segments: toNumber(dm.mui_segments, toNumber(seg.mui_segments, 0)),
              dai_kep_chi_a1: Boolean(dm.dai_kep_chi_a1),
              a1_mm: toNumber(dm.a1_mm, 0),
              a2_mm: toNumber(dm.a2_mm, 0),
              a3_mm: toNumber(dm.a3_mm, 0),
              p1_pct: toNumber(dm.p1_pct, 0),
              p2_pct: toNumber(dm.p2_pct, 0),
              p3_pct: toNumber(dm.p3_pct, 0),
              don_kep_factor: toNumber(dm.don_kep_factor, 1),
            }
          })
        : base.segments,
  }
}
