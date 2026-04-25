'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import type { RowData } from '@/lib/master-data/crud-utils'
import { pickKeyField } from '@/lib/master-data/crud-utils'
import { softDeleteRowWithFallback } from '@/lib/master-data/mutation-helpers'
import { getTemplateUsageMessage } from '@/lib/master-data/reference-guards'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'

const BASE_PATH = '/master-data/dm-coc-template'
const TEMPLATE_META_PREFIX = 'ERP_TEMPLATE_META::'

const CANDIDATE_COLUMNS = {
  code: ['ma_coc', 'ma_coc_template'],
  steelGrade: ['mac_thep'],
  cuongDo: ['cuong_do'],
  pcNvlId: ['pc_nvl_id', 'thep_pc_nvl_id'],
  daiNvlId: ['dai_nvl_id', 'thep_dai_nvl_id'],
  buocNvlId: ['buoc_nvl_id', 'thep_buoc_nvl_id'],
  matBichNvlId: ['mat_bich_nvl_id'],
  mangXongNvlId: ['mang_xong_nvl_id'],
  tapNvlId: ['tap_nvl_id', 'tap_vuong_nvl_id'],
  muiCocNvlId: ['mui_coc_nvl_id'],
  pcLabel: ['thep_pc', 'pc_label'],
  daiLabel: ['thep_dai', 'dai_label'],
  buocLabel: ['thep_buoc', 'buoc_label'],
  matBichLabel: ['mat_bich', 'mat_bich_label'],
  mangXongLabel: ['mang_xong', 'mang_xong_label'],
  tapLabel: ['tap_vuong', 'tap_label'],
  muiCocLabel: ['mui_coc', 'mui_coc_label'],
  kgMd: ['khoi_luong_kg_md', 'kg_md', 'trong_luong_kg_md'],
} as const

function normalizeTemplateScope(value: unknown): 'FACTORY' | 'CUSTOM' {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized === 'CUSTOM' ? 'CUSTOM' : 'FACTORY'
}

function redirectWithError(message: string) {
  redirect(`${BASE_PATH}?err=${encodeURIComponent(message)}`)
}

function redirectWithMessage(message: string) {
  redirect(`${BASE_PATH}?msg=${encodeURIComponent(message)}`)
}

