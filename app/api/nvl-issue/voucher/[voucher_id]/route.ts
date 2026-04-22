import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewMaterialIssue } from '@/lib/auth/roles'
import { loadMaterialIssueVoucherDetail } from '@/lib/nvl-issue/repository'

export async function GET(
  _request: Request,
  context: { params: Promise<{ voucher_id: string }> }
) {
  try {
    const { voucher_id: voucherId } = await context.params
    const { profile } = await getCurrentSessionProfile()

    if (!canViewMaterialIssue(profile.role)) {
      return NextResponse.json({ ok: false, error: 'Không có quyền xem phiếu xuất NVL.' }, { status: 403 })
    }

    const supabase = await createClient()
    const detail = await loadMaterialIssueVoucherDetail(supabase, voucherId)
    if (!detail) {
      return NextResponse.json({ ok: false, error: 'Không tìm thấy phiếu xuất NVL.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, data: detail })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được chi tiết phiếu xuất NVL.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
