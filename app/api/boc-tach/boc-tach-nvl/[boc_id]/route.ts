import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser } from '@/lib/auth/session'
import {
  executeSaveBocTachMutation,
  type SaveBocTachMutationBody,
} from '@/lib/boc-tach/mutations'

export async function POST(
  request: Request,
  context: { params: Promise<{ boc_id: string }> }
) {
  try {
    const { boc_id: routeBocId } = await context.params
    const body = (await request.json()) as SaveBocTachMutationBody

    const { user, supabase } = await getAuthenticatedClientAndUser()
    const result = await executeSaveBocTachMutation({
      supabase,
      userId: user.id,
      routeBocId,
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
        : 'Khong luu duoc boc tach'
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    )
  }
}