function parseNumber(input: FormDataEntryValue | null) {
  const raw = String(input ?? '').trim()
  if (!raw) return 0
  const normalized = raw.replace(/[,%\s]/g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function getOptionalString(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? '').trim()
  return value || null
}

function parseDiameter(label: string) {
  const match = String(label).match(/(\d+(?:[.,]\d+)?)(?!.*\d)/)
  if (!match) return 0
  return Number(String(match[1]).replace(',', '.')) || 0
}

function parseUnknownColumn(message: string) {
  const relationMatch = message.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation .* does not exist/i)
  if (relationMatch?.[1]) return relationMatch[1]
  const schemaCacheMatch = message.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column of ['"][a-zA-Z0-9_]+['"] in the schema cache/i)
  return schemaCacheMatch?.[1] ?? ''
}

function hasInput(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim() !== ''
}

function isTemplateDuplicateKeyError(message: string) {
  return message.includes('dm_coc_template_loai_coc_do_ngoai_chieu_day_key')
}

function duplicateTemplateSchemaMessage() {
  return 'Database đang khóa trùng theo loại cọc/cường độ/đường kính/thành cọc. Cần chạy SQL bỏ khóa cũ để cho phép nhiều mã cọc cùng thông số cơ bản nhưng khác định mức/phụ kiện.'
}

function buildStoredNote(note: string | null, metadata: Record<string, unknown>) {
  return `${TEMPLATE_META_PREFIX}${JSON.stringify({
    ...metadata,
    note: note ?? '',
  })}`
}

function readTemplateMetadata(row: RowData) {
  const raw = String(row.ghi_chu ?? '').trim()
  if (!raw.startsWith(TEMPLATE_META_PREFIX)) return {} as Record<string, unknown>
  try {
    return JSON.parse(raw.slice(TEMPLATE_META_PREFIX.length)) as Record<string, unknown>
  } catch {
    return {} as Record<string, unknown>
  }
}

function readTemplateNote(row: RowData) {
  const metadata = readTemplateMetadata(row)
  const note = String(metadata.note ?? '').trim()
  if (note) return note
  const raw = String(row.ghi_chu ?? '').trim()
  return raw.startsWith(TEMPLATE_META_PREFIX) ? '' : raw
}

async function executeInsertWithFallback(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClientAndUser>>['supabase'],
  payload: Record<string, unknown>
) {
  const working = { ...payload }

  while (true) {
    const attempt = await supabase.from('dm_coc_template').insert(working)
    if (!attempt.error) return attempt

    if (attempt.error.message.includes(`'created_by'`)) {
      delete working.created_by
      continue
    }

    const missingColumn = parseUnknownColumn(attempt.error.message)
    if (missingColumn && missingColumn in working) {
      delete working[missingColumn]
      continue
    }

    return attempt
  }
}

async function executeUpdateWithFallback(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClientAndUser>>['supabase'],
  keyField: string,
  keyValue: unknown,
  payload: Record<string, unknown>
) {
  const working = { ...payload }

  while (true) {
    const attempt = await supabase.from('dm_coc_template').update(working).eq(keyField, keyValue)
    if (!attempt.error) return attempt

    if (attempt.error.message.includes(`'updated_by'`)) {
      delete working.updated_by
      continue
    }

    const missingColumn = parseUnknownColumn(attempt.error.message)
    if (missingColumn && missingColumn in working) {
      delete working[missingColumn]
      continue
    }

    return attempt
  }
}

async function loadTemplateRows() {
  const { supabase } = await getAuthenticatedClientAndUser()
  const { data, error } = await supabase.from('dm_coc_template').select('*').limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []) as RowData[]
}

function normalizeCuongDo(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized.startsWith('PHC')) return 'PHC'
  if (normalized.startsWith('PC')) return 'PC'
  return normalized
}

function normalizeSteelGrade(value: unknown) {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (['A', 'B', 'C'].includes(normalized)) return normalized
  return normalized
}

function buildLoaiCoc(cuongDo: string, steelGrade: string, doNgoai: number, chieuDay: number) {
  return `${cuongDo} - ${steelGrade}${doNgoai} - ${chieuDay}`
}

function buildCodePrefix(macBeTong: string, steelGrade: string, doNgoai: number, chieuDay: number) {
  return `M${macBeTong} - ${steelGrade}${doNgoai} - ${chieuDay}`
}

function extractSteelGrade(row: RowData) {
  const explicit = normalizeSteelGrade(row.mac_thep)
  if (explicit) return explicit
  const loaiCoc = String(row.loai_coc ?? '').trim().toUpperCase()
  const match = loaiCoc.match(/-\s*([ABC])\d+/)
  return match?.[1] ?? ''
}

function readTemplateCode(row: RowData) {
  for (const field of CANDIDATE_COLUMNS.code) {
    const value = String(row[field] ?? '').trim()
    if (value) return value
  }
  return ''
}

function buildTemplateCodeMap(rows: RowData[], keyField: string | null) {
  const sorted = [...rows].sort((a, b) => {
    const aTime = new Date(String(a.created_at ?? a.updated_at ?? '')).getTime() || 0
    const bTime = new Date(String(b.created_at ?? b.updated_at ?? '')).getTime() || 0
    if (aTime !== bTime) return aTime - bTime
    return String(a[keyField ?? 'template_id'] ?? '').localeCompare(String(b[keyField ?? 'template_id'] ?? ''))
  })
  const prefixCount = new Map<string, number>()
  const codeMap = new Map<string, string>()

  for (const row of sorted) {
    const macBeTong = String(row.mac_be_tong ?? '').trim()
    const doNgoai = Number(row.do_ngoai ?? 0)
    const chieuDay = Number(row.chieu_day ?? 0)
    const steelGrade = extractSteelGrade(row)
    if (!macBeTong || !doNgoai || !chieuDay || !steelGrade) continue
    const prefix = buildCodePrefix(macBeTong, steelGrade, doNgoai, chieuDay)
    const next = (prefixCount.get(prefix) ?? 0) + 1
    prefixCount.set(prefix, next)
    const rowKey = String(row[keyField ?? 'template_id'] ?? '')
    if (rowKey) codeMap.set(rowKey, readTemplateCode(row) || `${prefix} - ${next}`)
  }

  return codeMap
}

