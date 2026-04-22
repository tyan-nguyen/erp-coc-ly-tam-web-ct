import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const isPrefetch =
    request.headers.has('next-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch'
  if (isPrefetch) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl
  const isProtectedPath =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/master-data' ||
    pathname.startsWith('/master-data/') ||
    pathname === '/boc-tach' ||
    pathname.startsWith('/boc-tach/') ||
    pathname === '/me'

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes('-auth-token'))

  if (isProtectedPath && !hasAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/dashboard/:path*',
    '/master-data/:path*',
    '/boc-tach/:path*',
    '/me',
  ],
}
