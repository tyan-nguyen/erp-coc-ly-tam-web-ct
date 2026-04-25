import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canSaveProductionActual } from '@/lib/auth/roles'
import { executeSaveWarehouseIssueMutation, type WarehouseIssueBody } from '@/lib/san-xuat/mutations'
import { refreshAllStockReadModelsSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(
  request: Request,
  context: { params: Promise<{ plan_id: string }> }
) {
  try {
    const body = (await request.json()) as WarehouseIssueBody
    const { plan_id: planId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canSaveProductionActual(profile.role)) {
      throw new Error('Chỉ Thủ kho hoặc Admin mới được xác nhận thực sản xuất và xuất NVL.')
    }

    const result = await executeSaveWarehouseIssueMutation({
      supabase,
      planId,
      userId: user.id,
      body,
    })
    await refreshAllStockReadModelsSafely(supabase)

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không lưu được phiếu xuất NVL sản xuất'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
