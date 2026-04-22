import type { SupabaseClient } from '@supabase/supabase-js'
import type { WarehouseLocationPageData } from '@/lib/ton-kho-thanh-pham/location-types'
import { loadWarehouseLocationPageData as loadWarehouseLocationRepositoryPageData } from '@/lib/ton-kho-thanh-pham/location-repository'

export async function loadWarehouseLocationPageData(
  supabase: SupabaseClient,
  rawFilters: Partial<Record<'q' | 'page' | 'location' | 'serial_page' | 'quality', string | string[] | undefined>>
): Promise<WarehouseLocationPageData> {
  return loadWarehouseLocationRepositoryPageData(supabase, rawFilters)
}
