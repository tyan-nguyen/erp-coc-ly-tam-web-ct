import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  WarehouseLocationAssignmentPageData,
  WarehouseLocationOption,
} from '@/lib/ton-kho-thanh-pham/location-assignment-types'
import { buildLocationLabel, isMissingRelationError, normalizeText, safeArray } from '@/lib/ton-kho-thanh-pham/internal'

async function isLocationAssignmentSchemaReady(supabase: SupabaseClient) {
  const { error } = await supabase.from('warehouse_location').select('location_id').limit(1)
  if (!error) return true
  if (isMissingRelationError(error, 'warehouse_location')) return false
  throw error
}

export async function loadWarehouseLocationAssignmentPageData(
  supabase: SupabaseClient
): Promise<WarehouseLocationAssignmentPageData> {
  const schemaReady = await isLocationAssignmentSchemaReady(supabase)
  if (!schemaReady) {
    return {
      schemaReady: false,
      locations: [],
    }
  }

  const { data, error } = await supabase
    .from('warehouse_location')
    .select('location_id, location_code, location_name')
    .eq('is_active', true)
    .order('location_code', { ascending: true })

  if (error) throw error

  const locations: WarehouseLocationOption[] = safeArray<Record<string, unknown>>(data).map((row) => {
    const locationCode = normalizeText(row.location_code)
    const locationName = normalizeText(row.location_name)
    return {
      locationId: String(row.location_id || ''),
      locationCode,
      locationName,
      locationLabel: buildLocationLabel(locationCode, locationName),
    }
  })

  return {
    schemaReady: true,
    locations,
  }
}
