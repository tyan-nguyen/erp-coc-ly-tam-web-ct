import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinishedGoodsCountingPageData } from '@/lib/finished-goods-counting/types'
import { loadFinishedGoodsCountingPageData as loadData } from '@/lib/finished-goods-counting/repository'

export async function loadFinishedGoodsCountingPageData(
  supabase: SupabaseClient
): Promise<FinishedGoodsCountingPageData> {
  return loadData(supabase)
}
