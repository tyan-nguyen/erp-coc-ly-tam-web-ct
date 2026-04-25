'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import type { RowData } from '@/lib/master-data/crud-utils'
import { pickKeyField } from '@/lib/master-data/crud-utils'
import { softDeleteRowWithFallback, updateRowWithFallback } from '@/lib/master-data/mutation-helpers'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'

const BASE_PATH = '/master-data/dm-dinh-muc-phu-md'

function redirectWithError(message: string) {
  redirect(`${BASE_PATH}?err=${encodeURIComponent(message)}`)
}

function parseUnknownColumn(message: string) {
  const relationMatch = message.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation .* does not exist/i)
  if (relationMatch?.[1]) return relationMatch[1]
  const schemaCacheMatch = message.match(/Could not find the ['"]([a-zA-Z0-9_]+)['"] column of ['"][a-zA-Z0-9_]+['"] in the schema cache/i)
  return schemaCacheMatch?.[1] ?? ''
}

async function executeInsertWithFallback(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClientAndUser>>['supabase'],
  payload: Record<string, unknown>
) {
  const working = { ...payload }

  while (true) {
    const attempt = await supabase.from('dm_dinh_muc_phu_md').insert(working)
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

export async function createDmDinhMucPhuAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_dinh_muc_phu_md')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const pileGroup = String(formData.get('pile_group') ?? '').trim()
  const payloadRaw = String(formData.get('items_json') ?? '[]')

  if (!pileGroup) redirectWithError('Cần chọn loại cọc.')

  let items: Array<{ nvl_id: string; dvt: string; dinh_muc: number }> = []
  try {
    items = JSON.parse(payloadRaw) as Array<{ nvl_id: string; dvt: string; dinh_muc: number }>
  } catch {
    redirectWithError('Dữ liệu định mức không hợp lệ.')
  }

  const normalizedItems = items
    .map((item) => ({
      nvl_id: String(item.nvl_id ?? '').trim(),
      dvt: String(item.dvt ?? '').trim(),
      dinh_muc: Number(item.dinh_muc ?? 0),
    }))
    .filter((item) => item.nvl_id && item.dvt && Number.isFinite(item.dinh_muc) && item.dinh_muc > 0)

  if (normalizedItems.length === 0) {
    redirectWithError('Cần thêm ít nhất 1 vật tư phụ hợp lệ.')
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('dm_dinh_muc_phu_md')
    .select('*')
    .eq('is_active', true)
    .eq('nhom_d', pileGroup)

  if (existingError) redirectWithError(existingError.message)

  const existing = (existingRows ?? []) as RowData[]
  const existingKeyField = pickKeyField('dm_dinh_muc_phu_md', existing)

  for (const item of normalizedItems) {
    const duplicate = existing.find(
      (row) =>
        String(row.nhom_d ?? '').trim() === pileGroup &&
        String(row.nvl_id ?? '').trim() === item.nvl_id &&
        row.is_active !== false
    )
    if (duplicate) {
      redirectWithError(`Vật tư này đã tồn tại cho loại cọc đã chọn.`)
    }
  }

  for (const item of normalizedItems) {
    const payload: Record<string, unknown> = {
      nhom_d: pileGroup,
      nvl_id: item.nvl_id,
      dvt: item.dvt,
      dinh_muc: item.dinh_muc,
      is_active: true,
      deleted_at: null,
      created_by: user.id,
    }

    const result = await executeInsertWithFallback(supabase, payload)
    if (result.error) redirectWithError(result.error.message)
  }

  const pageParams = new URLSearchParams()
  pageParams.set('msg', 'Tạo định mức vật tư phụ thành công')
  if (existing.length > 0 && existingKeyField) {
    pageParams.set('page', '1')
  }
  redirect(`${BASE_PATH}?${pageParams.toString()}`)
}

export async function updateDmDinhMucPhuAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_dinh_muc_phu_md')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const currentGroup = String(formData.get('current_group') ?? '').trim()
  const pileGroup = String(formData.get('pile_group') ?? '').trim()
  const payloadRaw = String(formData.get('items_json') ?? '[]')

  if (!currentGroup) redirectWithError('Thiếu loại cọc hiện hành cần cập nhật.')
  if (!pileGroup) redirectWithError('Cần chọn loại cọc.')

  let items: Array<{ id?: string; nvl_id: string; dvt: string; dinh_muc: number }> = []
  try {
    items = JSON.parse(payloadRaw) as Array<{ id?: string; nvl_id: string; dvt: string; dinh_muc: number }>
  } catch {
    redirectWithError('Dữ liệu định mức không hợp lệ.')
  }

  const normalizedItems = items
    .map((item) => ({
      id: String(item.id ?? '').trim(),
      nvl_id: String(item.nvl_id ?? '').trim(),
      dvt: String(item.dvt ?? '').trim(),
      dinh_muc: Number(item.dinh_muc ?? 0),
    }))
    .filter((item) => item.nvl_id && item.dvt && Number.isFinite(item.dinh_muc) && item.dinh_muc > 0)

  if (normalizedItems.length === 0) {
    redirectWithError('Cần thêm ít nhất 1 vật tư phụ hợp lệ.')
  }

  const duplicateIds = new Set<string>()
  for (const item of normalizedItems) {
    if (duplicateIds.has(item.nvl_id)) {
      redirectWithError('Một vật tư phụ chỉ được xuất hiện 1 lần trong cùng bộ định mức.')
    }
    duplicateIds.add(item.nvl_id)
  }

  const { data: activeRows, error: activeError } = await supabase
    .from('dm_dinh_muc_phu_md')
    .select('*')
    .eq('is_active', true)
    .limit(1000)

  if (activeError) redirectWithError(activeError.message)

  const rows = (activeRows ?? []) as RowData[]
  const keyField = pickKeyField('dm_dinh_muc_phu_md', rows)
  if (!keyField) redirectWithError('Không xác định được khóa định mức vật tư phụ.')
  const resolvedKeyField = keyField as string

  const currentRows = rows.filter((row) => String(row.nhom_d ?? '').trim() === currentGroup)
  const currentIds = new Set(currentRows.map((row) => String(row[resolvedKeyField] ?? '')))
  const targetConflicts = rows.filter(
    (row) =>
      String(row.nhom_d ?? '').trim() === pileGroup &&
      !currentIds.has(String(row[resolvedKeyField] ?? ''))
  )

  for (const item of normalizedItems) {
    const conflict = targetConflicts.find((row) => String(row.nvl_id ?? '').trim() === item.nvl_id)
    if (conflict) {
      redirectWithError('Loại cọc đích đã có vật tư phụ này. Vui lòng sửa bộ hiện hành thay vì tạo trùng.')
    }
  }

  const submittedIds = new Set(normalizedItems.map((item) => item.id).filter(Boolean))

  for (const row of currentRows) {
    const rowId = String(row[resolvedKeyField] ?? '')
    if (!submittedIds.has(rowId)) {
      const removeResult = await softDeleteRowWithFallback(supabase as never, {
        tableName: 'dm_dinh_muc_phu_md',
        keyField: resolvedKeyField,
        keyValue: row[resolvedKeyField],
        userId: user.id,
      })
      if (removeResult.error) redirectWithError(removeResult.error.message)
    }
  }

  const currentRowsMap = new Map(currentRows.map((row) => [String(row[resolvedKeyField] ?? ''), row]))

  for (const item of normalizedItems) {
    if (item.id && currentRowsMap.has(item.id)) {
      const updateResult = await updateRowWithFallback(
        supabase as never,
        'dm_dinh_muc_phu_md',
        resolvedKeyField,
        item.id,
        {
          nhom_d: pileGroup,
          nvl_id: item.nvl_id,
          dvt: item.dvt,
          dinh_muc: item.dinh_muc,
          updated_by: user.id,
        }
      )
      if (updateResult.error) redirectWithError(updateResult.error.message)
      continue
    }

    const insertResult = await executeInsertWithFallback(supabase, {
      nhom_d: pileGroup,
      nvl_id: item.nvl_id,
      dvt: item.dvt,
      dinh_muc: item.dinh_muc,
      is_active: true,
      deleted_at: null,
      created_by: user.id,
    })
    if (insertResult.error) redirectWithError(insertResult.error.message)
  }

  redirect(`${BASE_PATH}?msg=${encodeURIComponent('Cập nhật định mức vật tư phụ thành công')}`)
}
