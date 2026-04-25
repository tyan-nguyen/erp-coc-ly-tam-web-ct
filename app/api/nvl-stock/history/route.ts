import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlStockTruth } from '@/lib/auth/roles'
import { loadNvlStockMovementHistoryPageData } from '@/lib/nvl-stock/page-data'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { profile } = await getCurrentSessionProfile()

    if (!canAccessNvlStockTruth(profile.role)) {
      return NextResponse.json({ ok: false, error: 'Không có quyền xem tồn thực NVL.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const materialCode = String(searchParams.get('materialCode') || '').trim()

    if (!materialCode) {
      return NextResponse.json({ ok: false, error: 'Thiếu mã NVL.' }, { status: 400 })
    }

    const pageData = await loadNvlStockMovementHistoryPageData({
      supabase,
      materialCode,
    })

    return NextResponse.json({ ok: true, data: pageData })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Không tải được lịch sử tồn NVL.',
      },
      { status: 500 }
    )
  }
}
