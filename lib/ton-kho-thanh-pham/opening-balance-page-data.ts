import type { SupabaseClient } from '@supabase/supabase-js'
import { buildLocationLabel, normalizeText, safeArray } from '@/lib/ton-kho-thanh-pham/internal'
import type {
  FinishedGoodsOpeningBalanceLoaiCocOption,
  FinishedGoodsOpeningBalanceLocationOption,
  FinishedGoodsOpeningBalancePageData,
} from '@/lib/ton-kho-thanh-pham/opening-balance-types'
import { isPileSerialSchemaReady, loadOpeningBalanceLots } from '@/lib/pile-serial/repository'

export async function loadFinishedGoodsOpeningBalancePageData(
  supabase: SupabaseClient
): Promise<FinishedGoodsOpeningBalancePageData> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) {
    return {
      schemaReady: false,
      loaiCocOptions: [],
      locations: [],
      recentLots: [],
    }
  }

  const [{ data: locationRows, error: locationError }, { data: loaiCocRows, error: loaiCocError }, recentLots] = await Promise.all([
    supabase
      .from('warehouse_location')
      .select('location_id, location_code, location_name')
      .eq('is_active', true)
      .order('location_code', { ascending: true }),
    supabase.from('dm_coc_template').select('loai_coc').eq('is_active', true).order('loai_coc', { ascending: true }),
    loadOpeningBalanceLots(supabase),
  ])

  if (locationError) throw locationError
  if (loaiCocError) throw loaiCocError

  const locations: FinishedGoodsOpeningBalanceLocationOption[] = safeArray<Record<string, unknown>>(locationRows).map((row) => {
    const locationCode = normalizeText(row.location_code)
    const locationName = normalizeText(row.location_name)
    return {
      locationId: String(row.location_id || ''),
      locationCode,
      locationName,
      locationLabel: buildLocationLabel(locationCode, locationName),
    }
  })

  const loaiCocOptions: FinishedGoodsOpeningBalanceLoaiCocOption[] = Array.from(
    new Set(
      safeArray<Record<string, unknown>>(loaiCocRows)
        .map((row) => normalizeText(row.loai_coc))
        .filter(Boolean)
    )
  ).map((value) => ({
    value,
    label: value,
  }))

  return {
    schemaReady: true,
    loaiCocOptions,
    locations,
    recentLots,
  }
}
