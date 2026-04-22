import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  WarehouseLocationAssignmentResult,
  WarehouseLocationTransferResult,
} from '@/lib/ton-kho-thanh-pham/location-assignment-types'
import { buildLocationLabel, isCurrentInventoryRow, normalizeText, safeArray } from '@/lib/ton-kho-thanh-pham/internal'

function parseSerialCodes(raw: string) {
  return Array.from(
    new Set(
      String(raw || '')
        .split(/[\n,;\t ]+/)
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  )
}

function getUnknownErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message || '').trim()
    if (message) return message
  }
  return fallback
}

async function updatePileSerialLocationWithFallback(input: {
  supabase: SupabaseClient
  serialIds: string[]
  locationId: string
  userId: string
}) {
  const workingPayload: Record<string, unknown> = {
    current_location_id: input.locationId,
    updated_by: input.userId,
  }

  const attempt = async () =>
    input.supabase
      .from('pile_serial')
      .update(workingPayload)
      .in('serial_id', input.serialIds)
      .eq('is_active', true)

  let result = await attempt()
  if (result.error && String(result.error.message || '').includes(`'updated_by'`)) {
    delete workingPayload.updated_by
    result = await attempt()
  }
  if (result.error) {
    throw new Error(`Không cập nhật được bãi hiện tại cho serial: ${getUnknownErrorMessage(result.error, 'Lỗi không xác định.')}`)
  }
}

export async function assignSerialsToWarehouseLocation(
  supabase: SupabaseClient,
  input: {
    userId: string
    userRole: string
    locationId: string
    serialCodesText: string
    note?: string
  }
): Promise<WarehouseLocationAssignmentResult> {
  const locationId = normalizeText(input.locationId)
  if (!locationId) throw new Error('Cần chọn bãi đích.')

  const serialCodes = parseSerialCodes(input.serialCodesText)
  if (!serialCodes.length) {
    throw new Error('Cần nhập ít nhất một serial để gán bãi.')
  }

  const { data: locationRow, error: locationError } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code, location_name')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .maybeSingle()

  if (locationError) throw locationError
  if (!locationRow) throw new Error('Không tìm thấy bãi đích.')

  const locationLabel = buildLocationLabel(
    normalizeText(locationRow.location_code),
    normalizeText(locationRow.location_name)
  )

  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select('serial_id, serial_code, lifecycle_status, current_location_id, is_active')
    .in('serial_code', serialCodes)

  if (serialError) throw serialError

  const serialMap = new Map(
    safeArray<Record<string, unknown>>(serialRows).map((row) => [normalizeText(row.serial_code), row])
  )

  const missingCodes = serialCodes.filter((code) => !serialMap.has(code))
  const skippedRows: Array<{ serialCode: string; reason: string }> = []
  const assignableRows: Array<Record<string, unknown>> = []
  let unchangedCount = 0

  for (const serialCode of serialCodes) {
    const row = serialMap.get(serialCode)
    if (!row) continue
    if (!Boolean(row.is_active)) {
      skippedRows.push({ serialCode, reason: 'Serial đang không active.' })
      continue
    }
    if (!isCurrentInventoryRow(normalizeText(row.lifecycle_status))) {
      skippedRows.push({ serialCode, reason: 'Serial này hiện không còn nằm trong tồn kho.' })
      continue
    }
    if (String(row.current_location_id || '') === locationId) {
      unchangedCount += 1
      continue
    }
    assignableRows.push(row)
  }

  if (assignableRows.length) {
    const serialIds = assignableRows.map((row) => String(row.serial_id || '')).filter(Boolean)
    await updatePileSerialLocationWithFallback({
      supabase,
      serialIds,
      locationId,
      userId: input.userId,
    })

    const historyRows = assignableRows.map((row) => ({
      serial_id: String(row.serial_id || ''),
      event_type: 'LOCATION_TRANSFER',
      note: normalizeText(input.note) || `Gán vào bãi ${locationLabel}`,
      from_location_id: String(row.current_location_id || '') || null,
      to_location_id: locationId,
      from_lifecycle_status: normalizeText(row.lifecycle_status) || null,
      to_lifecycle_status: normalizeText(row.lifecycle_status) || null,
      changed_by: input.userId,
    }))

    const { error: historyError } = await supabase.from('pile_serial_history').insert(historyRows)
    if (historyError) {
      throw new Error(`Không ghi được lịch sử gán bãi: ${getUnknownErrorMessage(historyError, 'Lỗi không xác định.')}`)
    }
  }

  return {
    locationLabel,
    assignedCount: assignableRows.length,
    unchangedCount,
    missingCodes,
    skippedRows,
  }
}

