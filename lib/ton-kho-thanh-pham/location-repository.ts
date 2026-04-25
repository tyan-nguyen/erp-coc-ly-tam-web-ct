import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  WarehouseLocationDetail,
  WarehouseLocationFilters,
  WarehouseLocationOption,
  WarehouseLocationPageData,
  WarehouseLocationSerialRow,
  WarehouseLocationSummaryRow,
} from '@/lib/ton-kho-thanh-pham/location-types'
import {
  buildLocationLabel,
  isCurrentInventoryRow,
  isMissingRelationError,
  normalizeText,
  round3,
  safeArray,
  toNumber,
  type AnySupabase,
  SERIAL_PAGE_SIZE,
  SUMMARY_PAGE_SIZE,
} from '@/lib/ton-kho-thanh-pham/internal'

type LocationInventorySerial = {
  serialId: string
  serialCode: string
  itemLabel: string
  lotCode: string
  productionDate: string
  qcStatus: string
  locationId: string
  locationCode: string
  locationName: string
  locationLabel: string
  note: string
}

function buildLocationFilters(
  rawFilters: Partial<Record<'q' | 'page' | 'location' | 'serial_page' | 'quality', string | string[] | undefined>>
): WarehouseLocationFilters {
  const query = normalizeText(rawFilters.q)
  const page = Math.max(toNumber(rawFilters.page, 1), 1)
  const selectedLocationId = normalizeText(rawFilters.location)
  const serialPage = Math.max(toNumber(rawFilters.serial_page, 1), 1)
  const quality = normalizeText(rawFilters.quality).toUpperCase() === 'LOI' ? 'LOI' : normalizeText(rawFilters.quality).toUpperCase() === 'DAT' ? 'DAT' : 'ALL'

  return {
    query,
    page,
    selectedLocationId,
    serialPage,
    quality,
  }
}

async function isLocationSchemaReady(supabase: AnySupabase) {
  const { error } = await supabase.from('pile_serial').select('serial_id').limit(1)
  if (!error) return true
  if (isMissingRelationError(error, 'pile_serial')) return false
  throw error
}

