import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { mapStoredBocTachToPayload } from '@/lib/boc-tach/stored-payload'
import { loadBocTachDetail, loadBocTachReferenceData } from '@/lib/boc-tach/repository'
import { buildQuoteEstimateSummary, getTransportQuoteCopy } from '@/lib/bao-gia/quote'
import { loadBaoGiaDetail, loadBaoGiaList } from '@/lib/bao-gia/repository'

type AnySupabase = SupabaseClient

const ADDRESS_NOTE_PREFIX = '[VI_TRI_CONG_TRINH]:'
const AREA_NOTE_PREFIX = '[KHU_VUC]:'

export async function loadBaoGiaListPageData(supabase: AnySupabase) {
  const rows = await loadBaoGiaList(supabase)
  return { rows }
}

export async function loadLapBaoGiaPageData(supabase: AnySupabase, ids: string[]) {
  if (ids.length === 0) {
    notFound()
  }

  const refs = await loadBocTachReferenceData(supabase)
  const details = await Promise.all(ids.map((id) => loadBocTachDetail(supabase, id)))
  const validDetails = details.filter((detail) => detail.header)

  if (validDetails.length === 0) {
    notFound()
  }

  const estimates = validDetails.map((detail) => {
    const header = detail.header as Record<string, unknown>
    const payload = mapStoredBocTachToPayload(
      String(header.boc_id ?? header.boc_tach_id ?? header.id ?? ''),
      header,
      detail.items,
      detail.segments,
      refs
    )
    const summary = buildQuoteEstimateSummary(payload, refs)
    return {
      ...summary,
      daId: String(header.da_id ?? ''),
      khId: String(header.kh_id ?? ''),
    }
  })

  const first = estimates[0]
  const sameScope = estimates.every(
    (item) =>
      item.daId === first.daId &&
      item.khId === first.khId &&
      item.phuongThucVanChuyen === first.phuongThucVanChuyen
  )

  const project = refs.projects.find((item) => item.da_id === first.daId) || null
  const customer = refs.customers.find((item) => item.kh_id === first.khId) || null
  const projectLocation = cleanProjectLocation(String(project?.vi_tri_cong_trinh || ''))
  const projectLabel = project?.ten_da
    ? `${project.ten_da}${projectLocation ? ` - tại ${projectLocation}` : ''}`
    : 'công trình'

  return {
    refs,
    estimates,
    sameScope,
    customerName: customer?.ten_kh || 'Chưa có khách hàng',
    projectName: project?.ten_da || 'Chưa có dự án',
    sourceEstimateIds: ids,
    projectLabel,
    firstTransportMode: first.phuongThucVanChuyen,
    accessoryOptions: refs.materials
      .filter((item) => String(item.nhom_hang || '').trim().toUpperCase() === 'PHU_KIEN')
      .map((item) => ({
        value: item.nvl_id,
        label: item.ten_hang,
        dvt: item.dvt || 'cái',
        price: Number(item.don_gia_hien_hanh || 0),
      })),
    transportCopy: getTransportQuoteCopy(first.phuongThucVanChuyen, projectLabel),
  }
}

export async function loadBaoGiaDetailPageData(
  supabase: AnySupabase,
  input: { quoteId: string; requestedVersionNo: number }
) {
  const [detail, refs] = await Promise.all([
    loadBaoGiaDetail(supabase, input.quoteId),
    loadBocTachReferenceData(supabase),
  ])

  if (!detail) notFound()

  const selectedVersion =
    input.requestedVersionNo > 0
      ? detail.versions.find((version) => version.version_no === input.requestedVersionNo) ||
        detail.latestVersion
      : detail.latestVersion
  const isHistoricalView =
    selectedVersion.version_no > 0 && selectedVersion.version_no !== detail.quote.current_version_no

  let fallbackEstimates: Array<
    ReturnType<typeof buildQuoteEstimateSummary> & {
      daId: string
      khId: string
    }
  > = []
  let fallbackTransportCopy: string[] = []

  if (detail.versions.length === 0 && detail.estimateIds.length > 0) {
    const bocDetails = await Promise.all(detail.estimateIds.map((id) => loadBocTachDetail(supabase, id)))
    const validDetails = bocDetails.filter((item) => item.header)
    fallbackEstimates = validDetails.map((item) => {
      const header = item.header as Record<string, unknown>
      const payload = mapStoredBocTachToPayload(
        String(header.boc_id ?? header.boc_tach_id ?? header.id ?? ''),
        header,
        item.items,
        item.segments,
        refs
      )
      const summary = buildQuoteEstimateSummary(payload, refs)
      return {
        ...summary,
        daId: String(header.da_id ?? ''),
        khId: String(header.kh_id ?? ''),
      }
    })
    const transportMode = fallbackEstimates[0]?.phuongThucVanChuyen || detail.quote.phuong_thuc_van_chuyen
    const project = refs.projects.find((item) => item.da_id === detail.quote.da_id) || null
    const projectLocation = cleanProjectLocation(String(project?.vi_tri_cong_trinh || ''))
    const projectLabel = project?.ten_da
      ? `${project.ten_da}${projectLocation ? ` - tại ${projectLocation}` : ''}`
      : detail.duAn || 'công trình'
    fallbackTransportCopy = getTransportQuoteCopy(transportMode, projectLabel)
  }

  return {
    detail,
    refs,
    selectedVersion,
    isHistoricalView,
    fallbackEstimates,
    fallbackTransportCopy,
    accessoryOptions: refs.materials
      .filter((item) => String(item.nhom_hang || '').trim().toUpperCase() === 'PHU_KIEN')
      .map((item) => ({
        value: item.nvl_id,
        label: item.ten_hang,
        dvt: item.dvt || 'cái',
        price: Number(item.don_gia_hien_hanh || 0),
      })),
  }
}

function cleanProjectLocation(value: string | null | undefined) {
  const cleaned = String(value || '')
    .replaceAll(ADDRESS_NOTE_PREFIX, '')
    .replaceAll(AREA_NOTE_PREFIX, '')
    .split('\n')
    .map((item) => collapseRepeatedTail(item.trim()))
    .filter(Boolean)
    .join(', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*([^,]+),\s*\1$/u, ', $1')
    .trim()

  return cleaned
}

function collapseRepeatedTail(value: string) {
  const parts = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (parts.length === 0) return ''
  const last = parts[parts.length - 1]
  const dedupedLast = dedupeRepeatedWords(last)
  return [...parts.slice(0, -1), dedupedLast].join(', ')
}

function dedupeRepeatedWords(value: string) {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2
    const left = words.slice(0, half).join(' ')
    const right = words.slice(half).join(' ')
    if (left.localeCompare(right, 'vi', { sensitivity: 'accent' }) === 0) {
      return left
    }
  }
  return words.join(' ')
}
