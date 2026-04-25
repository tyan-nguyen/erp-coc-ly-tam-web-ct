import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { confirmMaterialIssueVoucher } from '@/lib/nvl-issue/repository'
import { refreshNvlStockReadModelSafely } from '@/lib/stock-read-model/auto-refresh'

export async function POST(
  request: Request,
  context: { params: Promise<{ voucher_id: string }> }
) {
  try {
    const { voucher_id: voucherId } = await context.params
    const body = (await request.json()) as {
      note?: string
      lines: Array<{ voucherLineId: string; actualQty: number }>
    }
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    const result = await confirmMaterialIssueVoucher({
      supabase,
      userId: user.id,
      viewerRole: profile.role,
      voucherId,
      note: body.note,
      lines: body.lines,
    })
    await refreshNvlStockReadModelSafely(supabase)

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không xác nhận được phiếu xuất NVL.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
