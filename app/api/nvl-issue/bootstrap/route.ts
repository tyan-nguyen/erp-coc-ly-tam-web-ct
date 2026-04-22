import { NextResponse } from 'next/server'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { loadMaterialIssueCreateBootstrap } from '@/lib/nvl-issue/repository'

export async function GET() {
  try {
    const { supabase } = await getAuthenticatedClientAndUser()
    const { profile } = await getCurrentSessionProfile()
    const data = await loadMaterialIssueCreateBootstrap(supabase, profile.role)

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được dữ liệu lập phiếu xuất NVL.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