export async function transferSerialsBetweenWarehouseLocations(
  supabase: SupabaseClient,
  input: {
    userId: string
    userRole: string
    fromLocationId: string
    toLocationId: string
    serialCodesText: string
    note?: string
  }
): Promise<WarehouseLocationTransferResult> {
  const fromLocationId = normalizeText(input.fromLocationId)
  const toLocationId = normalizeText(input.toLocationId)
  if (!fromLocationId) throw new Error('Cần chọn bãi nguồn.')
  if (!toLocationId) throw new Error('Cần chọn bãi đích.')
  if (fromLocationId === toLocationId) throw new Error('Bãi nguồn và bãi đích không được trùng nhau.')

  const serialCodes = parseSerialCodes(input.serialCodesText)
  if (!serialCodes.length) {
    throw new Error('Cần nhập ít nhất một serial để điều chuyển.')
  }

  const { data: locationRows, error: locationError } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code, location_name')
    .in('location_id', [fromLocationId, toLocationId])
    .eq('is_active', true)

  if (locationError) throw locationError

  const locationMap = new Map(
    safeArray<Record<string, unknown>>(locationRows).map((row) => [String(row.location_id || ''), row])
  )
  const fromLocationRow = locationMap.get(fromLocationId)
  const toLocationRow = locationMap.get(toLocationId)
  if (!fromLocationRow) throw new Error('Không tìm thấy bãi nguồn.')
  if (!toLocationRow) throw new Error('Không tìm thấy bãi đích.')

  const fromLocationLabel = buildLocationLabel(
    normalizeText(fromLocationRow.location_code),
    normalizeText(fromLocationRow.location_name)
  )
  const toLocationLabel = buildLocationLabel(
    normalizeText(toLocationRow.location_code),
    normalizeText(toLocationRow.location_name)
  )

  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select('serial_id, serial_code, lifecycle_status, current_location_id, is_active')
    .in('serial_code', serialCodes)

  if (serialError) throw serialError

  const serialMap = new Map(
    safeArray<Record<string, unknown>>(serialRows).map((row) => [normalizeText(row.serial_code), row])
  )

  const missingCodes = serialCodes.filter((code) => !serialMap.has(code))
  const skippedRows: Array<{ serialCode: string; reason: string }> = []
  const transferableRows: Array<Record<string, unknown>> = []

  for (const serialCode of serialCodes) {
    const row = serialMap.get(serialCode)
    if (!row) continue
    if (!Boolean(row.is_active)) {
      skippedRows.push({ serialCode, reason: 'Serial đang không active.' })
      continue
    }
    if (!isCurrentInventoryRow(normalizeText(row.lifecycle_status))) {
      skippedRows.push({ serialCode, reason: 'Serial này hiện không còn nằm trong tồn kho.' })
      continue
    }
    if (String(row.current_location_id || '') !== fromLocationId) {
      skippedRows.push({ serialCode, reason: `Serial hiện không nằm ở bãi ${fromLocationLabel}.` })
      continue
    }
    transferableRows.push(row)
  }

  if (transferableRows.length) {
    const serialIds = transferableRows.map((row) => String(row.serial_id || '')).filter(Boolean)
    await updatePileSerialLocationWithFallback({
      supabase,
      serialIds,
      locationId: toLocationId,
      userId: input.userId,
    })

    const historyRows = transferableRows.map((row) => ({
      serial_id: String(row.serial_id || ''),
      event_type: 'LOCATION_TRANSFER',
      note: normalizeText(input.note) || `Điều chuyển bãi ${fromLocationLabel} -> ${toLocationLabel}`,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      from_lifecycle_status: normalizeText(row.lifecycle_status) || null,
      to_lifecycle_status: normalizeText(row.lifecycle_status) || null,
      changed_by: input.userId,
    }))

    const { error: historyError } = await supabase.from('pile_serial_history').insert(historyRows)
    if (historyError) {
      throw new Error(`Không ghi được lịch sử điều chuyển bãi: ${getUnknownErrorMessage(historyError, 'Lỗi không xác định.')}`)
    }
  }

  return {
    fromLocationLabel,
    toLocationLabel,
    transferredCount: transferableRows.length,
    missingCodes,
    skippedRows,
  }
}
