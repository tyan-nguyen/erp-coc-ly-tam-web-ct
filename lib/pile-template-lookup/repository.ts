import type { SupabaseClient } from '@supabase/supabase-js'
import { calcTechPreview, createDefaultPayload } from '@/lib/boc-tach/calc'
import type { BocTachDetailPayload, TechPreview } from '@/lib/boc-tach/types'
import { buildItemKey, normalizeText, round3, toNumber } from '@/lib/ton-kho-thanh-pham/internal'
import {
  loadFinishedGoodsCurrentInventoryRows,
  loadFinishedGoodsPhysicalPoolByBucket,
  loadFinishedGoodsProjectPoolByBucket,
} from '@/lib/ton-kho-thanh-pham/repository'

type LookupSearchParams = Partial<
  Record<
    | 'q'
    | 'cuong_do'
    | 'mac_thep'
    | 'do_ngoai'
    | 'chieu_day'
    | 'mac_be_tong'
    | 'kg_md'
    | 'thep_pc'
    | 'pc_nos'
    | 'thep_dai'
    | 'don_kep_factor'
    | 'thep_buoc'
    | 'a1_mm'
    | 'a2_mm'
    | 'a3_mm'
    | 'p1_pct'
    | 'p2_pct'
    | 'p3_pct'
    | 'chieu_dai_m'
    | 'mat_bich'
    | 'mang_xong'
    | 'mui_coc'
    | 'tap',
    string | string[] | undefined
  >
>

type RawTemplateRow = Record<string, unknown>

type StockSnapshot = {
  muiPhysicalQty: number
  muiProjectQty: number
  muiRetailQty: number
  thanPhysicalQty: number
  thanProjectQty: number
  thanRetailQty: number
}

export type PileTemplateLookupFilters = {
  query: string
  cuongDo: string
  macThep: string
  doNgoai: number | null
  chieuDay: number | null
  macBeTong: string
  kgMd: number | null
  thepPc: string
  pcNos: number | null
  thepDai: string
  donKepFactor: number | null
  thepBuoc: string
  a1Mm: number | null
  a2Mm: number | null
  a3Mm: number | null
  p1Pct: number | null
  p2Pct: number | null
  p3Pct: number | null
  chieuDaiM: number | null
  matBich: string
  mangXong: string
  muiCoc: string
  tap: string
}

export type PileTemplateLookupRow = {
  templateId: string
  loaiCoc: string
  maCoc: string
  cuongDo: string
  macThep: string
  doNgoai: number
  chieuDay: number
  macBeTong: string
  khoiLuongKgMd: number | null
  steelLabels: {
    pc: string
    dai: string
    buoc: string
  }
  pcNos: number | null
  donKepFactor: number | null
  a1Mm: number | null
  a2Mm: number | null
  a3Mm: number | null
  p1Pct: number | null
  p2Pct: number | null
  p3Pct: number | null
  templateScope: 'FACTORY' | 'CUSTOM'
  sourceLabel: string
  componentLabels: string[]
  accessoryLabels: {
    matBich: string
    mangXong: string
    muiCoc: string
    tap: string
  }
  accessoryIds: {
    matBich: string
    mangXong: string
    muiCoc: string
    tap: string
  }
  stockAtRequestedLength: StockSnapshot | null
  techPreview: TechPreview
  differenceLabels: string[]
  score: number
}

export type PileTemplateLookupPageData = {
  filters: PileTemplateLookupFilters
  hasQuery: boolean
  exactMatches: PileTemplateLookupRow[]
  nearMatches: PileTemplateLookupRow[]
}

export async function loadPileTemplateDetailByIdentity(
  supabase: SupabaseClient,
  identity: { templateId?: string | null; maCoc?: string | null; loaiCoc?: string | null }
): Promise<PileTemplateLookupRow | null> {
  const normalizedTemplateId = normalizeText(identity.templateId)
  const normalizedMaCoc = normalizeSearch(identity.maCoc)
  const normalizedLoaiCoc = normalizeSearch(identity.loaiCoc)
  if (!normalizedTemplateId && !normalizedMaCoc && !normalizedLoaiCoc) return null

  const [{ data: templateRows, error: templateError }, { data: nvlRows, error: nvlError }] = await Promise.all([
    supabase.from('dm_coc_template').select('*').eq('is_active', true).limit(500),
    supabase.from('nvl').select('nvl_id, ten_hang').eq('is_active', true).limit(800),
  ])

  if (templateError) throw templateError
  if (nvlError) throw nvlError

  const nvlMap = new Map((nvlRows ?? []).map((row) => [String(row.nvl_id ?? ''), normalizeText(row.ten_hang)]))
  const templates = (templateRows ?? [])
    .map((row) => mapTemplateRow(row as RawTemplateRow, nvlMap))
    .filter((row) => row.loaiCoc)
    .sort((left, right) => {
      if (left.templateScope !== right.templateScope) return left.templateScope === 'FACTORY' ? -1 : 1
      return left.loaiCoc.localeCompare(right.loaiCoc, 'vi')
    })

  const matched = templates.find(
    (candidate) =>
      (normalizedTemplateId && candidate.templateId === normalizedTemplateId) ||
      (normalizedMaCoc && normalizeSearch(candidate.maCoc) === normalizedMaCoc) ||
      (normalizedLoaiCoc &&
        (normalizeSearch(candidate.loaiCoc) === normalizedLoaiCoc || normalizeSearch(candidate.maCoc) === normalizedLoaiCoc))
  )

  if (!matched) return null

  return {
    ...matched,
    stockAtRequestedLength: null,
    differenceLabels: [],
    score: 0,
  }
}

