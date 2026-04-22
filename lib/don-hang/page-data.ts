import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { loadActorDisplayMap, loadDonHangDetail, loadDonHangList } from '@/lib/don-hang/repository'

type AnySupabase = SupabaseClient

export async function loadDonHangListPageData(
  supabase: AnySupabase,
  input: {
    query?: string
    trangThai?: string
    viewerRole?: string | null
  }
) {
  const rows = await loadDonHangList(supabase, {
    query: input.query,
    trangThai: input.trangThai,
    viewerRole: input.viewerRole,
  })

  return { rows }
}

export async function loadDonHangDetailPageData(
  supabase: AnySupabase,
  input: { orderId: string }
) {
  const detail = await loadDonHangDetail(supabase, input.orderId)
  if (!detail) notFound()

  const actorDisplayMap = Object.fromEntries(await loadActorDisplayMap(supabase, detail.timeline))

  return {
    detail,
    actorDisplayMap,
  }
}
