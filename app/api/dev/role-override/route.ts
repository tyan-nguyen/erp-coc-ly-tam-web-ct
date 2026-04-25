import { NextResponse } from 'next/server'
import { DEV_ROLE_OVERRIDE_COOKIE, getCurrentSessionProfile } from '@/lib/auth/session'
import { isAdminRole, normalizeRole } from '@/lib/auth/roles'

export async function POST(request: Request) {
  const { profile } = await getCurrentSessionProfile()
  if (process.env.NODE_ENV === 'production' || !isAdminRole(profile.original_role || profile.role)) {
    return NextResponse.json({ ok: false, error: 'Không cho phép giả lập role ở môi trường này.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { role?: string }
  const nextRole = normalizeRole(body.role || '')
  const response = NextResponse.json({ ok: true, role: nextRole || null })

  if (!nextRole) {
    response.cookies.delete(DEV_ROLE_OVERRIDE_COOKIE)
  } else {
    response.cookies.set(DEV_ROLE_OVERRIDE_COOKIE, nextRole, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
    })
  }

  return response
}
