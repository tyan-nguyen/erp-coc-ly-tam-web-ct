import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canConfirmInventoryCount } from '@/lib/auth/roles'
import { executeConfirmInventoryCountMutation } from '@/lib/inventory-counting/mutations'
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

    if (!canConfirmInventoryCount(profile.role)) {
      throw new Error('Chỉ Thủ kho hoặc Admin mới được xác nhận kho cho phiếu kiểm kê.')
    }

    const detail = await executeConfirmInventoryCountMutation({
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
          : 'Không xác nhận kho được phiếu kiểm kê.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
