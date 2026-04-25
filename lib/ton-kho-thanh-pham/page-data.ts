import type { SupabaseClient } from '@supabase/supabase-js'
import { loadFinishedGoodsInventoryPageData as loadFinishedGoodsInventoryRepositoryPageData } from '@/lib/ton-kho-thanh-pham/repository'
import type { FinishedGoodsInventoryPageData } from '@/lib/ton-kho-thanh-pham/types'

type SearchParamInput = Partial<Record<'q' | 'scope' | 'page' | 'item' | 'serial_page', string | string[] | undefined>>

type AnySupabase = SupabaseClient

export async function loadFinishedGoodsInventoryPageData(
  supabase: AnySupabase,
  rawFilters: SearchParamInput
): Promise<FinishedGoodsInventoryPageData> {
  return loadFinishedGoodsInventoryRepositoryPageData(supabase, rawFilters)
}
