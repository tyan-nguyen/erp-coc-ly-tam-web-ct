'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import type { RowData } from '@/lib/master-data/crud-utils'
import { softDeleteRowWithFallback, updateRowWithFallback } from '@/lib/master-data/mutation-helpers'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'

const BASE_PATH = '/master-data/dm-capphoi-bt'

function redirectWithError(message: string) {
  redirect(`${BASE_PATH}?err=${encodeURIComponent(message)}`)
}

function redirectWithMessage(message: string) {
  redirect(`${BASE_PATH}?msg=${encodeURIComponent(message)}`)
}

function parseUnknownColumn(message: string) {
  const relationMatch = message.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation .* does not exist/i)
  if (relationMatch?.[1]) return relationMatch[1]
  const schemaCacheMatch = message.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column of ['"][a-zA-Z0-9_]+['"] in the schema cache/i)
  return schemaCacheMatch?.[1] ?? ''
}

function parseVariant(row: RowData) {
  const direct = String(row.variant ?? row.cap_phoi_variant ?? row.loai_cap_phoi ?? '').trim()
  if (direct) return direct
  const ghiChu = String(row.ghi_chu ?? '').trim()
  const match = ghiChu.match(/variant\s*:\s*([A-Z0-9_ -]+)/i)
  return match?.[1]?.trim() || 'FULL_XI_TRO_XI'
}

function isLegacyConcreteVariantConstraint(message: string) {
  return message.includes('dm_capphoi_bt_mac_be_tong_nvl_id_key')
}

