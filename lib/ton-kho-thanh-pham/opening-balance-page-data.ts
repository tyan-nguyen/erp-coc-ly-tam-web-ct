import type { SupabaseClient } from '@supabase/supabase-js'
import { buildLocationLabel, normalizeText, safeArray } from '@/lib/ton-kho-thanh-pham/internal'
import type {
  FinishedGoodsOpeningBalanceLoaiCocOption,
  FinishedGoodsOpeningBalanceLocationOption,
  FinishedGoodsOpeningBalancePageData,
} from '@/lib/ton-kho-thanh-pham/opening-balance-types'
import { isPileSerialSchemaReady, loadOpeningBalanceLots } from '@/lib/pile-serial/repository'
const TEMPLATE_META_PREFIX = 'ERP_TEMPLATE_META::'

function parseTemplateMeta(row: Record<string, unknown>) {
  const raw = String(row.ghi_chu || '').trim()
  const markerIndex = raw.indexOf(TEMPLATE_META_PREFIX)
  if (markerIndex < 0) return {} as Record<string, unknown>
  try {
    return JSON.parse(raw.slice(markerIndex + TEMPLATE_META_PREFIX.length)) as Record<string, unknown>
  } catch {
    return {} as Record<string, unknown>
  }
}

function looksLikeLoaiCocLabel(value: string) {
  const normalized = normalizeText(value).toUpperCase()
  return /^(PHC|PC)\s*-\s*[ABC]\d+\s*-\s*\d+(?:\.\d+)?$/.test(normalized)
}

function extractTemplateSteelGrade(row: Record<string, unknown>) {
  const meta = parseTemplateMeta(row)
  const explicit = normalizeText(row.mac_thep || meta.mac_thep).toUpperCase()
  if (explicit) return explicit
  const match = normalizeText(row.loai_coc).toUpperCase().match(/-\s*([ABC])\d+/)
  return match?.[1] || ''
}

function extractTemplateDiameter(row: Record<string, unknown>) {
  const meta = parseTemplateMeta(row)
  const explicit = normalizeText(row.do_ngoai || meta.do_ngoai)
  if (explicit) return explicit
  const match = normalizeText(row.loai_coc).toUpperCase().match(/[ABC](\d+)/)
  return match?.[1] || ''
}

function extractTemplateThickness(row: Record<string, unknown>) {
  const meta = parseTemplateMeta(row)
  const explicit = normalizeText(row.chieu_day || meta.chieu_day)
  if (explicit) return explicit
  const match = normalizeText(row.loai_coc).toUpperCase().match(/-\s*[ABC]\d+\s*-\s*(\d+(?:\.\d+)?)/)
  return match?.[1] || ''
}

function buildTemplateCodePrefix(row: Record<string, unknown>) {
  const meta = parseTemplateMeta(row)
  const macBeTong = normalizeText(row.mac_be_tong || meta.mac_be_tong).toUpperCase().replace(/^M/, '')
  const steelGrade = extractTemplateSteelGrade(row)
  const diameter = extractTemplateDiameter(row)
  const thickness = extractTemplateThickness(row)
  if (!macBeTong || !steelGrade || !diameter || !thickness) return ''
  return `M${macBeTong} - ${steelGrade}${diameter} - ${thickness}`
}

function buildTemplateDisplayCodeMap(rows: Array<Record<string, unknown>>) {
  const sortedRows = [...rows].sort((a, b) => {
    const aTime = new Date(normalizeText(a.created_at) || normalizeText(a.updated_at)).getTime() || 0
    const bTime = new Date(normalizeText(b.created_at) || normalizeText(b.updated_at)).getTime() || 0
    if (aTime !== bTime) return aTime - bTime
    return normalizeText(a.template_id || a.id).localeCompare(normalizeText(b.template_id || b.id), 'vi')
  })

  const counts = new Map<string, number>()
  const codeByTemplateId = new Map<string, string>()

  for (const row of sortedRows) {
    const templateId = normalizeText(row.template_id || row.id)
    if (!templateId) continue

    const prefix = buildTemplateCodePrefix(row)
    const explicitCode = normalizeText(row.ma_coc || row.ma_coc_template)
    const normalizedExplicitCode = looksLikeLoaiCocLabel(explicitCode) ? '' : explicitCode
    if (!prefix) {
      if (normalizedExplicitCode) codeByTemplateId.set(templateId, normalizedExplicitCode)
      continue
    }

    const next = (counts.get(prefix) ?? 0) + 1
    counts.set(prefix, next)
    codeByTemplateId.set(templateId, normalizedExplicitCode.startsWith(`${prefix} - `) ? normalizedExplicitCode : `${prefix} - ${next}`)
  }

  return codeByTemplateId
}

export async function loadFinishedGoodsOpeningBalancePageData(
  supabase: SupabaseClient
): Promise<FinishedGoodsOpeningBalancePageData> {
  const schemaReady = await isPileSerialSchemaReady(supabase)
  if (!schemaReady) {
    return {
      schemaReady: false,
      loaiCocOptions: [],
      locations: [],
      recentLots: [],
    }
  }

  const [{ data: locationRows, error: locationError }, { data: loaiCocRows, error: loaiCocError }, recentLots] = await Promise.all([
    supabase
      .from('warehouse_location')
      .select('location_id, location_code, location_name')
      .eq('is_active', true)
      .order('location_code', { ascending: true }),
    supabase.from('dm_coc_template').select('*').eq('is_active', true).order('loai_coc', { ascending: true }),
    loadOpeningBalanceLots(supabase),
  ])

  if (locationError) throw locationError
  if (loaiCocError) throw loaiCocError

  const locations: FinishedGoodsOpeningBalanceLocationOption[] = safeArray<Record<string, unknown>>(locationRows).map((row) => {
    const locationCode = normalizeText(row.location_code)
    const locationName = normalizeText(row.location_name)
    return {
      locationId: String(row.location_id || ''),
      locationCode,
      locationName,
      locationLabel: buildLocationLabel(locationCode, locationName),
    }
  })

  const templateRows = safeArray<Record<string, unknown>>(loaiCocRows)
  const codeByTemplateId = buildTemplateDisplayCodeMap(templateRows)

  const loaiCocOptions: FinishedGoodsOpeningBalanceLoaiCocOption[] = templateRows
    .map((row) => {
      const templateId = normalizeText(row.template_id || row.id)
      const loaiCoc = normalizeText(row.loai_coc)
      const maCoc = codeByTemplateId.get(templateId) || normalizeText(row.ma_coc || row.ma_coc_template) || templateId
      return {
        value: templateId || maCoc || loaiCoc,
        label: maCoc || loaiCoc,
        templateId,
        maCoc,
        loaiCoc,
      }
    })
    .filter((row) => row.value && row.loaiCoc)

  return {
    schemaReady: true,
    loaiCocOptions,
    locations,
    recentLots,
  }
}
