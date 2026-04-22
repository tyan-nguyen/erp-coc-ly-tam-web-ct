'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'
import {
  RESERVED_WAREHOUSE_LOCATION_CODES,
  buildWarehouseLocationLabel,
  isReservedWarehouseLocationCode,
  normalizeWarehouseLocationCode,
} from '@/lib/master-data/warehouse-location-shared'

const BASE_PATH = '/master-data/khu-vuc-ton'

function redirectWithError(message: string) {
  redirect(`${BASE_PATH}?err=${encodeURIComponent(message)}`)
}

function redirectWithMessage(message: string) {
  redirect(`${BASE_PATH}?msg=${encodeURIComponent(message)}`)
}

function normalizeOptionalId(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

async function loadLocationRows() {
  const { supabase } = await getAuthenticatedClientAndUser()
  const { data, error } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code, location_name, is_active')
    .limit(300)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Array<Record<string, unknown>>
}

async function countSerialsByLocationIds(locationIds: string[]) {
  const { supabase } = await getAuthenticatedClientAndUser()
  if (locationIds.length === 0) return new Map<string, number>()

  const { data, error } = await supabase
    .from('pile_serial')
    .select('serial_id, current_location_id, is_active')
    .in('current_location_id', locationIds)
    .eq('is_active', true)

  if (error) {
    throw new Error(error.message)
  }

  const countMap = new Map<string, number>()
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const locationId = String(row.current_location_id ?? '')
    if (!locationId) continue
    countMap.set(locationId, (countMap.get(locationId) ?? 0) + 1)
  }
  return countMap
}

export async function createWarehouseLocationAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_khu_vuc_ton')
  const { supabase } = await getAuthenticatedClientAndUser()

  const locationCode = normalizeWarehouseLocationCode(String(formData.get('location_code') ?? ''))
  const rawLocationName = String(formData.get('location_name') ?? '').trim()
  const locationName = rawLocationName || locationCode
  const locationType = String(formData.get('location_type') ?? 'STORAGE').trim().toUpperCase()
  const parentLocationId = normalizeOptionalId(formData.get('parent_location_id'))

  if (!locationCode) redirectWithError('Cần nhập mã khu vực.')
  if (!locationType) redirectWithError('Cần chọn loại khu vực.')

  const { error } = await supabase.from('warehouse_location').insert({
    location_code: locationCode,
    location_name: locationName,
    location_type: locationType,
    parent_location_id: parentLocationId,
    is_active: true,
  })

  if (error) redirectWithError(error.message)
  redirectWithMessage(`Tạo khu vực tồn ${buildWarehouseLocationLabel({ location_code: locationCode, location_name: locationName })} thành công`)
}

export async function updateWarehouseLocationAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_khu_vuc_ton')
  const { supabase } = await getAuthenticatedClientAndUser()
  const locationId = String(formData.get('location_id') ?? '').trim()
  const locationCode = normalizeWarehouseLocationCode(String(formData.get('location_code') ?? ''))
  const rawLocationName = String(formData.get('location_name') ?? '').trim()
  const locationName = rawLocationName || locationCode
  const locationType = String(formData.get('location_type') ?? 'STORAGE').trim().toUpperCase()
  const parentLocationId = normalizeOptionalId(formData.get('parent_location_id'))

  if (!locationId) redirectWithError('Thiếu khóa khu vực tồn.')
  if (!locationCode) redirectWithError('Cần nhập mã khu vực.')

  const rows = await loadLocationRows()
  const currentRow = rows.find((row) => String(row.location_id ?? '') === locationId)
  if (!currentRow) redirectWithError('Không tìm thấy khu vực tồn cần cập nhật.')

  const currentCode = normalizeWarehouseLocationCode(String(currentRow.location_code ?? ''))
  const isReserved = isReservedWarehouseLocationCode(currentCode)

  if (isReserved && locationCode !== currentCode) {
    redirectWithError('Không được đổi mã của khu vực mặc định.')
  }

  if (parentLocationId === locationId) {
    redirectWithError('Khu vực cha không được trùng chính nó.')
  }

  const { error } = await supabase
    .from('warehouse_location')
    .update({
      location_code: locationCode,
      location_name: locationName,
      location_type: locationType,
      parent_location_id: parentLocationId,
    })
    .eq('location_id', locationId)

  if (error) redirectWithError(error.message)
  redirectWithMessage(`Cập nhật khu vực tồn ${buildWarehouseLocationLabel({ location_code: locationCode, location_name: locationName })} thành công`)
}

export async function bulkDeactivateWarehouseLocationAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_khu_vuc_ton')
  const { supabase } = await getAuthenticatedClientAndUser()

  const values = formData
    .getAll('key_value')
    .map((value) => {
      try {
        return JSON.parse(String(value)) as string
      } catch {
        return ''
      }
    })
    .filter(Boolean)

  if (values.length === 0) redirectWithError('Cần chọn ít nhất 1 khu vực tồn.')

  const rows = await loadLocationRows()
  const selectedRows = rows.filter((row) => values.includes(String(row.location_id ?? '')))
  if (selectedRows.length === 0) redirectWithError('Không tìm thấy khu vực tồn cần cập nhật.')

  const reservedRow = selectedRows.find((row) =>
    RESERVED_WAREHOUSE_LOCATION_CODES.includes(
      normalizeWarehouseLocationCode(String(row.location_code ?? '')) as (typeof RESERVED_WAREHOUSE_LOCATION_CODES)[number]
    )
  )
  if (reservedRow) {
    redirectWithError(`Không được ngừng sử dụng khu mặc định ${String(reservedRow.location_code ?? '')}.`)
  }

  const locationIds = selectedRows.map((row) => String(row.location_id ?? '')).filter(Boolean)
  const serialCountByLocationId = await countSerialsByLocationIds(locationIds)
  const occupiedRow = selectedRows.find((row) => (serialCountByLocationId.get(String(row.location_id ?? '')) ?? 0) > 0)
  if (occupiedRow) {
    redirectWithError(`Khu ${buildWarehouseLocationLabel(occupiedRow)} đang còn serial, chưa thể ngừng sử dụng.`)
  }

  const { error } = await supabase
    .from('warehouse_location')
    .update({ is_active: false })
    .in('location_id', locationIds)

  if (error) redirectWithError(error.message)
  redirectWithMessage(`Đã ngừng sử dụng ${selectedRows.length} khu vực tồn.`)
}
