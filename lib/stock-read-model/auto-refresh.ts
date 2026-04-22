import type { SupabaseClient } from '@supabase/supabase-js'
import {
  refreshFinishedGoodsStockReadModel,
  verifyFinishedGoodsStockReadModel,
} from '@/lib/ton-kho-thanh-pham/repository'
import { refreshNvlStockReadModel, verifyNvlStockReadModel } from '@/lib/nvl-stock/page-data'

type AnySupabase = SupabaseClient
const ENABLE_STOCK_READ_MODEL_AUTO_REFRESH = process.env.STOCK_READ_MODEL_AUTO_REFRESH === 'true'

export async function refreshFinishedGoodsStockReadModelSafely(supabase: AnySupabase) {
  if (!ENABLE_STOCK_READ_MODEL_AUTO_REFRESH) return null

  try {
    await refreshFinishedGoodsStockReadModel(supabase)
    return await verifyFinishedGoodsStockReadModel(supabase)
  } catch (error) {
    console.error('Không tự refresh được read model tồn thành phẩm.', error)
    return null
  }
}

export async function refreshNvlStockReadModelSafely(supabase: AnySupabase) {
  if (!ENABLE_STOCK_READ_MODEL_AUTO_REFRESH) return null

  try {
    await refreshNvlStockReadModel(supabase)
    return await verifyNvlStockReadModel(supabase)
  } catch (error) {
    console.error('Không tự refresh được read model tồn NVL.', error)
    return null
  }
}

export async function refreshAllStockReadModelsSafely(supabase: AnySupabase) {
  const [finishedGoods, nvlStock] = await Promise.all([
    refreshFinishedGoodsStockReadModelSafely(supabase),
    refreshNvlStockReadModelSafely(supabase),
  ])

  return { finishedGoods, nvlStock }
}
