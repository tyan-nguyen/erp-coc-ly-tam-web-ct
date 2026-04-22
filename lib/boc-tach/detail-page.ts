import type { SupabaseClient } from '@supabase/supabase-js'
import { mapStoredBocTachToPayload } from '@/lib/boc-tach/stored-payload'
import { loadBocTachDetail, loadBocTachReferenceData } from '@/lib/boc-tach/repository'
import type { BocTachDetailPayload, BocTachReferenceData } from '@/lib/boc-tach/types'

export function createEmptyBocTachReferenceData(): BocTachReferenceData {
  return {
    concreteMixes: [],
    auxiliaryRates: [],
    pileTemplates: [],
    customers: [],
    projects: [],
    materials: [],
    hasFullReferenceData: false,
    vatConfig: {
      coc_vat_pct: 0,
      phu_kien_vat_pct: 0,
    },
    profitRules: [],
    otherCostsByDiameter: [],
  }
}

export function sanitizeBocTachRefsForQlsx(refs: BocTachReferenceData): BocTachReferenceData {
  return {
    ...refs,
    hasFullReferenceData: false,
    materials: refs.materials.map((item) => ({
      ...item,
      don_gia_hien_hanh: 0,
    })),
    vatConfig: {
      coc_vat_pct: 0,
      phu_kien_vat_pct: 0,
    },
    profitRules: [],
    otherCostsByDiameter: [],
  }
}

export async function loadBocTachDetailPageData(input: {
  supabase: SupabaseClient
  bocId: string
  qlsxViewer: boolean
  adminViewer: boolean
}) {
  let refs = createEmptyBocTachReferenceData()
  let payload: BocTachDetailPayload | undefined
  let locked = false

  try {
    refs = await loadBocTachReferenceData(input.supabase, {
      includeFinancialData: input.bocId !== 'new',
    })
  } catch {
    refs = createEmptyBocTachReferenceData()
  }

  if (input.bocId !== 'new') {
    const detail = await loadBocTachDetail(input.supabase, input.bocId)

    if (detail.header) {
      payload = mapStoredBocTachToPayload(input.bocId, detail.header, detail.items, detail.segments, refs)
      const status = String(detail.header.trang_thai || 'NHAP')
      locked =
        input.qlsxViewer ||
        (!input.adminViewer && (status === 'DA_GUI' || status === 'DA_DUYET_QLSX'))
    }
  }

  if (input.qlsxViewer) {
    refs = sanitizeBocTachRefsForQlsx(refs)
  }

  return {
    refs,
    payload,
    locked,
  }
}