async function loadCurrentLocationSerials(supabase: AnySupabase) {
  const { data: serialRows, error: serialError } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m, qc_status, lifecycle_status, current_location_id, notes'
    )
    .eq('is_active', true)

  if (serialError) throw serialError

  const currentRows = safeArray<Record<string, unknown>>(serialRows).filter((row) => {
    if (!isCurrentInventoryRow(normalizeText(row.lifecycle_status))) return false
    return Boolean(normalizeText(row.current_location_id))
  })

  const lotIds = Array.from(new Set(currentRows.map((row) => String(row.lot_id || '')).filter(Boolean)))
  const locationIds = Array.from(
    new Set(currentRows.map((row) => String(row.current_location_id || '')).filter(Boolean))
  )

  const [lotResponse, locationResponse] = await Promise.all([
    lotIds.length
      ? supabase.from('production_lot').select('lot_id, lot_code, production_date').in('lot_id', lotIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length
      ? supabase
          .from('warehouse_location')
          .select('location_id, location_code, location_name')
          .in('location_id', locationIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (lotResponse.error) throw lotResponse.error
  if (locationResponse.error) throw locationResponse.error

  const lotMap = new Map<string, Record<string, unknown>>()
  for (const lot of safeArray<Record<string, unknown>>(lotResponse.data)) {
    lotMap.set(String(lot.lot_id || ''), lot)
  }

  const locationMap = new Map<string, Record<string, unknown>>()
  for (const location of safeArray<Record<string, unknown>>(locationResponse.data)) {
    locationMap.set(String(location.location_id || ''), location)
  }

  return currentRows.map((row) => {
    const lot = lotMap.get(String(row.lot_id || '')) || {}
    const location = locationMap.get(String(row.current_location_id || '')) || {}
    const loaiCoc = normalizeText(row.loai_coc)
    const tenDoan = normalizeText(row.ten_doan)
    const chieuDaiM = round3(toNumber(row.chieu_dai_m))
    const itemLabel = `${loaiCoc} | ${tenDoan} | ${chieuDaiM}m`
    const locationCode = normalizeText(location.location_code)
    const locationName = normalizeText(location.location_name)

    return {
      serialId: String(row.serial_id || ''),
      serialCode: normalizeText(row.serial_code),
      itemLabel,
      lotCode: normalizeText(lot.lot_code),
      productionDate: normalizeText(lot.production_date),
      qcStatus: normalizeText(row.qc_status),
      locationId: String(row.current_location_id || ''),
      locationCode,
      locationName,
      locationLabel: buildLocationLabel(locationCode, locationName),
      note: normalizeText(row.notes),
    } satisfies LocationInventorySerial
  })
}

async function loadLocationOptions(supabase: AnySupabase) {
  const { data, error } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code, location_name')
    .eq('is_active', true)
    .order('location_code', { ascending: true })

  if (error) throw error

  return safeArray<Record<string, unknown>>(data).map((row) => {
    const locationCode = normalizeText(row.location_code)
    const locationName = normalizeText(row.location_name)
    return {
      locationId: String(row.location_id || ''),
      locationCode,
      locationName,
      locationLabel: buildLocationLabel(locationCode, locationName),
    } satisfies WarehouseLocationOption
  })
}

function buildLocationSummaryRows(rows: LocationInventorySerial[]) {
  const summaryMap = new Map<string, WarehouseLocationSummaryRow>()

  for (const row of rows) {
    const current =
      summaryMap.get(row.locationId) || {
        locationId: row.locationId,
        locationCode: row.locationCode,
        locationName: row.locationName,
        locationLabel: row.locationLabel,
        totalQty: 0,
        acceptedQty: 0,
        defectQty: 0,
        itemCount: 0,
      }

    current.totalQty += 1
    if (row.qcStatus === 'LOI') current.defectQty += 1
    else current.acceptedQty += 1
    summaryMap.set(row.locationId, current)
  }

  const itemSetByLocation = new Map<string, Set<string>>()
  for (const row of rows) {
    const set = itemSetByLocation.get(row.locationId) || new Set<string>()
    set.add(row.itemLabel)
    itemSetByLocation.set(row.locationId, set)
  }

  for (const summary of summaryMap.values()) {
    summary.itemCount = itemSetByLocation.get(summary.locationId)?.size || 0
  }

  return Array.from(summaryMap.values()).sort((a, b) => a.locationLabel.localeCompare(b.locationLabel))
}

function buildLocationDetail(
  rows: LocationInventorySerial[],
  locationId: string,
  serialPage: number
): WarehouseLocationDetail | null {
  if (!locationId) return null
  const serialRows = rows
    .filter((row) => row.locationId === locationId)
    .sort((a, b) => `${a.itemLabel} ${a.serialCode}`.localeCompare(`${b.itemLabel} ${b.serialCode}`))

  if (!serialRows.length) return null

  const first = serialRows[0]
  const totalSerialCount = serialRows.length
  const serialPageCount = Math.max(Math.ceil(totalSerialCount / SERIAL_PAGE_SIZE), 1)
  const currentPage = Math.min(Math.max(serialPage, 1), serialPageCount)
  const start = (currentPage - 1) * SERIAL_PAGE_SIZE
  const pagedRows: WarehouseLocationSerialRow[] = serialRows.slice(start, start + SERIAL_PAGE_SIZE).map((row) => ({
    serialId: row.serialId,
    serialCode: row.serialCode,
    itemLabel: row.itemLabel,
    lotCode: row.lotCode,
    productionDate: row.productionDate,
    qualityLabel: row.qcStatus === 'LOI' ? 'Lỗi' : 'Đạt',
    note: row.note,
  }))

  return {
    locationId,
    locationLabel: first.locationLabel,
    totalQty: totalSerialCount,
    acceptedQty: serialRows.filter((row) => row.qcStatus !== 'LOI').length,
    defectQty: serialRows.filter((row) => row.qcStatus === 'LOI').length,
    serialRows: pagedRows,
    totalSerialCount,
    serialPage: currentPage,
    serialPageCount,
  }
}

export async function loadWarehouseLocationPageData(
  supabase: SupabaseClient,
  rawFilters: Partial<Record<'q' | 'page' | 'location' | 'serial_page' | 'quality', string | string[] | undefined>>
): Promise<WarehouseLocationPageData> {
  const schemaReady = await isLocationSchemaReady(supabase)
  const filters = buildLocationFilters(rawFilters)

  if (!schemaReady) {
    return {
      schemaReady: false,
      filters,
      locations: [],
      summaryRows: [],
      summaryTotalCount: 0,
      summaryPageCount: 1,
      selectedLocationDetail: null,
    }
  }

  const [currentRows, locations] = await Promise.all([loadCurrentLocationSerials(supabase), loadLocationOptions(supabase)])
  const normalizedQuery = filters.query.toLowerCase()
  const filteredRows = normalizedQuery
    ? currentRows.filter((row) =>
        [row.locationLabel, row.serialCode, row.itemLabel, row.lotCode, row.note].join(' ').toLowerCase().includes(normalizedQuery)
      )
    : currentRows
  const qualityFilteredRows =
    filters.quality === 'ALL'
      ? filteredRows
      : filteredRows.filter((row) => (filters.quality === 'LOI' ? row.qcStatus === 'LOI' : row.qcStatus !== 'LOI'))

  const summaryRowsAll = buildLocationSummaryRows(qualityFilteredRows)
  const summaryTotalCount = summaryRowsAll.length
  const summaryPageCount = Math.max(Math.ceil(summaryTotalCount / SUMMARY_PAGE_SIZE), 1)
  const currentPage = Math.min(Math.max(filters.page, 1), summaryPageCount)
  const start = (currentPage - 1) * SUMMARY_PAGE_SIZE
  const summaryRows = summaryRowsAll.slice(start, start + SUMMARY_PAGE_SIZE)

  return {
    schemaReady: true,
    filters: {
      ...filters,
      page: currentPage,
    },
    locations,
    summaryRows,
    summaryTotalCount,
    summaryPageCount,
    selectedLocationDetail: buildLocationDetail(qualityFilteredRows, filters.selectedLocationId, filters.serialPage),
  }
}