type TemplateCandidate = {
  templateId: string
  loaiCoc: string
  maCoc: string
  cuongDo: string
  macThep: string
  doNgoai: number
  chieuDay: number
  macBeTong: string
  khoiLuongKgMd: number | null
  steelLabels: {
    pc: string
    dai: string
    buoc: string
  }
  pcNos: number | null
  donKepFactor: number | null
  a1Mm: number | null
  a2Mm: number | null
  a3Mm: number | null
  p1Pct: number | null
  p2Pct: number | null
  p3Pct: number | null
  techPreview: TechPreview
  templateScope: 'FACTORY' | 'CUSTOM'
  sourceLabel: string
  componentLabels: string[]
  accessoryLabels: {
    matBich: string
    mangXong: string
    muiCoc: string
    tap: string
  }
  accessoryIds: {
    matBich: string
    mangXong: string
    muiCoc: string
    tap: string
  }
  normalizedText: string
}

const TEMPLATE_META_PREFIX = 'ERP_TEMPLATE_META::'

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? '').trim() : String(value ?? '').trim()
}

function normalizeSearch(value: unknown) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeCuongDo(value: unknown) {
  const normalized = normalizeText(value).toUpperCase()
  if (normalized.startsWith('PHC')) return 'PHC'
  if (normalized.startsWith('PC')) return 'PC'
  return normalized
}

function extractSteelGrade(value: unknown) {
  const normalized = normalizeText(value).toUpperCase()
  const direct = normalized.match(/^([ABC])$/)
  if (direct) return direct[1]
  const fromLoai = normalized.match(/-\s*([ABC])\d+/)
  return fromLoai?.[1] ?? ''
}

function normalizeSteelGrade(value: unknown) {
  return extractSteelGrade(value)
}

function normalizeTemplateScope(value: unknown): 'FACTORY' | 'CUSTOM' {
  return normalizeText(value).toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'FACTORY'
}

function parseTemplateMeta(row: RawTemplateRow) {
  const raw = String(row.ghi_chu ?? '').trim()
  if (!raw.startsWith(TEMPLATE_META_PREFIX)) return {} as RawTemplateRow
  try {
    return JSON.parse(raw.slice(TEMPLATE_META_PREFIX.length)) as RawTemplateRow
  } catch {
    return {} as RawTemplateRow
  }
}

function readStringCandidate(row: RawTemplateRow, fields: string[]) {
  for (const field of fields) {
    const value = normalizeText(row[field])
    if (value) return value
  }
  const metadata = parseTemplateMeta(row)
  for (const field of fields) {
    const value = normalizeText(metadata[field])
    if (value) return value
  }
  return ''
}

