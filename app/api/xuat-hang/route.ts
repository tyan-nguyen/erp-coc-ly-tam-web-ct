import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import {
  executeCreateXuatHangVoucherMutation,
  executeDeleteXuatHangVoucherMutation,
  type CreateXuatHangVoucherBody,
  type DeleteXuatHangVoucherBody,
} from '@/lib/xuat-hang/mutations'
import { loadXuatHangCreateBootstrapPageData } from '@/lib/xuat-hang/page-data'

export async function GET(request: Request) {
  try {
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()
    const modeParam = new URL(request.url).searchParams.get('mode')
    const mode = modeParam === 'DON_HANG' || modeParam === 'TON_KHO' ? modeParam : 'ALL'
    const data = await loadXuatHangCreateBootstrapPageData(supabase, {
      viewerRole: profile.role,
      mode,
    })
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Không tải được dữ liệu lập phiếu xuất hàng'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateXuatHangVoucherBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    const result = await executeCreateXuatHangVoucherMutation({
      supabase,
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
          : 'Không tạo được phiếu xuất hàng'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as DeleteXuatHangVoucherBody
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()

    const result = await executeDeleteXuatHangVoucherMutation({
      supabase,
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
          : 'Không xóa được phiếu xuất hàng'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
