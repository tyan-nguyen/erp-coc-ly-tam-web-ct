import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canApproveInventoryCount } from '@/lib/auth/roles'
import { executeApproveInventoryCountMutation } from '@/lib/inventory-counting/mutations'
import { refreshNvlStockReadModelSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(
  request: Request,
  context: { params: Promise<{ count_sheet_id: string }> }
) {
  try {
    const { count_sheet_id: countSheetId } = await context.params
    const body = (await request.json()) as { countSheetId?: string }
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canApproveInventoryCount(profile.role)) {
      throw new Error('Chỉ KTMH hoặc Admin mới được duyệt chênh lệch kiểm kê.')
    }

    const detail = await executeApproveInventoryCountMutation({
      supabase,
      userId: user.id,
      countSheetId,
      body,
    })
    await refreshNvlStockReadModelSafely(supabase)

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không duyệt được chênh lệch kiểm kê.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
