import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { createMaterialIssueVoucher } from '@/lib/nvl-issue/repository'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      issueKind: 'BAN_VAT_TU' | 'DIEU_CHUYEN'
      khId?: string
      daId?: string
      note?: string
      lines: Array<{ rowId: string; materialCode: string; requestedQty: number; unitPrice: number; note: string }>
    }
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    const result = await createMaterialIssueVoucher({
      supabase,
      userId: user.id,
      viewerRole: profile.role,
      issueKind: body.issueKind,
      khId: body.khId,
      daId: body.daId,
      note: body.note,
      lines: body.lines,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tạo được phiếu xuất NVL.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
