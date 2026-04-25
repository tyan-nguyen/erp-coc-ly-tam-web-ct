import { createClient } from '@/lib/supabase/server'
import {
  filterRowsByQuery,
  pickKeyField,
  type RowData,
} from '@/lib/master-data/crud-utils'
import {
  buildWarehouseLocationLabel,
  isReservedWarehouseLocationCode,
  normalizeWarehouseLocationCode,
} from '@/lib/master-data/warehouse-location-shared'

export type WarehouseLocationPageData = {
  rows: RowData[]
  error: unknown
  keyField: string | null
  filteredRows: RowData[]
  pagedRows: RowData[]
  totalPages: number
  safePage: number
  editRow: RowData | null
  parentOptions: Array<{
    locationId: string
    label: string
  }>
}

function readWarehouseLocationRowTime(row: RowData) {
  const raw = row.created_at ?? null
  if (!raw) return 0
  const time = new Date(String(raw)).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function compareWarehouseLocationRowsDesc(a: RowData, b: RowData) {
  const aTime = readWarehouseLocationRowTime(a)
  const bTime = readWarehouseLocationRowTime(b)
  if (aTime !== bTime) return bTime - aTime
  return String(a.location_code ?? '').localeCompare(String(b.location_code ?? ''))
}

export async function loadWarehouseLocationPageData(input: {
  q: string
  showInactive: boolean
  editKey: string
  currentPage: number
  pageSize: number
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code, location_name, location_type, parent_location_id, created_at, is_active')
    .order('created_at', { ascending: false })
    .limit(300)

  const rawRows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    location_code: normalizeWarehouseLocationCode(String(row.location_code ?? '')),
  }))

  const locationIds = rawRows.map((row) => String(row.location_id ?? '')).filter(Boolean)
  const parentMap = new Map(
    rawRows.map((row) => [
      String(row.location_id ?? ''),
      buildWarehouseLocationLabel(row),
    ])
  )

  const currentSerialCountByLocationId = new Map<string, number>()
  if (locationIds.length > 0) {
    const { data: serialRows } = await supabase
      .from('pile_serial')
      .select('serial_id, current_location_id, is_active')
      .in('current_location_id', locationIds)
      .eq('is_active', true)

    for (const serial of (serialRows ?? []) as Array<Record<string, unknown>>) {
      const locationId = String(serial.current_location_id ?? '')
      if (!locationId) continue
      currentSerialCountByLocationId.set(locationId, (currentSerialCountByLocationId.get(locationId) ?? 0) + 1)
    }
  }

  const rows: RowData[] = rawRows.map((row) => {
    const locationId = String(row.location_id ?? '')
    const parentLocationId = String(row.parent_location_id ?? '')
    const currentSerialCount = currentSerialCountByLocationId.get(locationId) ?? 0
    return {
      ...row,
      parent_label: parentLocationId ? parentMap.get(parentLocationId) ?? '-' : '-',
      current_serial_count: currentSerialCount,
      is_reserved: isReservedWarehouseLocationCode(row.location_code),
      search_text: [
        row.location_code,
        row.location_name,
        row.location_type,
        parentLocationId ? parentMap.get(parentLocationId) : '',
        currentSerialCount,
      ]
        .filter((value) => value !== null && value !== undefined && String(value).trim())
        .join(' '),
    }
  })

  const keyField = pickKeyField('warehouse_location', rows)
  const sortedRows = [...rows].sort(compareWarehouseLocationRowsDesc)
  const filteredByActive = input.showInactive
    ? sortedRows
    : sortedRows.filter((row) => row.is_active !== false)
  const filteredRows = filterRowsByQuery(filteredByActive, input.q)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / input.pageSize))
  const safePage = Math.min(input.currentPage, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * input.pageSize, safePage * input.pageSize)
  const editRow =
    input.editKey && keyField
      ? rows.find((row) => String(row[keyField]) === input.editKey) ?? null
      : null

  const parentOptions = rawRows
    .filter((row) => row.is_active !== false)
    .sort((a, b) => String(a.location_code ?? '').localeCompare(String(b.location_code ?? '')))
    .map((row) => ({
      locationId: String(row.location_id ?? ''),
      label: buildWarehouseLocationLabel(row),
    }))

  return {
    rows,
    error,
    keyField,
    filteredRows,
    pagedRows,
    totalPages,
    safePage,
    editRow,
    parentOptions,
  } satisfies WarehouseLocationPageData
}