function readNumberCandidate(row: RawTemplateRow, fields: string[]) {
  for (const field of fields) {
    const value = row[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') return toNumber(value)
  }
  const metadata = parseTemplateMeta(row)
  for (const field of fields) {
    const value = metadata[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') return toNumber(value)
  }
  return 0
}

function toNullableNumber(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return null
  const parsed = Number(raw.replace(/,/g, '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function parseMaterialDiameter(value: string) {
  const normalized = normalizeText(value)
  const match = normalized.match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

function resolveTemplateCode(row: RawTemplateRow) {
  const direct = readStringCandidate(row, ['ma_coc', 'ma_coc_template', 'ma_template', 'loai_coc'])
  if (direct) return direct

  const macBeTong = readStringCandidate(row, ['mac_be_tong'])
  const macThep = normalizeSteelGrade(readStringCandidate(row, ['mac_thep', 'loai_coc']))
  const doNgoai = readNumberCandidate(row, ['do_ngoai'])
  if (!macBeTong || !macThep || !doNgoai) return ''
  return `M${macBeTong} - ${macThep}${doNgoai}`
}

function readAccessoryId(row: RawTemplateRow, candidates: string[]) {
  return readStringCandidate(row, candidates)
}

function resolveComponentLabel(nvlMap: Map<string, string>, row: RawTemplateRow, idFields: string[], labelFields: string[]) {
  const labelValue = readStringCandidate(row, labelFields)
  if (labelValue) return labelValue
  const nvlId = readAccessoryId(row, idFields)
  return nvlMap.get(nvlId) ?? ''
}

function toNullableRoundedNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? round3(value) : null
}

function buildTemplateTechPreview(input: {
  doNgoai: number
  chieuDay: number
  macBeTong: string
  steelPcDiameter: number
  pcNos: number
}): TechPreview {
  const basePayload = createDefaultPayload()
  const payload: BocTachDetailPayload = {
    ...basePayload,
    header: {
      ...basePayload.header,
      do_ngoai: input.doNgoai,
      chieu_day: input.chieuDay,
      mac_be_tong: input.macBeTong,
      do_mm: input.doNgoai,
      t_mm: input.chieuDay,
      pc_dia_mm: input.steelPcDiameter,
      pc_nos: input.pcNos,
      dtam_mm: Math.max(0, input.doNgoai - input.chieuDay),
    },
  }

  return calcTechPreview(payload)
}

function loadFilters(raw: LookupSearchParams): PileTemplateLookupFilters {
  return {
    query: readParam(raw.q),
    cuongDo: normalizeCuongDo(readParam(raw.cuong_do)),
    macThep: normalizeSteelGrade(readParam(raw.mac_thep)),
    doNgoai: toNullableNumber(readParam(raw.do_ngoai)),
    chieuDay: toNullableNumber(readParam(raw.chieu_day)),
    macBeTong: normalizeText(readParam(raw.mac_be_tong)),
    kgMd: toNullableNumber(readParam(raw.kg_md)),
    thepPc: readParam(raw.thep_pc),
    pcNos: toNullableNumber(readParam(raw.pc_nos)),
    thepDai: readParam(raw.thep_dai),
    donKepFactor: toNullableNumber(readParam(raw.don_kep_factor)),
    thepBuoc: readParam(raw.thep_buoc),
    a1Mm: toNullableNumber(readParam(raw.a1_mm)),
    a2Mm: toNullableNumber(readParam(raw.a2_mm)),
    a3Mm: toNullableNumber(readParam(raw.a3_mm)),
    p1Pct: toNullableNumber(readParam(raw.p1_pct)),
    p2Pct: toNullableNumber(readParam(raw.p2_pct)),
    p3Pct: toNullableNumber(readParam(raw.p3_pct)),
    chieuDaiM: toNullableNumber(readParam(raw.chieu_dai_m)),
    matBich: readParam(raw.mat_bich),
    mangXong: readParam(raw.mang_xong),
    muiCoc: readParam(raw.mui_coc),
    tap: readParam(raw.tap),
  }
}

function hasLookupQuery(filters: PileTemplateLookupFilters) {
  return Boolean(
    filters.query ||
      filters.cuongDo ||
      filters.macThep ||
      filters.doNgoai !== null ||
      filters.chieuDay !== null ||
      filters.macBeTong ||
      filters.kgMd !== null ||
      filters.thepPc ||
      filters.pcNos !== null ||
      filters.thepDai ||
      filters.donKepFactor !== null ||
      filters.thepBuoc ||
      filters.a1Mm !== null ||
      filters.a2Mm !== null ||
      filters.a3Mm !== null ||
      filters.p1Pct !== null ||
      filters.p2Pct !== null ||
      filters.p3Pct !== null ||
      filters.chieuDaiM !== null ||
      filters.matBich ||
      filters.mangXong ||
      filters.muiCoc ||
      filters.tap
  )
}

function mapTemplateRow(row: RawTemplateRow, nvlMap: Map<string, string>): TemplateCandidate {
  const templateScope = normalizeTemplateScope(readStringCandidate(row, ['template_scope']))
  const loaiCoc = readStringCandidate(row, ['loai_coc'])
  const maCoc = resolveTemplateCode(row)
  const cuongDo = normalizeCuongDo(readStringCandidate(row, ['cuong_do', 'loai_coc']))
  const macThep = normalizeSteelGrade(readStringCandidate(row, ['mac_thep', 'loai_coc']))
  const doNgoai = readNumberCandidate(row, ['do_ngoai'])
  const chieuDay = readNumberCandidate(row, ['chieu_day'])
  const macBeTong = readStringCandidate(row, ['mac_be_tong'])
  const khoiLuongKgMdRaw = readNumberCandidate(row, ['khoi_luong_kg_md', 'kg_md', 'trong_luong_kg_md'])
  const steelPcDiameterRaw = readNumberCandidate(row, ['pc_dia_mm'])
  const pcNosRaw = readNumberCandidate(row, ['pc_nos'])
  const donKepFactorRaw = readNumberCandidate(row, ['don_kep_factor', 'don_kep'])
  const a1MmRaw = readNumberCandidate(row, ['a1_mm'])
  const a2MmRaw = readNumberCandidate(row, ['a2_mm'])
  const a3MmRaw = readNumberCandidate(row, ['a3_mm'])
  const p1PctRaw = readNumberCandidate(row, ['p1_pct'])
  const p2PctRaw = readNumberCandidate(row, ['p2_pct'])
  const p3PctRaw = readNumberCandidate(row, ['p3_pct'])
  const matBichId = readAccessoryId(row, ['mat_bich_nvl_id'])
  const mangXongId = readAccessoryId(row, ['mang_xong_nvl_id'])
  const tapId = readAccessoryId(row, ['tap_nvl_id', 'tap_vuong_nvl_id'])
  const muiCocId = readAccessoryId(row, ['mui_coc_nvl_id'])
  const steelLabels = {
    pc: resolveComponentLabel(nvlMap, row, ['pc_nvl_id', 'thep_pc_nvl_id'], ['thep_pc', 'pc_label']),
    dai: resolveComponentLabel(nvlMap, row, ['dai_nvl_id', 'thep_dai_nvl_id'], ['thep_dai', 'dai_label']),
    buoc: resolveComponentLabel(nvlMap, row, ['buoc_nvl_id', 'thep_buoc_nvl_id'], ['thep_buoc', 'buoc_label']),
  }
  const steelPcDiameter =
    Number.isFinite(steelPcDiameterRaw) && steelPcDiameterRaw > 0
      ? steelPcDiameterRaw
      : parseMaterialDiameter(steelLabels.pc)

  const accessoryLabels = {
    matBich: resolveComponentLabel(nvlMap, row, ['mat_bich_nvl_id'], ['mat_bich', 'mat_bich_label']),
    mangXong: resolveComponentLabel(nvlMap, row, ['mang_xong_nvl_id'], ['mang_xong', 'mang_xong_label']),
    tap: resolveComponentLabel(nvlMap, row, ['tap_nvl_id', 'tap_vuong_nvl_id'], ['tap_vuong', 'tap_label']),
    muiCoc: resolveComponentLabel(nvlMap, row, ['mui_coc_nvl_id'], ['mui_coc', 'mui_coc_label']),
  }

  const componentLabels = [
    steelLabels.pc,
    steelLabels.dai,
    steelLabels.buoc,
    accessoryLabels.matBich,
    accessoryLabels.mangXong,
    accessoryLabels.tap,
    accessoryLabels.muiCoc,
  ].filter(Boolean)

  return {
    templateId: String(row.template_id ?? row.id ?? ''),
    loaiCoc,
    maCoc,
    cuongDo,
    macThep,
    doNgoai,
    chieuDay,
    macBeTong,
    khoiLuongKgMd: Number.isFinite(khoiLuongKgMdRaw) && khoiLuongKgMdRaw > 0 ? round3(khoiLuongKgMdRaw) : null,
    steelLabels,
    pcNos: toNullableRoundedNumber(pcNosRaw),
    donKepFactor: toNullableRoundedNumber(donKepFactorRaw),
    a1Mm: toNullableRoundedNumber(a1MmRaw),
    a2Mm: toNullableRoundedNumber(a2MmRaw),
    a3Mm: toNullableRoundedNumber(a3MmRaw),
    p1Pct: toNullableRoundedNumber(p1PctRaw),
    p2Pct: toNullableRoundedNumber(p2PctRaw),
    p3Pct: toNullableRoundedNumber(p3PctRaw),
    techPreview: buildTemplateTechPreview({
      doNgoai,
      chieuDay,
      macBeTong,
      steelPcDiameter,
      pcNos: Number.isFinite(pcNosRaw) ? pcNosRaw : 0,
    }),
    templateScope,
    sourceLabel: templateScope === 'CUSTOM' ? 'Khách phát sinh' : 'Nhà máy',
    componentLabels,
    accessoryLabels,
    accessoryIds: {
      matBich: matBichId,
      mangXong: mangXongId,
      muiCoc: muiCocId,
      tap: tapId,
    },
    normalizedText: normalizeSearch(
      [loaiCoc, maCoc, cuongDo, macThep, doNgoai, chieuDay, macBeTong, ...componentLabels].join(' ')
    ),
  }
}

function buildStockSnapshot(
  loaiCoc: string,
  chieuDaiM: number | null,
  physicalPool: Map<string, number>,
  projectPool: Map<string, number>,
  retailPool: Map<string, number>
): StockSnapshot | null {
  if (chieuDaiM === null) return null

  const rounded = round3(chieuDaiM)
  return {
    muiPhysicalQty: physicalPool.get(buildItemKey(loaiCoc, 'MUI', rounded)) ?? 0,
    muiProjectQty: projectPool.get(buildItemKey(loaiCoc, 'MUI', rounded)) ?? 0,
    muiRetailQty: retailPool.get(buildItemKey(loaiCoc, 'MUI', rounded)) ?? 0,
    thanPhysicalQty: physicalPool.get(buildItemKey(loaiCoc, 'THAN', rounded)) ?? 0,
    thanProjectQty: projectPool.get(buildItemKey(loaiCoc, 'THAN', rounded)) ?? 0,
    thanRetailQty: retailPool.get(buildItemKey(loaiCoc, 'THAN', rounded)) ?? 0,
  }
}

function buildDifferenceLabels(candidate: TemplateCandidate, filters: PileTemplateLookupFilters) {
  const labels: string[] = []

  if (filters.cuongDo && candidate.cuongDo !== filters.cuongDo) {
    labels.push(`Khác cường độ: ${candidate.cuongDo} so với ${filters.cuongDo}`)
  }
  if (filters.macThep && candidate.macThep !== filters.macThep) {
    labels.push(`Khác mác thép: ${candidate.macThep} so với ${filters.macThep}`)
  }
  if (filters.doNgoai !== null && candidate.doNgoai !== filters.doNgoai) {
    labels.push(`ĐK ngoài lệch ${Math.abs(candidate.doNgoai - filters.doNgoai)} mm`)
  }
  if (filters.chieuDay !== null && candidate.chieuDay !== filters.chieuDay) {
    labels.push(`Thành cọc lệch ${Math.abs(candidate.chieuDay - filters.chieuDay)} mm`)
  }
  if (filters.macBeTong && candidate.macBeTong !== filters.macBeTong) {
    labels.push(`Khác mác bê tông: ${candidate.macBeTong} so với ${filters.macBeTong}`)
  }
  if (filters.kgMd !== null && round3(candidate.khoiLuongKgMd ?? 0) !== round3(filters.kgMd)) {
    labels.push(`Khác khối lượng: ${candidate.khoiLuongKgMd ?? 0} so với ${filters.kgMd}`)
  }
  if (filters.thepPc && normalizeSearch(candidate.steelLabels.pc) !== normalizeSearch(filters.thepPc)) {
    labels.push(`Khác thép PC: ${candidate.steelLabels.pc || 'Không có'} so với bộ đang hỏi`)
  }
  if (filters.pcNos !== null && round3(candidate.pcNos ?? 0) !== round3(filters.pcNos)) {
    labels.push(`Khác số thanh PC: ${candidate.pcNos ?? 0} so với ${filters.pcNos}`)
  }
  if (filters.thepDai && normalizeSearch(candidate.steelLabels.dai) !== normalizeSearch(filters.thepDai)) {
    labels.push(`Khác thép đai: ${candidate.steelLabels.dai || 'Không có'} so với bộ đang hỏi`)
  }
  if (filters.donKepFactor !== null && round3(candidate.donKepFactor ?? 0) !== round3(filters.donKepFactor)) {
    labels.push(`Khác đơn/kép: ${candidate.donKepFactor ?? 0} so với ${filters.donKepFactor}`)
  }
  if (filters.thepBuoc && normalizeSearch(candidate.steelLabels.buoc) !== normalizeSearch(filters.thepBuoc)) {
    labels.push(`Khác thép buộc: ${candidate.steelLabels.buoc || 'Không có'} so với bộ đang hỏi`)
  }
  if (filters.a1Mm !== null && round3(candidate.a1Mm ?? 0) !== round3(filters.a1Mm)) {
    labels.push(`Khác A1: ${candidate.a1Mm ?? 0} so với ${filters.a1Mm}`)
  }
  if (filters.a2Mm !== null && round3(candidate.a2Mm ?? 0) !== round3(filters.a2Mm)) {
    labels.push(`Khác A2: ${candidate.a2Mm ?? 0} so với ${filters.a2Mm}`)
  }
  if (filters.a3Mm !== null && round3(candidate.a3Mm ?? 0) !== round3(filters.a3Mm)) {
    labels.push(`Khác A3: ${candidate.a3Mm ?? 0} so với ${filters.a3Mm}`)
  }
  if (filters.p1Pct !== null && round3(candidate.p1Pct ?? 0) !== round3(filters.p1Pct)) {
    labels.push(`Khác PctA1: ${candidate.p1Pct ?? 0} so với ${filters.p1Pct}`)
  }
  if (filters.p2Pct !== null && round3(candidate.p2Pct ?? 0) !== round3(filters.p2Pct)) {
    labels.push(`Khác PctA2: ${candidate.p2Pct ?? 0} so với ${filters.p2Pct}`)
  }
  if (filters.p3Pct !== null && round3(candidate.p3Pct ?? 0) !== round3(filters.p3Pct)) {
    labels.push(`Khác PctA3: ${candidate.p3Pct ?? 0} so với ${filters.p3Pct}`)
  }
  if (filters.matBich && normalizeSearch(candidate.accessoryLabels.matBich) !== normalizeSearch(filters.matBich)) {
    labels.push(`Khác mặt bích: ${candidate.accessoryLabels.matBich || 'Không có'} so với bộ đang hỏi`)
  }
  if (filters.mangXong && normalizeSearch(candidate.accessoryLabels.mangXong) !== normalizeSearch(filters.mangXong)) {
    labels.push(`Khác măng xông: ${candidate.accessoryLabels.mangXong || 'Không có'} so với bộ đang hỏi`)
  }
  if (filters.muiCoc && normalizeSearch(candidate.accessoryLabels.muiCoc) !== normalizeSearch(filters.muiCoc)) {
    labels.push(`Khác mũi cọc: ${candidate.accessoryLabels.muiCoc || 'Không có'} so với bộ đang hỏi`)
  }
  if (filters.tap && normalizeSearch(candidate.accessoryLabels.tap) !== normalizeSearch(filters.tap)) {
    labels.push(`Khác táp vuông: ${candidate.accessoryLabels.tap || 'Không có'} so với bộ đang hỏi`)
  }

  const hasAccessoryFilter = Boolean(filters.matBich || filters.mangXong || filters.muiCoc || filters.tap)
  const hasAnyAccessory = Boolean(
    candidate.accessoryLabels.matBich ||
      candidate.accessoryLabels.mangXong ||
      candidate.accessoryLabels.muiCoc ||
      candidate.accessoryLabels.tap
  )
  if (!hasAccessoryFilter && hasAnyAccessory && labels.length === 0) {
    labels.push('Cần kiểm tra phụ kiện')
  }

  return labels
}

function isExactMatch(candidate: TemplateCandidate, filters: PileTemplateLookupFilters) {
  const query = normalizeSearch(filters.query)
  const exactTextMatch =
    Boolean(query) && (normalizeSearch(candidate.loaiCoc) === query || normalizeSearch(candidate.maCoc) === query)

  const exactFieldMatch =
    (!filters.cuongDo || candidate.cuongDo === filters.cuongDo) &&
    (!filters.macThep || candidate.macThep === filters.macThep) &&
    (filters.doNgoai === null || candidate.doNgoai === filters.doNgoai) &&
    (filters.chieuDay === null || candidate.chieuDay === filters.chieuDay) &&
    (!filters.macBeTong || candidate.macBeTong === filters.macBeTong) &&
    (filters.kgMd === null || round3(candidate.khoiLuongKgMd ?? 0) === round3(filters.kgMd)) &&
    (!filters.thepPc || normalizeSearch(candidate.steelLabels.pc) === normalizeSearch(filters.thepPc)) &&
    (filters.pcNos === null || round3(candidate.pcNos ?? 0) === round3(filters.pcNos)) &&
    (!filters.thepDai || normalizeSearch(candidate.steelLabels.dai) === normalizeSearch(filters.thepDai)) &&
    (filters.donKepFactor === null || round3(candidate.donKepFactor ?? 0) === round3(filters.donKepFactor)) &&
    (!filters.thepBuoc || normalizeSearch(candidate.steelLabels.buoc) === normalizeSearch(filters.thepBuoc)) &&
    (filters.a1Mm === null || round3(candidate.a1Mm ?? 0) === round3(filters.a1Mm)) &&
    (filters.a2Mm === null || round3(candidate.a2Mm ?? 0) === round3(filters.a2Mm)) &&
    (filters.a3Mm === null || round3(candidate.a3Mm ?? 0) === round3(filters.a3Mm)) &&
    (filters.p1Pct === null || round3(candidate.p1Pct ?? 0) === round3(filters.p1Pct)) &&
    (filters.p2Pct === null || round3(candidate.p2Pct ?? 0) === round3(filters.p2Pct)) &&
    (filters.p3Pct === null || round3(candidate.p3Pct ?? 0) === round3(filters.p3Pct)) &&
    (!filters.matBich || normalizeSearch(candidate.accessoryLabels.matBich) === normalizeSearch(filters.matBich)) &&
    (!filters.mangXong || normalizeSearch(candidate.accessoryLabels.mangXong) === normalizeSearch(filters.mangXong)) &&
    (!filters.muiCoc || normalizeSearch(candidate.accessoryLabels.muiCoc) === normalizeSearch(filters.muiCoc)) &&
    (!filters.tap || normalizeSearch(candidate.accessoryLabels.tap) === normalizeSearch(filters.tap))

  const hasSpecFilter = Boolean(
    filters.cuongDo ||
      filters.macThep ||
      filters.doNgoai !== null ||
      filters.chieuDay !== null ||
      filters.macBeTong ||
      filters.kgMd !== null ||
      filters.thepPc ||
      filters.pcNos !== null ||
      filters.thepDai ||
      filters.donKepFactor !== null ||
      filters.thepBuoc ||
      filters.a1Mm !== null ||
      filters.a2Mm !== null ||
      filters.a3Mm !== null ||
      filters.p1Pct !== null ||
      filters.p2Pct !== null ||
      filters.p3Pct !== null ||
      filters.matBich ||
      filters.mangXong ||
      filters.muiCoc ||
      filters.tap
  )

  if (exactTextMatch) return true
  if (hasSpecFilter && exactFieldMatch) return true
  return false
}

function computeNearMatchScore(candidate: TemplateCandidate, filters: PileTemplateLookupFilters) {
  const query = normalizeSearch(filters.query)
  let score = candidate.templateScope === 'FACTORY' ? 0 : 4
  let overlapCount = 0

  if (query) {
    if (normalizeSearch(candidate.loaiCoc) === query || normalizeSearch(candidate.maCoc) === query) {
      overlapCount += 3
    } else if (candidate.normalizedText.includes(query)) {
      score += 8
      overlapCount += 1
    } else {
      score += 40
    }
  }

  if (filters.cuongDo) {
    if (candidate.cuongDo === filters.cuongDo) overlapCount += 2
    else score += 40
  }

  if (filters.macThep) {
    if (candidate.macThep === filters.macThep) overlapCount += 2
    else score += 30
  }

  if (filters.doNgoai !== null) {
    const diff = Math.abs(candidate.doNgoai - filters.doNgoai)
    score += diff
    if (diff === 0) overlapCount += 3
    else if (diff <= 20) overlapCount += 1
  }

  if (filters.chieuDay !== null) {
    const diff = Math.abs(candidate.chieuDay - filters.chieuDay)
    score += diff * 2
    if (diff === 0) overlapCount += 2
    else if (diff <= 10) overlapCount += 1
  }

  if (filters.macBeTong) {
    if (candidate.macBeTong === filters.macBeTong) overlapCount += 1
    else score += 10
  }
  if (filters.kgMd !== null) {
    const diff = Math.abs(round3(candidate.khoiLuongKgMd ?? 0) - round3(filters.kgMd))
    score += diff
    if (diff === 0) overlapCount += 1
  }
  if (filters.thepPc) {
    if (normalizeSearch(candidate.steelLabels.pc).includes(normalizeSearch(filters.thepPc))) overlapCount += 1
    else score += 10
  }
  if (filters.pcNos !== null) {
    const diff = Math.abs(round3(candidate.pcNos ?? 0) - round3(filters.pcNos))
    score += diff * 5
    if (diff === 0) overlapCount += 1
  }
  if (filters.thepDai) {
    if (normalizeSearch(candidate.steelLabels.dai).includes(normalizeSearch(filters.thepDai))) overlapCount += 1
    else score += 10
  }
  if (filters.donKepFactor !== null) {
    const diff = Math.abs(round3(candidate.donKepFactor ?? 0) - round3(filters.donKepFactor))
    score += diff * 10
    if (diff === 0) overlapCount += 1
  }
  if (filters.thepBuoc) {
    if (normalizeSearch(candidate.steelLabels.buoc).includes(normalizeSearch(filters.thepBuoc))) overlapCount += 1
    else score += 10
  }
  if (filters.a1Mm !== null) {
    const diff = Math.abs(round3(candidate.a1Mm ?? 0) - round3(filters.a1Mm))
    score += diff
    if (diff === 0) overlapCount += 1
  }
  if (filters.a2Mm !== null) {
    const diff = Math.abs(round3(candidate.a2Mm ?? 0) - round3(filters.a2Mm))
    score += diff
    if (diff === 0) overlapCount += 1
  }
  if (filters.a3Mm !== null) {
    const diff = Math.abs(round3(candidate.a3Mm ?? 0) - round3(filters.a3Mm))
    score += diff
    if (diff === 0) overlapCount += 1
  }
  if (filters.p1Pct !== null) {
    const diff = Math.abs(round3(candidate.p1Pct ?? 0) - round3(filters.p1Pct))
    score += diff * 100
    if (diff === 0) overlapCount += 1
  }
  if (filters.p2Pct !== null) {
    const diff = Math.abs(round3(candidate.p2Pct ?? 0) - round3(filters.p2Pct))
    score += diff * 100
    if (diff === 0) overlapCount += 1
  }
  if (filters.p3Pct !== null) {
    const diff = Math.abs(round3(candidate.p3Pct ?? 0) - round3(filters.p3Pct))
    score += diff * 100
    if (diff === 0) overlapCount += 1
  }

  if (filters.matBich) {
    if (normalizeSearch(candidate.accessoryLabels.matBich).includes(normalizeSearch(filters.matBich))) overlapCount += 1
    else score += 10
  }

  if (filters.mangXong) {
    if (normalizeSearch(candidate.accessoryLabels.mangXong).includes(normalizeSearch(filters.mangXong))) overlapCount += 1
    else score += 10
  }

  if (filters.muiCoc) {
    if (normalizeSearch(candidate.accessoryLabels.muiCoc).includes(normalizeSearch(filters.muiCoc))) overlapCount += 1
    else score += 10
  }

  if (filters.tap) {
    if (normalizeSearch(candidate.accessoryLabels.tap).includes(normalizeSearch(filters.tap))) overlapCount += 1
    else score += 10
  }

  return { score, overlapCount }
}

function buildRetailPoolByBucket(
  currentRows: Awaited<ReturnType<typeof loadFinishedGoodsCurrentInventoryRows>>
) {
  const bucket = new Map<string, number>()
  for (const row of currentRows) {
    if (!row.visibleInRetail) continue
    bucket.set(row.itemKey, (bucket.get(row.itemKey) ?? 0) + 1)
  }
  return bucket
}

function compareRows(left: PileTemplateLookupRow, right: PileTemplateLookupRow) {
  if (left.score !== right.score) return left.score - right.score
  if (left.sourceLabel !== right.sourceLabel) return left.sourceLabel.localeCompare(right.sourceLabel)
  return left.loaiCoc.localeCompare(right.loaiCoc)
}

export async function loadPileTemplateLookupPageData(
  supabase: SupabaseClient,
  rawFilters: LookupSearchParams
): Promise<PileTemplateLookupPageData> {
  const filters = loadFilters(rawFilters)
  const hasQuery = hasLookupQuery(filters)

  if (!hasQuery) {
    return {
      filters,
      hasQuery: false,
      exactMatches: [],
      nearMatches: [],
    }
  }

  const [{ data: templateRows, error: templateError }, { data: nvlRows, error: nvlError }, currentRows, physicalPool, projectPool] =
    await Promise.all([
      supabase
        .from('dm_coc_template')
        .select('*')
        .eq('is_active', true)
        .limit(500),
      supabase.from('nvl').select('nvl_id, ten_hang').eq('is_active', true).limit(800),
      loadFinishedGoodsCurrentInventoryRows(supabase),
      loadFinishedGoodsPhysicalPoolByBucket(supabase),
      loadFinishedGoodsProjectPoolByBucket(supabase),
    ])

  if (templateError) throw templateError
  if (nvlError) throw nvlError

  const retailPool = buildRetailPoolByBucket(currentRows)
  const nvlMap = new Map((nvlRows ?? []).map((row) => [String(row.nvl_id ?? ''), normalizeText(row.ten_hang)]))
  const templates = (templateRows ?? [])
    .map((row) => mapTemplateRow(row as RawTemplateRow, nvlMap))
    .filter((row) => row.loaiCoc)
  const exactIds = new Set<string>()

  const exactMatches = templates
    .filter((candidate) => {
      const matched = isExactMatch(candidate, filters)
      if (matched) exactIds.add(candidate.templateId)
      return matched
    })
    .map<PileTemplateLookupRow>((candidate) => ({
      ...candidate,
      stockAtRequestedLength: buildStockSnapshot(candidate.loaiCoc, filters.chieuDaiM, physicalPool, projectPool, retailPool),
      differenceLabels: buildDifferenceLabels(candidate, filters),
      score: 0,
    }))
    .sort(compareRows)

  const nearMatches = templates
    .filter((candidate) => !exactIds.has(candidate.templateId))
    .map((candidate) => {
      const { score, overlapCount } = computeNearMatchScore(candidate, filters)
      return {
        ...candidate,
        stockAtRequestedLength: buildStockSnapshot(candidate.loaiCoc, filters.chieuDaiM, physicalPool, projectPool, retailPool),
        differenceLabels: buildDifferenceLabels(candidate, filters),
        score,
        overlapCount,
      }
    })
    .filter((candidate) => candidate.overlapCount > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score
      if (left.overlapCount !== right.overlapCount) return right.overlapCount - left.overlapCount
      return left.loaiCoc.localeCompare(right.loaiCoc)
    })
    .slice(0, 6)
    .map<PileTemplateLookupRow>((candidate) => {
      const { overlapCount, ...rest } = candidate
      void overlapCount
      return rest
    })

  return {
    filters,
    hasQuery: true,
    exactMatches,
    nearMatches,
  }
}