async function loadSelectedNvlMap(ids: string[]) {
  const { supabase } = await getAuthenticatedClientAndUser()
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map<string, RowData>()
  const { data, error } = await supabase.from('nvl').select('nvl_id, ten_hang').in('nvl_id', uniqueIds)
  if (error) throw new Error(error.message)
  return new Map(((data ?? []) as RowData[]).map((row) => [String(row.nvl_id ?? ''), row]))
}

async function buildTemplatePayload(formData: FormData, userId: string, isUpdate: boolean) {
  const cuongDo = normalizeCuongDo(formData.get('cuong_do'))
  const steelGrade = normalizeSteelGrade(formData.get('mac_thep'))
  const doNgoai = parseNumber(formData.get('do_ngoai'))
  const chieuDay = parseNumber(formData.get('chieu_day'))
  const macBeTong = String(formData.get('mac_be_tong') ?? '').trim()
  const pcNos = parseNumber(formData.get('pc_nos'))
  const donKepFactor = parseNumber(formData.get('don_kep_factor'))
  const a1 = parseNumber(formData.get('a1_mm'))
  const a2 = parseNumber(formData.get('a2_mm'))
  const a3 = parseNumber(formData.get('a3_mm'))
  const p1 = parseNumber(formData.get('p1_pct'))
  const p2 = parseNumber(formData.get('p2_pct'))
  const p3 = parseNumber(formData.get('p3_pct'))
  const kgMd = parseNumber(formData.get('khoi_luong_kg_md'))
  const templateScope = normalizeTemplateScope(formData.get('template_scope'))

  const pcNvlId = String(formData.get('pc_nvl_id') ?? '').trim()
  const daiNvlId = String(formData.get('dai_nvl_id') ?? '').trim()
  const buocNvlId = String(formData.get('buoc_nvl_id') ?? '').trim()
  const matBichNvlId = String(formData.get('mat_bich_nvl_id') ?? '').trim()
  const mangXongNvlId = String(formData.get('mang_xong_nvl_id') ?? '').trim()
  const tapNvlId = String(formData.get('tap_nvl_id') ?? '').trim()
  const muiCocNvlId = String(formData.get('mui_coc_nvl_id') ?? '').trim()

  if (!cuongDo) redirectWithError('Cần chọn cường độ.')
  if (!steelGrade) redirectWithError('Cần chọn mác thép.')
  if (!doNgoai) redirectWithError('Cần nhập đường kính ngoài.')
  if (!chieuDay) redirectWithError('Cần nhập thành cọc.')
  if (!macBeTong) redirectWithError('Cần chọn mác bê tông.')
  if (!hasInput(formData, 'pc_nos')) redirectWithError('Cần nhập số thanh PC.')
  if (!hasInput(formData, 'don_kep_factor')) redirectWithError('Cần chọn đơn/kép.')
  if (!pcNvlId) redirectWithError('Cần chọn thép PC.')
  if (!daiNvlId) redirectWithError('Cần chọn thép đai.')
  if (!buocNvlId) redirectWithError('Cần chọn thép buộc.')
  if (!hasInput(formData, 'a1_mm')) redirectWithError('Cần nhập A1_mm.')
  if (!hasInput(formData, 'a3_mm')) redirectWithError('Cần nhập A3_mm.')
  if (!hasInput(formData, 'p1_pct')) redirectWithError('Cần nhập PctA1.')
  if (!hasInput(formData, 'p3_pct')) redirectWithError('Cần nhập PctA3.')
  if (!matBichNvlId) redirectWithError('Cần chọn mặt bích.')
  if (!mangXongNvlId) redirectWithError('Cần chọn măng xông.')
  if (!tapNvlId) redirectWithError('Cần chọn táp vuông.')
  if (!muiCocNvlId) redirectWithError('Cần chọn mũi cọc.')
  const nvlMap = await loadSelectedNvlMap([
    pcNvlId,
    daiNvlId,
    buocNvlId,
    matBichNvlId,
    mangXongNvlId,
    tapNvlId,
    muiCocNvlId,
  ])

  const pcLabel = String(nvlMap.get(pcNvlId)?.ten_hang ?? '')
  const daiLabel = String(nvlMap.get(daiNvlId)?.ten_hang ?? '')
  const buocLabel = String(nvlMap.get(buocNvlId)?.ten_hang ?? '')
  const matBichLabel = String(nvlMap.get(matBichNvlId)?.ten_hang ?? '')
  const mangXongLabel = String(nvlMap.get(mangXongNvlId)?.ten_hang ?? '')
  const tapLabel = String(nvlMap.get(tapNvlId)?.ten_hang ?? '')
  const muiCocLabel = String(nvlMap.get(muiCocNvlId)?.ten_hang ?? '')
  const loaiCoc = buildLoaiCoc(cuongDo, steelGrade, doNgoai, chieuDay)

  const existingRows = await loadTemplateRows()
  const keyField = pickKeyField('dm_coc_template', existingRows)
  const currentKeyValue = String(formData.get('key_value') ?? '').trim()
  const duplicate = existingRows.find((row) => {
    if (row.is_active === false) return false
    if (currentKeyValue && safeString(row[keyField ?? 'template_id']) === currentKeyValue) return false
    return (
      String(row.loai_coc ?? '').trim() === loaiCoc &&
      String(row.mac_be_tong ?? '').trim() === macBeTong &&
      Number(row.do_ngoai ?? 0) === doNgoai &&
      Number(row.chieu_day ?? 0) === chieuDay &&
      Number(row.pc_nos ?? 0) === pcNos &&
      Number(row.a1_mm ?? 0) === a1 &&
      Number(row.a2_mm ?? 0) === a2 &&
      Number(row.a3_mm ?? 0) === a3 &&
      Number(row.p1_pct ?? 0) === p1 &&
      Number(row.p2_pct ?? 0) === p2 &&
      Number(row.p3_pct ?? 0) === p3 &&
      Number(row.don_kep_factor ?? 0) === donKepFactor &&
      readCandidateValue(row, CANDIDATE_COLUMNS.pcNvlId) === pcNvlId &&
      readCandidateValue(row, CANDIDATE_COLUMNS.daiNvlId) === daiNvlId &&
      readCandidateValue(row, CANDIDATE_COLUMNS.buocNvlId) === buocNvlId &&
      readCandidateValue(row, CANDIDATE_COLUMNS.matBichNvlId) === matBichNvlId &&
      readCandidateValue(row, CANDIDATE_COLUMNS.mangXongNvlId) === mangXongNvlId &&
      readCandidateValue(row, CANDIDATE_COLUMNS.tapNvlId) === tapNvlId &&
      readCandidateValue(row, CANDIDATE_COLUMNS.muiCocNvlId) === muiCocNvlId
    )
  })

  if (duplicate) {
    const codeMap = buildTemplateCodeMap(existingRows, keyField)
    const duplicateKey = safeString(duplicate[keyField ?? 'template_id'])
    const existingCode = codeMap.get(duplicateKey) ?? readTemplateCode(duplicate) ?? loaiCoc
    redirectWithError(`Loại cọc này đã tồn tại: ${existingCode}`)
  }

  const codePrefix = buildCodePrefix(macBeTong, steelGrade, doNgoai, chieuDay)
  const siblingCount = existingRows.filter((row) => {
    if (row.is_active === false) return false
    if (currentKeyValue && safeString(row[keyField ?? 'template_id']) === currentKeyValue) return false
    return (
      String(row.mac_be_tong ?? '').trim() === macBeTong &&
      Number(row.do_ngoai ?? 0) === doNgoai &&
      Number(row.chieu_day ?? 0) === chieuDay &&
      extractSteelGrade(row) === steelGrade
    )
  }).length
  const maCoc = `${codePrefix} - ${siblingCount + 1}`

  const payload: Record<string, unknown> = {
    loai_coc: loaiCoc,
    cuong_do: cuongDo,
    mac_thep: steelGrade,
    do_ngoai: doNgoai,
    chieu_day: chieuDay,
    mac_be_tong: macBeTong,
    pc_dia_mm: parseDiameter(pcLabel),
    pc_nos: pcNos || null,
    dai_dia_mm: parseDiameter(daiLabel),
    buoc_dia_mm: parseDiameter(buocLabel),
    a1_mm: a1 || null,
    a2_mm: a2 || null,
    a3_mm: a3 || null,
    p1_pct: p1 || null,
    p2_pct: p2 || null,
    p3_pct: p3 || null,
    don_kep_factor: donKepFactor || null,
    is_active: true,
    deleted_at: null,
    [isUpdate ? 'updated_by' : 'created_by']: userId,
  }

  for (const field of CANDIDATE_COLUMNS.code) payload[field] = maCoc
  for (const field of CANDIDATE_COLUMNS.cuongDo) payload[field] = cuongDo
  for (const field of CANDIDATE_COLUMNS.steelGrade) payload[field] = steelGrade

  for (const field of CANDIDATE_COLUMNS.pcNvlId) payload[field] = pcNvlId || null
  for (const field of CANDIDATE_COLUMNS.daiNvlId) payload[field] = daiNvlId || null
  for (const field of CANDIDATE_COLUMNS.buocNvlId) payload[field] = buocNvlId || null
  for (const field of CANDIDATE_COLUMNS.matBichNvlId) payload[field] = matBichNvlId || null
  for (const field of CANDIDATE_COLUMNS.mangXongNvlId) payload[field] = mangXongNvlId || null
  for (const field of CANDIDATE_COLUMNS.tapNvlId) payload[field] = tapNvlId || null
  for (const field of CANDIDATE_COLUMNS.muiCocNvlId) payload[field] = muiCocNvlId || null
  for (const field of CANDIDATE_COLUMNS.pcLabel) payload[field] = pcLabel || null
  for (const field of CANDIDATE_COLUMNS.daiLabel) payload[field] = daiLabel || null
  for (const field of CANDIDATE_COLUMNS.buocLabel) payload[field] = buocLabel || null
  for (const field of CANDIDATE_COLUMNS.matBichLabel) payload[field] = matBichLabel || null
  for (const field of CANDIDATE_COLUMNS.mangXongLabel) payload[field] = mangXongLabel || null
  for (const field of CANDIDATE_COLUMNS.tapLabel) payload[field] = tapLabel || null
  for (const field of CANDIDATE_COLUMNS.muiCocLabel) payload[field] = muiCocLabel || null
  for (const field of CANDIDATE_COLUMNS.kgMd) payload[field] = kgMd || null

  const dtam = parseNumber(formData.get('dtam_mm'))
  if (dtam) payload.dtam_mm = dtam
  const note = getOptionalString(formData, 'ghi_chu')
  payload.ghi_chu = buildStoredNote(note, {
    template_scope: templateScope,
    cuong_do: cuongDo,
    mac_thep: steelGrade,
    do_ngoai: doNgoai,
    chieu_day: chieuDay,
    mac_be_tong: macBeTong,
    pc_nos: pcNos,
    don_kep_factor: donKepFactor,
    a1_mm: a1,
    a2_mm: a2,
    a3_mm: a3,
    p1_pct: p1,
    p2_pct: p2,
    p3_pct: p3,
    khoi_luong_kg_md: kgMd,
    pc_nvl_id: pcNvlId,
    dai_nvl_id: daiNvlId,
    buoc_nvl_id: buocNvlId,
    mat_bich_nvl_id: matBichNvlId,
    mang_xong_nvl_id: mangXongNvlId,
    tap_nvl_id: tapNvlId,
    mui_coc_nvl_id: muiCocNvlId,
    pc_label: pcLabel,
    dai_label: daiLabel,
    buoc_label: buocLabel,
    mat_bich_label: matBichLabel,
    mang_xong_label: mangXongLabel,
    tap_label: tapLabel,
    mui_coc_label: muiCocLabel,
  })

  payload.template_scope = templateScope

  return payload
}

