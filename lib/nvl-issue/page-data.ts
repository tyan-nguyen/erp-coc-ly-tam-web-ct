import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadMaterialIssuePageData,
  loadMaterialIssueVoucherDetail,
} from '@/lib/nvl-issue/repository'

type AnySupabase = SupabaseClient

export async function loadMaterialIssueScreenData(
  supabase: AnySupabase,
  input: { viewerRole: string; selectedVoucherId?: string | null }
) {
  const [pageData, selectedVoucherDetail] = await Promise.all([
    loadMaterialIssuePageData(supabase, input.viewerRole),
    input.selectedVoucherId ? loadMaterialIssueVoucherDetail(supabase, input.selectedVoucherId) : Promise.resolve(null),
  ])

  return {
    pageData,
    selectedVoucherDetail,
  }
}
