import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import {
  loadKeHoachNgayDetail,
  loadKeHoachNgayDraftSegments,
  loadKeHoachNgayList,
  loadKeHoachScheduleSummary,
  loadQcNghiemThuDetail,
  loadQcPlanList,
} from '@/lib/san-xuat/repository'

type AnySupabase = SupabaseClient

export async function loadKeHoachNgayListPageData(
  supabase: AnySupabase,
  input: {
    viewerRole: string
    selectedPlanId?: string | null
    fromDate: string
    toDate: string
  }
) {
  const [rows, selectedPlanDetail, scheduleSummary, draftSegments] = await Promise.all([
    loadKeHoachNgayList(supabase, input.viewerRole),
    input.selectedPlanId
      ? loadKeHoachNgayDetail(supabase, input.selectedPlanId, input.viewerRole)
      : Promise.resolve(null),
    loadKeHoachScheduleSummary(supabase, input.viewerRole, input.fromDate, input.toDate),
    loadKeHoachNgayDraftSegments(supabase, input.viewerRole),
  ])

  return {
    rows,
    selectedPlanDetail,
    scheduleSummary,
    draftSegments,
  }
}

export async function loadKeHoachNgayDetailPageData(
  supabase: AnySupabase,
  input: { planId: string; viewerRole: string }
) {
  const detail = await loadKeHoachNgayDetail(supabase, input.planId, input.viewerRole)
  if (!detail) notFound()
  return { detail }
}

export async function loadQcNghiemThuPageData(
  supabase: AnySupabase,
  input: { viewerRole: string; selectedPlanId?: string | null }
) {
  const [rows, selectedPlanDetail] = await Promise.all([
    loadQcPlanList(supabase, input.viewerRole),
    input.selectedPlanId
      ? loadQcNghiemThuDetail(supabase, input.selectedPlanId, input.viewerRole)
      : Promise.resolve(null),
  ])

  return {
    rows,
    selectedPlanDetail,
  }
}

export async function loadQcNghiemThuDetailPageData(
  supabase: AnySupabase,
  input: { planId: string; viewerRole: string }
) {
  const detail = await loadQcNghiemThuDetail(supabase, input.planId, input.viewerRole)
  if (!detail) notFound()
  return { detail }
}
