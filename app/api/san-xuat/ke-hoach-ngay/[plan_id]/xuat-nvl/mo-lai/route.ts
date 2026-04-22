import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { isAdminRole } from '@/lib/auth/roles'
import { executeReopenWarehouseIssueMutation } from '@/lib/san-xuat/mutations'
import { refreshAllStockReadModelsSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(
  _request: Request,
  context: { params: Promise<{ plan_id: string }> }
) {
  try {
    const { plan_id: planId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!isAdminRole(profile.role)) {
      throw new Error('Chỉ Admin mới được mở lại phiếu thực sản xuất và xuất NVL.')
    }

    const result = await executeReopenWarehouseIssueMutation({
      supabase,
      planId,
      userId: user.id,
    })
    await refreshAllStockReadModelsSafely(supabase)

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không mở lại được phiếu thực sản xuất và xuất NVL'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
