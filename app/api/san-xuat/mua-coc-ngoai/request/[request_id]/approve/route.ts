import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canApproveExternalPileRequest } from '@/lib/auth/roles'
import {
  executeApproveExternalPileRequestMutation,
  type ApproveExternalPileRequestBody,
} from '@/lib/external-pile-procurement/mutations'

export async function POST(
  request: Request,
  context: { params: Promise<{ request_id: string }> }
) {
  try {
    const { request_id: requestId } = await context.params
    const body = (await request.json()) as ApproveExternalPileRequestBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canApproveExternalPileRequest(profile.role)) {
      throw new Error('Chỉ KTMH hoặc Admin mới được duyệt và lập phiếu mua cọc ngoài.')
    }

    const result = await executeApproveExternalPileRequestMutation({
      supabase,
      userId: user.id,
      requestId,
      body,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không duyệt được đề xuất mua cọc ngoài.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
