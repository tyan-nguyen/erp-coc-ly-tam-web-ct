import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedClientAndUser } from '@/lib/auth/session'
import {
  executeDonHangTransitionMutation,
  type DonHangTransitionRequestBody,
} from '@/lib/don-hang/mutations'

export async function POST(
  request: Request,
  context: { params: Promise<{ order_id: string }> }
) {
  try {
    const { order_id: orderId } = await context.params
    const body = (await request.json()) as DonHangTransitionRequestBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const authSupabase = await createClient()

    const { data: profile, error: profileError } = await authSupabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .single<{ role: string; is_active: boolean }>()

    if (profileError || !profile?.is_active) {
      throw new Error('Khong xac dinh duoc user profile hoat dong')
    }

    const result = await executeDonHangTransitionMutation({
      supabase,
      orderId,
      userId: user.id,
      userRole: profile.role,
      body,
    })

    return NextResponse.json({
      ok: true,
      data: result,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Khong chuyen trang thai duoc'

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    )
  }
}
