import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { loadExternalPileOrderDetail, loadExternalPileProcurementPageData } from '@/lib/external-pile-procurement/repository'

type AnySupabase = SupabaseClient

export async function loadExternalPileProcurementScreenData(supabase: AnySupabase) {
  return loadExternalPileProcurementPageData(supabase)
}

export async function loadExternalPileProcurementOrderDetailPageData(
  supabase: AnySupabase,
  input: { poId: string }
) {
  const detail = await loadExternalPileOrderDetail(supabase, input.poId)
  if (!detail) notFound()
  return { detail }
}