export async function createDmCocTemplateAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_coc_template')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const payload = await buildTemplatePayload(formData, user.id, false)
  const result = await executeInsertWithFallback(supabase, payload)
  if (result.error) {
    if (isTemplateDuplicateKeyError(result.error.message)) {
      redirectWithError(duplicateTemplateSchemaMessage())
    }
    redirectWithError(result.error.message)
  }
  redirectWithMessage('Tạo loại cọc mẫu thành công')
}

export async function updateDmCocTemplateAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_coc_template')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const rows = await loadTemplateRows()
  const keyField = pickKeyField('dm_coc_template', rows)
  if (!keyField) redirectWithError('Không xác định được khóa loại cọc mẫu.')

  const keyValueRaw = String(formData.get('key_value') ?? 'null')
  let keyValue: unknown
  try {
    keyValue = JSON.parse(keyValueRaw) as unknown
  } catch {
    redirectWithError('Khóa loại cọc mẫu không hợp lệ.')
  }

  const currentRow = rows.find((row) => safeString(row[keyField ?? 'template_id']) === JSON.stringify(keyValue))
  if (!currentRow) {
    redirectWithError('Không tìm thấy loại cọc mẫu cần sửa.')
  }
  const resolvedCurrentRow = currentRow as RowData

  const usageMessage = await getTemplateUsageMessage(supabase as never, {
    loai_coc: resolvedCurrentRow.loai_coc,
    mac_be_tong: resolvedCurrentRow.mac_be_tong,
    do_ngoai: resolvedCurrentRow.do_ngoai,
    chieu_day: resolvedCurrentRow.chieu_day,
  })
  if (usageMessage) {
    redirectWithError(usageMessage)
  }

  const payload = await buildTemplatePayload(formData, user.id, true)
  delete payload.is_active
  delete payload.deleted_at

  const result = await executeUpdateWithFallback(supabase, keyField as string, keyValue, payload)
  if (result.error) {
    if (isTemplateDuplicateKeyError(result.error.message)) {
      redirectWithError(duplicateTemplateSchemaMessage())
    }
    redirectWithError(result.error.message)
  }
  redirectWithMessage('Cập nhật loại cọc mẫu thành công')
}

export async function updateDmCocTemplateSourceAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_coc_template')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const rows = await loadTemplateRows()
  const keyField = pickKeyField('dm_coc_template', rows)
  if (!keyField) redirectWithError('Không xác định được khóa loại cọc mẫu.')

  const keyValueRaw = String(formData.get('key_value') ?? 'null')
  let keyValue: unknown
  try {
    keyValue = JSON.parse(keyValueRaw) as unknown
  } catch {
    redirectWithError('Khóa loại cọc mẫu không hợp lệ.')
  }

  const currentRow = rows.find((row) => safeString(row[keyField ?? 'template_id']) === JSON.stringify(keyValue))
  if (!currentRow) {
    redirectWithError('Không tìm thấy loại cọc mẫu cần cập nhật nguồn.')
  }
  const resolvedCurrentRow = currentRow as RowData
  const metadata = readTemplateMetadata(resolvedCurrentRow)
  const nextScope = normalizeTemplateScope(formData.get('template_scope'))
  const note = readTemplateNote(resolvedCurrentRow)
  const nextPayload: Record<string, unknown> = {
    template_scope: nextScope,
    ghi_chu: buildStoredNote(note, {
      ...metadata,
      template_scope: nextScope,
    }),
    updated_by: user.id,
  }

  const result = await executeUpdateWithFallback(supabase, keyField as string, keyValue, nextPayload)
  if (result.error) {
    redirectWithError(result.error.message)
  }

  redirectWithMessage('Cập nhật nguồn mẫu thành công')
}

