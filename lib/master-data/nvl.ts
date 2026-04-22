export const ACCESSORY_KIND_OPTIONS = [
  { value: 'MAT_BICH', label: 'Mặt bích', code: 'MB' },
  { value: 'MANG_XONG', label: 'Măng xông', code: 'MX' },
  { value: 'MUI_COC_ROI', label: 'Mũi cọc rời', code: 'MCR' },
  { value: 'MUI_COC_LIEN', label: 'Mũi cọc liền', code: 'MCL' },
  { value: 'TAM_VUONG', label: 'Tấm vuông', code: 'TV' },
] as const

export type AccessoryKind = (typeof ACCESSORY_KIND_OPTIONS)[number]['value']

export const STEEL_KIND_OPTIONS = [
  { value: 'THEP_PC', label: 'Thép PC', code: 'TPC' },
  { value: 'THEP_DAI', label: 'Thép đai', code: 'TDAI' },
  { value: 'THEP_BUOC', label: 'Thép buộc', code: 'TBUOC' },
] as const

export const DVT_OPTIONS = ['kg', 'm3', 'cái', 'lít', 'kwh', 'que', 'bộ', 'md', 'tấn'] as const

export type SteelKind = (typeof STEEL_KIND_OPTIONS)[number]['value']

export type AccessoryDimensions = {
  ngangMm?: number
  rongMm?: number
  dayMm?: number
  soLo?: number
}

export function formatNhomHangLabel(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'PHU_KIEN') return 'Phụ kiện'
  if (normalized === 'VAT_TU_PHU') return 'Vật tư phụ'
  if (normalized === 'CONG_CU_DUNG_CU') return 'Công cụ dụng cụ'
  if (normalized === 'TAI_SAN') return 'Tài sản'
  if (normalized === 'NVL') return 'NVL'
  if (normalized === 'THEP') return 'Thép'
  return String(value ?? '')
}

export function buildAccessoryName(kind: string, dims: AccessoryDimensions) {
  const option = ACCESSORY_KIND_OPTIONS.find((item) => item.value === kind)
  const baseLabel = option?.label || 'Phụ kiện'
  const parts = buildDimensionParts(dims)
  if (parts.length === 0) return baseLabel
  return `${baseLabel} ${parts.join('x')}`
}

export function buildAccessoryCode(kind: string, dims: AccessoryDimensions) {
  const option = ACCESSORY_KIND_OPTIONS.find((item) => item.value === kind)
  const prefix = option?.code || 'PK'
  const parts = buildDimensionParts(dims)
  if (parts.length === 0) return `PK-${prefix}`
  return `PK-${prefix}-${parts.join('x').toUpperCase()}`
}

export function buildSteelName(kind: string, diameterMm?: number) {
  const option = STEEL_KIND_OPTIONS.find((item) => item.value === kind)
  const baseLabel = option?.label || 'Thép'
  if (!isPositiveNumber(diameterMm)) return baseLabel
  return `${baseLabel} ${Number(diameterMm)}`
}

export function buildSteelCode(kind: string, diameterMm?: number) {
  const option = STEEL_KIND_OPTIONS.find((item) => item.value === kind)
  const prefix = option?.code || 'THEP'
  if (!isPositiveNumber(diameterMm)) return `NVL-${prefix}`
  return `NVL-${prefix}-${Number(diameterMm)}`
}

export function deriveDisplayCode(row: Record<string, unknown>) {
  const explicitCode = String(row.ma_nvl ?? '').trim()
  if (explicitCode) return explicitCode

  const nhomHang = String(row.nhom_hang ?? '').trim().toUpperCase()
  const tenHang = String(row.ten_hang ?? '').trim()

  if (nhomHang === 'THEP') {
    if (tenHang.startsWith('Thép PC ')) {
      return `NVL-TPC-${tenHang.replace('Thép PC ', '').trim()}`
    }
    if (tenHang.startsWith('Thép đai ')) {
      return `NVL-TDAI-${tenHang.replace('Thép đai ', '').trim()}`
    }
    if (tenHang.startsWith('Thép buộc ')) {
      return `NVL-TBUOC-${tenHang.replace('Thép buộc ', '').trim()}`
    }
  }

  if (nhomHang === 'PHU_KIEN') {
    if (tenHang.startsWith('Mặt bích ')) {
      return `PK-MB-${normalizeTail(tenHang.replace('Mặt bích ', ''))}`
    }
    if (tenHang.startsWith('Măng xông ')) {
      return `PK-MX-${normalizeTail(tenHang.replace('Măng xông ', ''))}`
    }
    if (tenHang.startsWith('Mũi cọc rời ')) {
      return `PK-MCR-${normalizeTail(tenHang.replace('Mũi cọc rời ', ''))}`
    }
    if (tenHang.startsWith('Mũi cọc liền ')) {
      return `PK-MCL-${normalizeTail(tenHang.replace('Mũi cọc liền ', ''))}`
    }
    if (tenHang.startsWith('Tấm vuông ')) {
      return `PK-TV-${normalizeTail(tenHang.replace('Tấm vuông ', ''))}`
    }
  }

  const rawId = String(row.nvl_id ?? '').trim()
  if (!rawId) return '-'
  return `NVL-${rawId.slice(0, 8).toUpperCase()}`
}

export function deriveCanonicalMaterialCode(input: {
  materialCode?: unknown
  materialName?: unknown
  materialGroup?: unknown
}) {
  const rawCode = String(input.materialCode ?? '').trim()
  const rawName = String(input.materialName ?? '').trim()
  const rawGroup = String(input.materialGroup ?? '').trim().toUpperCase()

  if (rawCode && !rawCode.includes('::') && rawCode !== '-') return rawCode

  const inferredGroup =
    rawGroup ||
    (rawCode.startsWith('THEP::') ? 'THEP' : '') ||
    (rawCode.startsWith('PHU_KIEN::') ? 'PHU_KIEN' : '') ||
    (rawName.startsWith('Thép ') ? 'THEP' : '') ||
    (rawName.startsWith('Mặt bích ') ||
    rawName.startsWith('Măng xông ') ||
    rawName.startsWith('Mũi cọc rời ') ||
    rawName.startsWith('Mũi cọc liền ') ||
    rawName.startsWith('Tấm vuông ')
      ? 'PHU_KIEN'
      : '')

  if (rawName) {
    const derived = deriveDisplayCode({
      nhom_hang: inferredGroup,
      ten_hang: rawName,
    })
    if (derived && derived !== '-') return derived
  }

  return rawCode || rawName || '-'
}

function normalizeTail(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function buildDimensionParts(dims: AccessoryDimensions) {
  const parts: string[] = []
  if (isPositiveNumber(dims.ngangMm)) parts.push(String(Number(dims.ngangMm)))
  if (isPositiveNumber(dims.rongMm)) parts.push(String(Number(dims.rongMm)))
  if (isPositiveNumber(dims.dayMm)) parts.push(String(Number(dims.dayMm)))
  if (isPositiveNumber(dims.soLo)) parts.push(`${Number(dims.soLo)}LO`)
  return parts
}

function isPositiveNumber(value: unknown) {
  return Number.isFinite(Number(value)) && Number(value) > 0
}
