import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canReceiveExternalPileOrder } from '@/lib/auth/roles'
import {
  executeReceiveExternalPileOrderMutation,
  type ReceiveExternalPileOrderBody,
} from '@/lib/external-pile-procurement/mutations'
import { refreshFinishedGoodsStockReadModelSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(
  request: Request,
  context: { params: Promise<{ po_id: string }> }
) {
  try {
    const { po_id: poId } = await context.params
    const body = (await request.json()) as ReceiveExternalPileOrderBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canReceiveExternalPileOrder(profile.role)) {
      throw new Error('Chỉ Thủ kho hoặc Admin mới được nhập kho cọc ngoài.')
    }

    const result = await executeReceiveExternalPileOrderMutation({
      supabase,
      userId: user.id,
      poId,
      body,
    })
    await refreshFinishedGoodsStockReadModelSafely(supabase)

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không nhập kho được phiếu mua cọc ngoài.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
