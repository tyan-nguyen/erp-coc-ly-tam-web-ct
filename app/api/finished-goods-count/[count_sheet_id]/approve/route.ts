import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canApproveFinishedGoodsCount } from '@/lib/auth/roles'
import { executeApproveFinishedGoodsCountMutation } from '@/lib/finished-goods-counting/mutations'
import { refreshFinishedGoodsStockReadModelSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(
  _request: Request,
  context: { params: Promise<{ count_sheet_id: string }> }
) {
  try {
    const { count_sheet_id: countSheetId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canApproveFinishedGoodsCount(profile.role)) {
      throw new Error('Chỉ Admin mới được duyệt chênh lệch kiểm kê cọc.')
    }

    const detail = await executeApproveFinishedGoodsCountMutation({
      supabase,
      userId: user.id,
      countSheetId,
    })
    await refreshFinishedGoodsStockReadModelSafely(supabase)

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không duyệt được chênh lệch kiểm kê cọc.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
