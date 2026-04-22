import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadLegacyReconciliationDetailPageData as loadLegacyReconciliationRepositoryDetailPageData,
  loadLegacyReconciliationPageData as loadLegacyReconciliationRepositoryPageData,
} from '@/lib/ton-kho-thanh-pham/reconciliation-repository'
import type {
  LegacyReconciliationDetailPageData,
  LegacyReconciliationPageData,
} from '@/lib/ton-kho-thanh-pham/reconciliation-types'

type SearchParamInput = Partial<Record<'q' | 'page', string | string[] | undefined>>

type AnySupabase = SupabaseClient

export async function loadLegacyReconciliationPageData(
  supabase: AnySupabase,
  rawFilters: SearchParamInput
): Promise<LegacyReconciliationPageData> {
  return loadLegacyReconciliationRepositoryPageData(supabase, rawFilters)
}

export async function loadLegacyReconciliationDetailPageData(
  supabase: AnySupabase,
  voucherId: string
): Promise<LegacyReconciliationDetailPageData | null> {
  return loadLegacyReconciliationRepositoryDetailPageData(supabase, voucherId)
}
