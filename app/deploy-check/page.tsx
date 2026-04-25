'use client'

import { useEffect, useMemo, useState } from 'react'

type DeployHealth = {
  ok: boolean
  server: {
    nodeEnv: string
    host: string
    forwardedProto: string
    protocolLooksSecure: boolean
    timestamp: string
  }
  env: {
    hasSupabaseUrl: boolean
    hasSupabaseAnonKey: boolean
    supabaseHost: string
    supabaseAnonKeyPreview: string
  }
  hints: {
    productionModeExpected: boolean
    publicEnvMustExistAtBuildTime: boolean
  }
}

type CheckStatus = 'checking' | 'ok' | 'warn' | 'fail'

function getStatusLabel(status: CheckStatus) {
  if (status === 'checking') return 'Đang kiểm tra'
  if (status === 'ok') return 'OK'
  if (status === 'warn') return 'Cần xem'
  return 'Lỗi'
}

function StatusRow(props: { label: string; status: CheckStatus; detail: string }) {
  const color =
    props.status === 'ok'
      ? '#047857'
      : props.status === 'warn'
        ? '#b45309'
        : props.status === 'fail'
          ? '#b91c1c'
          : '#475569'

  return (
    <div className="rounded-2xl border bg-white px-4 py-3" style={{ borderColor: '#e2e8f0' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold text-slate-900">{props.label}</div>
        <div className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: `${color}18`, color }}>
          {getStatusLabel(props.status)}
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-600">{props.detail}</div>
    </div>
  )
}

export default function DeployCheckPage() {
  const [hydrated, setHydrated] = useState(false)
  const [health, setHealth] = useState<DeployHealth | null>(null)
  const [healthError, setHealthError] = useState('')
  const [clicked, setClicked] = useState(false)

  useEffect(() => {
    setHydrated(true)

    async function loadHealth() {
      try {
        const response = await fetch('/api/deploy-health', { cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        setHealth((await response.json()) as DeployHealth)
      } catch (error) {
        setHealthError(error instanceof Error ? error.message : 'Không gọi được API deploy-health.')
      }
    }

    void loadHealth()
  }, [])

  const clientEnv = useMemo(
    () => ({
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseHost: (() => {
        const value = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!value) return ''
        try {
          return new URL(value).host
        } catch {
          return 'invalid-url'
        }
      })(),
    }),
    []
  )

  const clientEnvOk = clientEnv.hasSupabaseUrl && clientEnv.hasSupabaseAnonKey
  const serverEnvOk = Boolean(health?.env.hasSupabaseUrl && health.env.hasSupabaseAnonKey)
  const productionModeOk = health ? health.server.nodeEnv === 'production' : false

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">ERP Deploy Check</div>
          <h1 className="mt-2 text-3xl font-bold">Kiểm tra lỗi deploy</h1>
          <p className="mt-2 text-sm text-slate-600">
            Màn này dùng để IT mở trực tiếp trên tên miền và xác định lỗi nằm ở JavaScript, chế độ chạy server, proxy HTTPS, hay biến Supabase.
          </p>
        </div>

        <StatusRow
          label="Hydration JavaScript"
          status={hydrated ? 'ok' : 'fail'}
          detail={
            hydrated
              ? 'React client đã chạy. Nếu nút login vẫn khóa, lỗi không phải do JS bundle chết hoàn toàn.'
              : 'Nếu dòng này không đổi sang OK sau vài giây, domain đang không tải/chạy được JS từ /_next/static.'
          }
        />

        <StatusRow
          label="Nút test client"
          status={clicked ? 'ok' : 'checking'}
          detail={clicked ? 'Click handler hoạt động.' : 'Bấm nút bên dưới. Nếu bấm không đổi trạng thái, JavaScript hoặc overlay/proxy đang lỗi.'}
        />

        <button
          type="button"
          onClick={() => setClicked(true)}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Test click
        </button>

        <StatusRow
          label="Server mode"
          status={!health && !healthError ? 'checking' : productionModeOk ? 'ok' : 'fail'}
          detail={
            health
              ? `NODE_ENV=${health.server.nodeEnv || '(trống)'}. Production đúng phải là production, không được là development.`
              : healthError || 'Đang gọi /api/deploy-health...'
          }
        />

        <StatusRow
          label="Supabase env trên server"
          status={!health && !healthError ? 'checking' : serverEnvOk ? 'ok' : 'fail'}
          detail={
            health
              ? `URL=${health.env.hasSupabaseUrl ? health.env.supabaseHost : 'thiếu'}, ANON=${health.env.hasSupabaseAnonKey ? health.env.supabaseAnonKeyPreview : 'thiếu'}`
              : healthError || 'Đang kiểm tra biến môi trường server...'
          }
        />

        <StatusRow
          label="Supabase env trên browser"
          status={clientEnvOk ? 'ok' : 'fail'}
          detail={`URL=${clientEnv.hasSupabaseUrl ? clientEnv.supabaseHost : 'thiếu'}, ANON=${clientEnv.hasSupabaseAnonKey ? 'có' : 'thiếu'}. Biến NEXT_PUBLIC phải có trước khi npm run build.`}
        />

        <StatusRow
          label="HTTPS/proxy"
          status={!health && !healthError ? 'checking' : health?.server.protocolLooksSecure ? 'ok' : 'warn'}
          detail={
            health
              ? `Host=${health.server.host || '-'}, x-forwarded-proto=${health.server.forwardedProto || '(không có)'}. Nếu chạy qua nginx HTTPS, nên forward header này đúng.`
              : healthError || 'Đang kiểm tra header proxy...'
          }
        />

        <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
          {JSON.stringify({ clientEnv, health, healthError }, null, 2)}
        </pre>
      </div>
    </main>
  )
}
