import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessQc } from '@/lib/auth/roles'
import { executeSaveQcIssueMutation, type SaveQcIssueBody } from '@/lib/san-xuat/mutations'
import { refreshFinishedGoodsStockReadModelSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(
  request: Request,
  context: { params: Promise<{ plan_id: string }> }
) {
  try {
    const body = (await request.json()) as SaveQcIssueBody
    const { plan_id: planId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canAccessQc(profile.role)) {
      throw new Error('Chỉ QC hoặc Admin mới được xác nhận nghiệm thu QC.')
    }

    const result = await executeSaveQcIssueMutation({
      supabase,
      planId,
      userId: user.id,
      body,
    })
    await refreshFinishedGoodsStockReadModelSafely(supabase)

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không lưu được phiếu nghiệm thu QC'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
