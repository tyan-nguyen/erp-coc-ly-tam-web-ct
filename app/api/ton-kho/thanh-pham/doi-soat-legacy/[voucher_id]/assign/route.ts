import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import {
  executeLegacyReconciliationAssignMutation,
} from '@/lib/ton-kho-thanh-pham/reconciliation-mutations'
import type { LegacyReconciliationAssignmentBody } from '@/lib/ton-kho-thanh-pham/reconciliation-types'

export async function POST(
  request: Request,
  context: { params: Promise<{ voucher_id: string }> }
) {
  try {
    const body = (await request.json()) as LegacyReconciliationAssignmentBody
    const { voucher_id: voucherId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    const result = await executeLegacyReconciliationAssignMutation({
      supabase,
      voucherId,
      userId: user.id,
      userRole: profile.role,
      body,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không đối soát được serial legacy'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