async function executeInsertWithFallback(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClientAndUser>>['supabase'],
  payload: Record<string, unknown>
) {
  const working = { ...payload }

  while (true) {
    const attempt = await supabase.from('dm_capphoi_bt').insert(working)
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

export async function createDmCapPhoiBtAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_capphoi_bt')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const variant = String(formData.get('variant') ?? '').trim().toUpperCase()
  const macBeTong = String(formData.get('mac_be_tong') ?? '').trim()
  const payloadRaw = String(formData.get('items_json') ?? '[]')

  if (!variant) redirectWithError('Cần chọn variant cấp phối.')
  if (!macBeTong) redirectWithError('Cần nhập mác bê tông.')

  let items: Array<{ nvl_id: string; dvt: string; dinh_muc_m3: number }> = []
  try {
    items = JSON.parse(payloadRaw) as Array<{ nvl_id: string; dvt: string; dinh_muc_m3: number }>
  } catch {
    redirectWithError('Dữ liệu cấp phối không hợp lệ.')
  }

  const normalizedItems = items
    .map((item) => ({
      nvl_id: String(item.nvl_id ?? '').trim(),
      dvt: String(item.dvt ?? '').trim(),
      dinh_muc_m3: Number(item.dinh_muc_m3 ?? 0),
    }))
    .filter((item) => item.nvl_id && item.dvt && Number.isFinite(item.dinh_muc_m3) && item.dinh_muc_m3 > 0)

  if (normalizedItems.length === 0) {
    redirectWithError('Cần thêm ít nhất 1 NVL cấp phối hợp lệ.')
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('dm_capphoi_bt')
    .select('*')
    .eq('is_active', true)
    .eq('mac_be_tong', macBeTong)

  if (existingError) redirectWithError(existingError.message)

  const existing = (existingRows ?? []) as RowData[]

  for (const item of normalizedItems) {
    const duplicate = existing.find(
      (row) =>
        String(row.nvl_id ?? '').trim() === item.nvl_id &&
        parseVariant(row).toUpperCase() === variant &&
        row.is_active !== false
    )

    if (duplicate) {
      redirectWithError('NVL này đã tồn tại trong đúng variant và mác bê tông đã chọn.')
    }
  }

  for (const item of normalizedItems) {
    const payload: Record<string, unknown> = {
      nvl_id: item.nvl_id,
      mac_be_tong: macBeTong,
      dvt: item.dvt,
      dinh_muc_m3: item.dinh_muc_m3,
      variant,
      ghi_chu: `VARIANT:${variant}`,
      is_active: true,
      deleted_at: null,
      created_by: user.id,
    }

    const result = await executeInsertWithFallback(supabase, payload)
    if (result.error) {
      if (isLegacyConcreteVariantConstraint(result.error.message)) {
        redirectWithError(
          'DB vẫn đang khóa theo Mác + NVL nên chỉ lưu được một phần bộ cấp phối. Cần chạy file sql/dm_capphoi_bt_variant_unique_patch.sql rồi tạo lại bộ cấp phối.'
        )
      }
      redirectWithError(result.error.message)
    }
  }

  redirectWithMessage('Tạo cấp phối bê tông thành công')
}

export async function updateDmCapPhoiBtAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_capphoi_bt')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const currentVariant = String(formData.get('current_variant') ?? '').trim().toUpperCase()
  const currentMac = String(formData.get('current_mac_be_tong') ?? '').trim()
  const variant = String(formData.get('variant') ?? '').trim().toUpperCase()
  const macBeTong = String(formData.get('mac_be_tong') ?? '').trim()
  const payloadRaw = String(formData.get('items_json') ?? '[]')

  if (!currentVariant || !currentMac) redirectWithError('Thiếu bộ cấp phối hiện hành cần cập nhật.')
  if (!variant) redirectWithError('Cần chọn variant cấp phối.')
  if (!macBeTong) redirectWithError('Cần nhập mác bê tông.')

  let items: Array<{ id?: string; nvl_id: string; dvt: string; dinh_muc_m3: number }> = []
  try {
    items = JSON.parse(payloadRaw) as Array<{ id?: string; nvl_id: string; dvt: string; dinh_muc_m3: number }>
  } catch {
    redirectWithError('Dữ liệu cấp phối không hợp lệ.')
  }

  const normalizedItems = items
    .map((item) => ({
      id: String(item.id ?? '').trim(),
      nvl_id: String(item.nvl_id ?? '').trim(),
      dvt: String(item.dvt ?? '').trim(),
      dinh_muc_m3: Number(item.dinh_muc_m3 ?? 0),
    }))
    .filter((item) => item.nvl_id && item.dvt && Number.isFinite(item.dinh_muc_m3) && item.dinh_muc_m3 > 0)

  if (normalizedItems.length === 0) {
    redirectWithError('Cần thêm ít nhất 1 NVL cấp phối hợp lệ.')
  }

  const duplicateIds = new Set<string>()
  for (const item of normalizedItems) {
    if (duplicateIds.has(item.nvl_id)) {
      redirectWithError('Một NVL chỉ được xuất hiện 1 lần trong cùng bộ cấp phối.')
    }
    duplicateIds.add(item.nvl_id)
  }

  const { data: activeRows, error: activeError } = await supabase
    .from('dm_capphoi_bt')
    .select('*')
    .eq('is_active', true)
    .limit(1000)

  if (activeError) redirectWithError(activeError.message)

  const rows = (activeRows ?? []) as RowData[]
  const currentRows = rows.filter(
    (row) => String(row.mac_be_tong ?? '').trim() === currentMac && parseVariant(row) === currentVariant
  )
  const currentRowIds = new Set(currentRows.map((row) => String(row.cp_id ?? row.id ?? '')))
  const otherRowsSameMac = rows.filter(
    (row) =>
      String(row.mac_be_tong ?? '').trim() === macBeTong &&
      parseVariant(row).toUpperCase() === variant &&
      !currentRowIds.has(String(row.cp_id ?? row.id ?? ''))
  )

  for (const item of normalizedItems) {
    const conflict = otherRowsSameMac.find((row) => String(row.nvl_id ?? '').trim() === item.nvl_id)
    if (conflict) {
      redirectWithError('NVL này đã tồn tại trong đúng variant và mác bê tông đã chọn.')
    }
  }

  const currentRowsMap = new Map(
    currentRows.map((row) => [String(row.cp_id ?? row.id ?? ''), row])
  )
  const submittedIds = new Set(normalizedItems.map((item) => item.id).filter(Boolean))

  for (const row of currentRows) {
    const rowId = String(row.cp_id ?? row.id ?? '')
    if (!submittedIds.has(rowId)) {
      const removeResult = await softDeleteRowWithFallback(supabase as never, {
        tableName: 'dm_capphoi_bt',
        keyField: 'cp_id',
        keyValue: row.cp_id ?? row.id,
        userId: user.id,
      })
      if (removeResult.error) redirectWithError(removeResult.error.message)
    }
  }

  for (const item of normalizedItems) {
    const payload = {
      nvl_id: item.nvl_id,
      mac_be_tong: macBeTong,
      dvt: item.dvt,
      dinh_muc_m3: item.dinh_muc_m3,
      variant,
      ghi_chu: `VARIANT:${variant}`,
      updated_by: user.id,
    }

    if (item.id && currentRowsMap.has(item.id)) {
      const updateResult = await updateRowWithFallback(supabase as never, 'dm_capphoi_bt', 'cp_id', item.id, payload)
      if (updateResult.error) redirectWithError(updateResult.error.message)
      continue
    }

    const insertResult = await executeInsertWithFallback(supabase, {
      ...payload,
      is_active: true,
      deleted_at: null,
      created_by: user.id,
    })
    if (insertResult.error) {
      if (isLegacyConcreteVariantConstraint(insertResult.error.message)) {
        redirectWithError(
          'DB vẫn đang khóa theo Mác + NVL nên chưa thể lưu nhiều variant cho cùng mác. Cần chạy file sql/dm_capphoi_bt_variant_unique_patch.sql trước.'
        )
      }
      redirectWithError(insertResult.error.message)
    }
  }

  redirectWithMessage('Cập nhật cấp phối bê tông thành công')
}
