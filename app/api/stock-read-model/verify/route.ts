import { NextResponse } from 'next/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isAdminRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import {
  refreshFinishedGoodsStockReadModel,
  verifyFinishedGoodsStockReadModel,
} from '@/lib/ton-kho-thanh-pham/repository'
import { refreshNvlStockReadModel, verifyNvlStockReadModel } from '@/lib/nvl-stock/page-data'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { profile } = await getCurrentSessionProfile()
    if (!isAdminRole(profile.role)) {
      return NextResponse.json({ ok: false, error: 'Chỉ admin được rebuild read model tồn kho.' }, { status: 403 })
    }

    const supabase = await createClient()

    await refreshFinishedGoodsStockReadModel(supabase)
    const finishedGoods = await verifyFinishedGoodsStockReadModel(supabase)

    await refreshNvlStockReadModel(supabase)
    const nvlStock = await verifyNvlStockReadModel(supabase)

    return NextResponse.json({
      ok: true,
      data: {
        finishedGoods,
        nvlStock,
        switched:
          finishedGoods.matched && nvlStock.matched
            ? 'verified_read_models_enabled'
            : 'legacy_fallback_kept',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không rebuild/verify được read model tồn kho.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
