import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedClientAndUser } from '@/lib/auth/session'
import { executeReopenBocTachMutation } from '@/lib/boc-tach/mutations'

export async function POST(
  _request: Request,
  context: { params: Promise<{ boc_id: string }> }
) {
  try {
    const { boc_id: bocId } = await context.params
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const authSupabase = await createClient()

    const { data: profile, error: profileError } = await authSupabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .single<{ role: string; is_active: boolean }>()

    if (profileError || !profile?.is_active) {
      throw new Error('Không xác định được user profile hoạt động')
    }

    const result = await executeReopenBocTachMutation({
      supabase,
      bocId,
      userId: user.id,
      userRole: profile.role,
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
        : 'Không mở lại được bóc tách'

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    )
  }
}
