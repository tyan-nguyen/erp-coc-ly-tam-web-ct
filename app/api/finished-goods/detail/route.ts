import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewFinishedGoodsInventory } from '@/lib/auth/roles'
import { loadFinishedGoodsSelectedItemDetail } from '@/lib/ton-kho-thanh-pham/repository'

export async function GET(request: Request) {
  try {
    const { profile } = await getCurrentSessionProfile()

    if (!canViewFinishedGoodsInventory(profile.role)) {
      return NextResponse.json({ ok: false, error: 'Không có quyền xem chi tiết serial.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const supabase = await createClient()
    const result = await loadFinishedGoodsSelectedItemDetail(supabase, {
      scope: searchParams.get('scope') || undefined,
      item: searchParams.get('item') || undefined,
      serial_page: searchParams.get('serial_page') || undefined,
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tải được chi tiết serial.'

    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
