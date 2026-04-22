import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser } from '@/lib/auth/session'
import { executeBulkDeleteBocTachMutation } from '@/lib/boc-tach/mutations'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] }
    const ids = Array.isArray(body.ids) ? body.ids : []

    const { supabase } = await getAuthenticatedClientAndUser()
    const result = await executeBulkDeleteBocTachMutation({
      supabase,
      ids,
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
          : 'Không xóa được hồ sơ bóc tách'

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    )
  }
}