export async function deleteDmCocTemplateAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_coc_template')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const rows = await loadTemplateRows()
  const keyField = pickKeyField('dm_coc_template', rows)
  if (!keyField) redirectWithError('Không xác định được khóa loại cọc mẫu.')

  const keyValueRaw = String(formData.get('key_value') ?? 'null')
  let keyValue: unknown
  try {
    keyValue = JSON.parse(keyValueRaw) as unknown
  } catch {
    redirectWithError('Khóa loại cọc mẫu không hợp lệ.')
  }

  const currentRow = rows.find((row) => safeString(row[keyField ?? 'template_id']) === JSON.stringify(keyValue))
  if (!currentRow) {
    redirectWithError('Không tìm thấy loại cọc mẫu cần xóa.')
  }
  const resolvedCurrentRow = currentRow as RowData

  const usageMessage = await getTemplateUsageMessage(supabase as never, {
    loai_coc: resolvedCurrentRow.loai_coc,
    mac_be_tong: resolvedCurrentRow.mac_be_tong,
    do_ngoai: resolvedCurrentRow.do_ngoai,
    chieu_day: resolvedCurrentRow.chieu_day,
  })
  if (usageMessage) {
    redirectWithError(usageMessage)
  }

  const result = await softDeleteRowWithFallback(supabase as never, {
    tableName: 'dm_coc_template',
    keyField: keyField as string,
    keyValue,
    userId: user.id,
  })

  if (result.error) {
    redirectWithError(result.error.message)
  }

  redirectWithMessage('Xóa loại cọc mẫu thành công')
}

export async function bulkDeleteDmCocTemplateAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_coc_template')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const rows = await loadTemplateRows()
  const keyField = pickKeyField('dm_coc_template', rows)
  if (!keyField) redirectWithError('Không xác định được khóa loại cọc mẫu.')

  const keyValueRawList = formData
    .getAll('key_value')
    .map((value) => String(value ?? 'null'))
    .filter(Boolean)

  if (keyValueRawList.length === 0) redirectWithError('Chưa chọn loại cọc mẫu để xóa.')

  for (const keyValueRaw of keyValueRawList) {
    let keyValue: unknown
    try {
      keyValue = JSON.parse(keyValueRaw) as unknown
    } catch {
      redirectWithError('Khóa loại cọc mẫu không hợp lệ.')
    }

    const currentRow = rows.find((row) => safeString(row[keyField ?? 'template_id']) === JSON.stringify(keyValue))
    if (!currentRow) {
      redirectWithError('Không tìm thấy loại cọc mẫu cần xóa.')
    }
    const resolvedCurrentRow = currentRow as RowData

    const usageMessage = await getTemplateUsageMessage(supabase as never, {
      loai_coc: resolvedCurrentRow.loai_coc,
      mac_be_tong: resolvedCurrentRow.mac_be_tong,
      do_ngoai: resolvedCurrentRow.do_ngoai,
      chieu_day: resolvedCurrentRow.chieu_day,
    })
    if (usageMessage) {
      redirectWithError(usageMessage)
    }

    const result = await softDeleteRowWithFallback(supabase as never, {
      tableName: 'dm_coc_template',
      keyField: keyField as string,
      keyValue,
      userId: user.id,
    })

    if (result.error) {
      redirectWithError(result.error.message)
    }
  }

  redirectWithMessage(`Đã xóa ${keyValueRawList.length} loại cọc mẫu.`)
}

function readCandidateValue(row: RowData, fields: readonly string[]) {
  for (const field of fields) {
    const value = String(row[field] ?? '').trim()
    if (value) return value
  }
  return ''
}

function safeString(value: unknown) {
  return JSON.stringify(value ?? null)
}
