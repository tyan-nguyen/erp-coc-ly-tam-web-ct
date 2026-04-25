import type { NextRequest } from 'next/server'

function maskValue(value: string | undefined) {
  if (!value) return ''
  if (value.length <= 12) return `${value.slice(0, 3)}...`
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function getSupabaseHost(value: string | undefined) {
  if (!value) return ''
  try {
    return new URL(value).host
  } catch {
    return 'invalid-url'
  }
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const forwardedProto = request.headers.get('x-forwarded-proto') || ''
  const host = request.headers.get('host') || ''

  return Response.json(
    {
      ok: Boolean(supabaseUrl && supabaseAnonKey),
      server: {
        nodeEnv: process.env.NODE_ENV || '',
        host,
        forwardedProto,
        protocolLooksSecure: forwardedProto ? forwardedProto.includes('https') : request.nextUrl.protocol === 'https:',
        timestamp: new Date().toISOString(),
      },
      env: {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
        supabaseHost: getSupabaseHost(supabaseUrl),
        supabaseAnonKeyPreview: maskValue(supabaseAnonKey),
      },
      hints: {
        productionModeExpected: process.env.NODE_ENV === 'production',
        publicEnvMustExistAtBuildTime: true,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
