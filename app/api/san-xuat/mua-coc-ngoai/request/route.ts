import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { canCreateExternalPileRequest } from '@/lib/auth/roles'
import {
  executeCreateExternalPileRequestMutation,
  type CreateExternalPileRequestBody,
} from '@/lib/external-pile-procurement/mutations'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateExternalPileRequestBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    if (!canCreateExternalPileRequest(profile.role)) {
      throw new Error('Chỉ QLSX hoặc Admin mới được tạo đề xuất mua cọc ngoài.')
    }

    const result = await executeCreateExternalPileRequestMutation({
      supabase,
      userId: user.id,
      body,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tạo được đề xuất mua cọc ngoài.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
