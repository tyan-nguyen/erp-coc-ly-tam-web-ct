'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { softDeleteRowWithFallback } from '@/lib/master-data/mutation-helpers'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'

const BASE_PATH = '/master-data/dm-chi-phi-khac'

type MatrixPayload = {
  diameters: string[]
  rows: Array<{
    id?: string
    item_name: string
    dvt: string
    values: Record<string, string>
  }>
}

function redirectWithError(message: string) {
  redirect(`${BASE_PATH}?err=${encodeURIComponent(message)}`)
}

function redirectWithMessage(message: string) {
  redirect(`${BASE_PATH}?msg=${encodeURIComponent(message)}`)
}

function parseNumber(input: string | number | null | undefined) {
  const raw = String(input ?? '').trim()
  if (!raw) return 0
  const normalized = raw.replace(/[,\s]/g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function isMissingRelationError(message: string) {
  return /relation .* does not exist/i.test(message) || /Could not find the table ['"]public\.[a-zA-Z0-9_]+['"] in the schema cache/i.test(message)
}

export async function saveDmChiPhiKhacAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_chi_phi_khac')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const payloadRaw = String(formData.get('matrix_json') ?? '')

  let payload: MatrixPayload = { diameters: [], rows: [] }
  try {
    payload = JSON.parse(payloadRaw) as MatrixPayload
  } catch {
    redirectWithError('Dữ liệu ma trận chi phí không hợp lệ.')
  }

  const diameters = Array.from(
    new Set((payload.diameters ?? []).map((item) => String(item || '').trim()).filter(Boolean))
  ).sort((a, b) => Number(a) - Number(b))

  if (diameters.length === 0) {
    redirectWithError('Cần ít nhất 1 cột đường kính.')
  }

  const normalizedRows = (payload.rows ?? [])
    .map((row, index) => ({
      id: String(row.id ?? '').trim(),
      item_name: String(row.item_name ?? '').trim(),
      dvt: String(row.dvt ?? '').trim() || 'vnd/md',
      sort_order: index + 1,
      values: row.values ?? {},
    }))
    .filter((row) => row.item_name)

  if (normalizedRows.length === 0) {
    redirectWithError('Cần ít nhất 1 khoản mục chi phí.')
  }

  const records = normalizedRows.flatMap((row) =>
    diameters.map((diameter) => ({
      id: row.id,
      item_name: row.item_name,
      dvt: row.dvt,
      duong_kinh_mm: parseNumber(diameter),
      chi_phi_vnd_md: parseNumber(row.values[diameter]),
      sort_order: row.sort_order,
    }))
  )

  const { data: existingRows, error: existingError } = await supabase
    .from('dm_chi_phi_khac_md')
    .select('*')
    .eq('is_active', true)
    .limit(2000)

  if (existingError) {
    redirectWithError(
      isMissingRelationError(existingError.message)
        ? 'Chưa khởi tạo bảng dm_chi_phi_khac_md.'
        : existingError.message
    )
  }

  const currentRows = (existingRows ?? []) as Array<Record<string, unknown>>
  for (const row of currentRows) {
    const deleteResult = await softDeleteRowWithFallback(supabase as never, {
      tableName: 'dm_chi_phi_khac_md',
      keyField: 'cost_id',
      keyValue: row.cost_id,
      userId: user.id,
    })
    if (deleteResult.error) redirectWithError(deleteResult.error.message)
  }

  for (const record of records) {
    let insertResult = await supabase.from('dm_chi_phi_khac_md').insert({
      item_name: record.item_name,
      dvt: record.dvt,
      duong_kinh_mm: record.duong_kinh_mm,
      chi_phi_vnd_md: record.chi_phi_vnd_md,
      sort_order: record.sort_order,
      is_active: true,
      deleted_at: null,
      created_by: user.id,
      updated_by: user.id,
    })

    if (insertResult.error && insertResult.error.message.includes(`'created_by'`)) {
      insertResult = await supabase.from('dm_chi_phi_khac_md').insert({
        item_name: record.item_name,
        dvt: record.dvt,
        duong_kinh_mm: record.duong_kinh_mm,
        chi_phi_vnd_md: record.chi_phi_vnd_md,
        sort_order: record.sort_order,
        is_active: true,
        deleted_at: null,
      })
    }

    if (insertResult.error) redirectWithError(insertResult.error.message)
  }

  redirectWithMessage('Lưu ma trận chi phí khác/md thành công')
}
