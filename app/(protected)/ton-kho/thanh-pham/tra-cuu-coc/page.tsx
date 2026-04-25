import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import {
  canUsePileLookup,
} from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { PileTemplateLookupForm } from '@/components/ton-kho/pile-template-lookup-form'
import {
  loadPileTemplateLookupPageData,
  type PileTemplateLookupFilters,
  type PileTemplateLookupRow,
} from '@/lib/pile-template-lookup/repository'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type LookupOption = {
  value: string
  label: string
}

type TemplatePreset = {
  templateId: string
  loaiCoc: string
  cuongDo: string
  macThep: string
  doNgoai: number | null
  chieuDay: number | null
  macBeTong: string
  kgMd: number | null
  thepPc: string
  pcNos: number | null
  thepDai: string
  donKepFactor: number | null
  thepBuoc: string
  a1Mm: number | null
  a2Mm: number | null
  a3Mm: number | null
  p1Pct: number | null
  p2Pct: number | null
  p3Pct: number | null
  matBich: string
  mangXong: string
  muiCoc: string
  tap: string
}

const TEMPLATE_META_PREFIX = 'ERP_TEMPLATE_META::'
export const dynamic = 'force-dynamic'

export default async function PileTemplateLookupPage(props: { searchParams: SearchParams }) {
  const { profile } = await getCurrentSessionProfile()
  if (!canUsePileLookup(profile.role)) {
    redirect('/dashboard')
  }

  const searchParams = await props.searchParams
  const returnTo = readSingleSearchParam(searchParams.return_to)
  const supabase = await createClient()
  const [pageData, { data: materialRows, error: materialError }, { data: templateRows, error: templateError }] = await Promise.all([
    loadPileTemplateLookupPageData(supabase, searchParams),
    supabase.from('nvl').select('nvl_id, ten_hang, nhom_hang').eq('is_active', true).limit(1000),
    supabase.from('dm_coc_template').select('*').eq('is_active', true).limit(800),
  ])

  if (materialError) throw materialError
  if (templateError) throw templateError

  const steelOptions = buildMaterialOptions(materialRows ?? [], 'THEP')
  const steelGroups = buildSteelGroups(steelOptions)
  const accessoryOptions = buildMaterialOptions(materialRows ?? [], 'PHU_KIEN')
  const accessoryGroups = buildAccessoryGroups(accessoryOptions)
  const nvlMap = new Map((materialRows ?? []).map((row) => [String(row.nvl_id ?? ''), String(row.ten_hang ?? '').trim()]))
  const templatePresets = buildTemplatePresets((templateRows ?? []) as Array<Record<string, unknown>>, nvlMap)

  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <section className="px-6 py-6">
        <h1 className="text-2xl font-bold">Tra cứu mã cọc theo thông số</h1>
      </section>

      <section className="border-t px-6 py-6" style={{ borderColor: 'var(--color-border)' }}>
        <PileTemplateLookupForm filters={pageData.filters} steelGroups={steelGroups} accessoryGroups={accessoryGroups} templatePresets={templatePresets} />
      </section>

      {!pageData.hasQuery ? (
        <section className="border-t px-6 py-6" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-semibold">Cách dùng nhanh</h2>
          <div className="app-muted mt-4 grid divide-y text-sm md:grid-cols-3 md:divide-x md:divide-y-0" style={{ borderColor: 'var(--color-border)' }}>
            <div className="py-4 md:pr-5">
              <p className="font-semibold text-[var(--color-foreground)]">1. Từ bản vẽ khách đưa</p>
              <p className="mt-2">Nhập cường độ, mác thép, ĐK ngoài, thành cọc, chiều dài để ra mã khớp nhất và các loại gần giống.</p>
            </div>
            <div className="py-4 md:px-5">
              <p className="font-semibold text-[var(--color-foreground)]">2. Từ mã cọc đang có</p>
              <p className="mt-2">Gõ trực tiếp loại cọc để xem lại thông số kỹ thuật cơ bản và tồn theo chiều dài đang hỏi.</p>
            </div>
            <div className="py-4 md:pl-5">
              <p className="font-semibold text-[var(--color-foreground)]">3. Gợi ý thay thế</p>
              <p className="mt-2">Nếu không có hàng đúng 100%, hệ thống sẽ liệt kê loại gần giống và ghi rõ khác nhau ở đâu để mình trao đổi lại với khách.</p>
            </div>
          </div>
        </section>
      ) : null}

      {pageData.hasQuery ? (
        <>
          <ResultSection
            title="Khớp trực tiếp"
            emptyMessage="Chưa có loại cọc nào khớp hoàn toàn với thông số đang nhập."
            rows={pageData.exactMatches}
            filters={pageData.filters}
            tone="primary"
            returnTo={returnTo}
          />
          <ResultSection
            title="Loại gần giống để cân nhắc"
            emptyMessage="Chưa tìm được loại đủ gần để gợi ý thay thế."
            rows={pageData.nearMatches}
            filters={pageData.filters}
            tone="default"
            returnTo={returnTo}
          />
        </>
      ) : null}
    </div>
  )
}

function ResultSection({
  title,
  emptyMessage,
  rows,
  filters,
  tone,
  returnTo,
}: Readonly<{
  title: string
  emptyMessage: string
  rows: PileTemplateLookupRow[]
  filters: PileTemplateLookupFilters
  tone: 'primary' | 'default'
  returnTo: string
}>) {
  return (
    <section className="border-t px-6 py-6" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{
            color: tone === 'primary' ? 'var(--color-primary)' : 'var(--color-muted)',
          }}
        >
          {rows.length} loại
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="app-muted mt-4 border-t py-4 text-sm" style={{ borderColor: 'var(--color-border)' }}>
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {rows.map((row) => (
            <article
              key={row.templateId}
              className="py-5 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold">{row.loaiCoc}</h3>
                  <div
                    className="app-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"
                  >
                    <span>Mã nội bộ: {row.maCoc || '-'}</span>
                    <span>Nguồn: {row.sourceLabel}</span>
                    {row.khoiLuongKgMd !== null ? <span>Kg/md: {row.khoiLuongKgMd}</span> : null}
                  </div>
                </div>
                {row.differenceLabels.length ? (
                  <div className="app-muted text-xs font-semibold uppercase tracking-[0.16em]">
                    {row.differenceLabels.length === 1 && row.differenceLabels[0] === 'Cần kiểm tra phụ kiện'
                      ? 'Cần kiểm tra phụ kiện'
                      : `${row.differenceLabels.length} điểm khác`}
                  </div>
                ) : (
                  <div
                    className="text-xs font-semibold uppercase tracking-[0.16em]"
                    style={{
                      color: 'var(--color-primary)',
                    }}
                  >
                    Khớp đầy đủ
                  </div>
                )}
              </div>

              {returnTo ? (
                <div className="mt-4">
                  <Link
                    href={buildReturnHref(returnTo, row.templateId || row.maCoc || row.loaiCoc)}
                    className="app-primary inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    Dùng mã này
                  </Link>
                </div>
              ) : null}

              <div className="mt-5 grid gap-x-8 gap-y-5 text-sm md:grid-cols-2 xl:grid-cols-5">
                <SpecBox label="Cường độ" value={row.cuongDo} />
                <SpecBox label="Mác thép" value={row.macThep} />
                <SpecBox label="ĐK ngoài" value={`${row.doNgoai} mm`} />
                <SpecBox label="Thành cọc" value={`${row.chieuDay} mm`} />
                <SpecBox label="Mác BT" value={row.macBeTong || '-'} />
              </div>

              <div className="mt-5 border-t pt-5 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                <p className="font-semibold">Thông số cọc đầy đủ</p>
                <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
                  <SpecBox label="Khối lượng" value={row.khoiLuongKgMd !== null ? `${row.khoiLuongKgMd} kg/md` : '-'} />
                  <SpecBox label="Thép PC" value={row.steelLabels.pc || '-'} />
                  <SpecBox label="Số thanh PC" value={row.pcNos !== null ? String(row.pcNos) : '-'} />
                  <SpecBox label="Thép đai" value={row.steelLabels.dai || '-'} />
                  <SpecBox label="Đơn/kép (vòng)" value={formatDonKep(row.donKepFactor)} />
                  <SpecBox label="Thép buộc" value={row.steelLabels.buoc || '-'} />
                  <SpecBox label="A1" value={formatNullableNumber(row.a1Mm, ' mm')} />
                  <SpecBox label="A2" value={formatNullableNumber(row.a2Mm, ' mm')} />
                  <SpecBox label="A3" value={formatNullableNumber(row.a3Mm, ' mm')} />
                  <SpecBox label="PctA1" value={formatNullableNumber(row.p1Pct)} />
                  <SpecBox label="PctA2" value={formatNullableNumber(row.p2Pct)} />
                  <SpecBox label="PctA3" value={formatNullableNumber(row.p3Pct)} />
                </div>
              </div>

              {hasAccessoryLabels(row) ? (
                <div className="mt-5 border-t pt-5 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="font-semibold">Phụ kiện đang gắn với loại này</p>
                  <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
                    <SpecBox label="Mặt bích" value={row.accessoryLabels.matBich || '-'} />
                    <SpecBox label="Măng xông" value={row.accessoryLabels.mangXong || '-'} />
                    <SpecBox label="Mũi cọc" value={row.accessoryLabels.muiCoc || '-'} />
                    <SpecBox label="Táp vuông" value={row.accessoryLabels.tap || '-'} />
                  </div>
                </div>
              ) : null}

              {row.differenceLabels.length ? (
                <div className="mt-5 border-t pt-5 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="font-semibold">Điểm khác so với thông số đang hỏi</p>
                  <ul className="app-muted mt-2 space-y-1">
                    {row.differenceLabels.map((label) => (
                      <li key={label}>• {label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 grid gap-4">
                <ExpandableTechSection title="Thông số kỹ thuật">
                  <div className="overflow-x-auto border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <table className="w-full table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[10%]" />
                        <col className="w-[54%]" />
                        <col className="w-[16%]" />
                        <col className="w-[20%]" />
                      </colgroup>
                      <thead>
                        <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                          {['STT', 'Hệ số', 'Đơn vị', 'Giá trị'].map((header) => (
                            <th
                              key={header}
                              className={`px-4 py-3 text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-muted)] ${header === 'Giá trị' ? 'text-right' : 'text-left'}`}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {buildTechPrimaryRows(row).map((item) => (
                          <tr key={item.stt} className="border-t" style={{ borderColor: 'color-mix(in srgb, var(--color-border) 72%, white)' }}>
                            <td className="px-4 py-3">{item.stt}</td>
                            <td className="px-4 py-3">{item.label}</td>
                            <td className="px-4 py-3">{item.unit}</td>
                            <td className="px-4 py-3 text-right font-semibold">{formatNumber(item.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ExpandableTechSection>
              </div>

              {filters.chieuDaiM !== null ? <StockSection row={row} requestedLength={filters.chieuDaiM} /> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function hasAccessoryLabels(row: PileTemplateLookupRow) {
  return Boolean(row.accessoryLabels.matBich || row.accessoryLabels.mangXong || row.accessoryLabels.muiCoc || row.accessoryLabels.tap)
}

function StockSection({
  row,
  requestedLength,
}: Readonly<{
  row: PileTemplateLookupRow
  requestedLength: number
}>) {
  const stock = row.stockAtRequestedLength
  if (!stock) return null

  return (
    <div className="mt-5 border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
      <p className="text-sm font-semibold">Tồn theo chiều dài {requestedLength} m</p>
      <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2">
        <StockBox
          title="Mũi"
          physicalQty={stock.muiPhysicalQty}
          projectQty={stock.muiProjectQty}
          retailQty={stock.muiRetailQty}
        />
        <StockBox
          title="Thân"
          physicalQty={stock.thanPhysicalQty}
          projectQty={stock.thanProjectQty}
          retailQty={stock.thanRetailQty}
        />
      </div>
    </div>
  )
}

function StockBox({
  title,
  physicalQty,
  projectQty,
  retailQty,
}: Readonly<{
  title: string
  physicalQty: number
  projectQty: number
  retailQty: number
}>) {
  return (
    <div className="text-sm">
      <p className="font-semibold">{title}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <SpecBox label="Tồn vật lý" value={formatNumber(physicalQty)} />
        <SpecBox label="Dự án" value={formatNumber(projectQty)} />
        <SpecBox label="Khách lẻ" value={formatNumber(retailQty)} />
      </div>
    </div>
  )
}

function SpecBox({
  label,
  value,
}: Readonly<{
  label: string
  value: string
}>) {
  return (
    <div className="min-w-0">
      <p className="app-muted text-[11px] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  )
}

function ExpandableTechSection({
  title,
  children,
}: Readonly<{
  title: string
  children: React.ReactNode
}>) {
  return (
    <details className="group border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
      <summary className="cursor-pointer list-none text-sm font-semibold">
        <div className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <span className="app-muted text-sm font-semibold group-open:hidden">Bấm mở rộng</span>
          <span className="app-muted hidden text-sm font-semibold group-open:inline">Thu gọn lại</span>
        </div>
      </summary>
      <div className="mt-4">
        {children}
      </div>
    </details>
  )
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
}

function formatNullableNumber(value: number | null, suffix = '') {
  if (value === null) return '-'
  return `${formatNumber(value)}${suffix}`
}

function formatDonKep(value: number | null) {
  if (value === 2) return 'Kép'
  if (value === 1) return 'Đơn'
  return '-'
}

function buildTechPrimaryRows(row: PileTemplateLookupRow) {
  return [
    { stt: '1', label: 'Khả năng chịu nén dọc trục dài hạn', unit: 'tấn', value: row.techPreview.ra_l },
    { stt: '2', label: 'Khả năng chịu nén dọc trục ngắn hạn', unit: 'tấn', value: row.techPreview.ra_s },
    { stt: '3', label: 'Moment kháng uốn nứt cọc', unit: '(t.m)', value: row.techPreview.mcr },
  ]
}


function normalizeLookupText(value: unknown) {
  return String(value || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function buildMaterialOptions(rows: Array<Record<string, unknown>>, group: string): LookupOption[] {
  return rows
    .filter((row) => normalizeLookupText(row.nhom_hang) === group)
    .map((row) => ({
      value: String(row.nvl_id ?? ''),
      label: String(row.ten_hang ?? row.nvl_id ?? '').trim(),
    }))
    .filter((row) => row.value && row.label)
    .sort((left, right) => left.label.localeCompare(right.label, 'vi'))
}

function accessoryKindFromLabel(value: string) {
  const normalized = normalizeLookupText(value)
  if (normalized.includes('MAT BICH')) return 'matBich' as const
  if (normalized.includes('MANG XONG') || normalized.includes('MANGXONG')) return 'mangXong' as const
  if (normalized.includes('MUI COC')) return 'muiCoc' as const
  if (
    normalized.includes('TAP') ||
    normalized.includes('TAM VUONG') ||
    normalized.includes('TAMVUONG') ||
    normalized.includes('TAP VUONG') ||
    normalized.includes('TAPVUONG')
  ) {
    return 'tap' as const
  }
  return null
}

function steelKindFromLabel(value: string) {
  const normalized = normalizeLookupText(value)
  if (normalized.startsWith('THEP PC')) return 'pc' as const
  if (normalized.startsWith('THEP DAI')) return 'dai' as const
  if (normalized.startsWith('THEP BUOC')) return 'buoc' as const
  return null
}

function buildSteelGroups(options: LookupOption[]) {
  const grouped = {
    pc: [] as LookupOption[],
    dai: [] as LookupOption[],
    buoc: [] as LookupOption[],
  }

  for (const option of options) {
    const kind = steelKindFromLabel(option.label)
    if (!kind) continue
    grouped[kind].push(option)
  }

  return grouped
}

function buildAccessoryGroups(options: LookupOption[]) {
  const grouped = {
    matBich: [] as LookupOption[],
    mangXong: [] as LookupOption[],
    muiCoc: [] as LookupOption[],
    tap: [] as LookupOption[],
  }

  for (const option of options) {
    const kind = accessoryKindFromLabel(option.label)
    if (!kind) continue
    grouped[kind].push(option)
  }

  return grouped
}

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? '').trim() : String(value ?? '').trim()
}

function buildReturnHref(returnTo: string, loaiCoc: string) {
  if (!returnTo) return '#'
  const [pathname, rawQuery = ''] = returnTo.split('?')
  const params = new URLSearchParams(rawQuery)
  params.set('selected_loai_coc', loaiCoc)
  const nextQuery = params.toString()
  return nextQuery ? `${pathname}?${nextQuery}` : pathname
}

function readTemplateMetadata(row: Record<string, unknown>) {
  const raw = String(row.ghi_chu ?? '').trim()
  if (!raw.startsWith(TEMPLATE_META_PREFIX)) return {} as Record<string, unknown>
  try {
    return JSON.parse(raw.slice(TEMPLATE_META_PREFIX.length)) as Record<string, unknown>
  } catch {
    return {} as Record<string, unknown>
  }
}

function readTemplateString(row: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = String(row[field] ?? '').trim()
    if (value) return value
  }
  const metadata = readTemplateMetadata(row)
  for (const field of fields) {
    const value = String(metadata[field] ?? '').trim()
    if (value) return value
  }
  return ''
}

function readTemplateNumber(row: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = row[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      const parsed = Number(String(value).replace(/,/g, '.'))
      return Number.isFinite(parsed) ? parsed : null
    }
  }
  const metadata = readTemplateMetadata(row)
  for (const field of fields) {
    const value = metadata[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      const parsed = Number(String(value).replace(/,/g, '.'))
      return Number.isFinite(parsed) ? parsed : null
    }
  }
  return null
}

function resolveTemplateNvlDisplay(
  row: Record<string, unknown>,
  nvlMap: Map<string, string>,
  idFields: string[],
  labelFields: string[],
  diameterField?: string,
  diameterPrefix?: string
) {
  for (const field of idFields) {
    const idValue = String(row[field] ?? '').trim()
    if (idValue && nvlMap.has(idValue)) return nvlMap.get(idValue) ?? ''
  }

  const metadata = readTemplateMetadata(row)
  for (const field of idFields) {
    const idValue = String(metadata[field] ?? '').trim()
    if (idValue && nvlMap.has(idValue)) return nvlMap.get(idValue) ?? ''
  }

  const labelValue = readTemplateString(row, labelFields)
  if (labelValue) return labelValue

  if (diameterField) {
    const diameter = readTemplateNumber(row, [diameterField])
    if (diameter !== null && diameter > 0) {
      return `${diameterPrefix ?? 'NVL'} ${formatNumber(diameter)}`
    }
  }

  return ''
}

function buildTemplatePresets(rows: Array<Record<string, unknown>>, nvlMap: Map<string, string>): TemplatePreset[] {
  return rows
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      templateId: String(row.template_id ?? row.id ?? ''),
      loaiCoc: readTemplateString(row, ['loai_coc']),
      cuongDo: readTemplateString(row, ['cuong_do']),
      macThep: readTemplateString(row, ['mac_thep']),
      doNgoai: readTemplateNumber(row, ['do_ngoai']),
      chieuDay: readTemplateNumber(row, ['chieu_day']),
      macBeTong: readTemplateString(row, ['mac_be_tong']),
      kgMd: readTemplateNumber(row, ['kg_md', 'khoi_luong_kg_md', 'trong_luong_kg_md']),
      thepPc: resolveTemplateNvlDisplay(row, nvlMap, ['pc_nvl_id', 'thep_pc_nvl_id'], ['thep_pc', 'pc_label'], 'pc_dia_mm', 'Thép PC'),
      pcNos: readTemplateNumber(row, ['pc_nos']),
      thepDai: resolveTemplateNvlDisplay(row, nvlMap, ['dai_nvl_id', 'thep_dai_nvl_id'], ['thep_dai', 'dai_label'], 'dai_dia_mm', 'Thép đai'),
      donKepFactor: readTemplateNumber(row, ['don_kep_factor']),
      thepBuoc: resolveTemplateNvlDisplay(row, nvlMap, ['buoc_nvl_id', 'thep_buoc_nvl_id'], ['thep_buoc', 'buoc_label'], 'buoc_dia_mm', 'Thép buộc'),
      a1Mm: readTemplateNumber(row, ['a1_mm']),
      a2Mm: readTemplateNumber(row, ['a2_mm']),
      a3Mm: readTemplateNumber(row, ['a3_mm']),
      p1Pct: readTemplateNumber(row, ['p1_pct']),
      p2Pct: readTemplateNumber(row, ['p2_pct']),
      p3Pct: readTemplateNumber(row, ['p3_pct']),
      matBich: resolveTemplateNvlDisplay(row, nvlMap, ['mat_bich_nvl_id'], ['mat_bich', 'mat_bich_label']),
      mangXong: resolveTemplateNvlDisplay(row, nvlMap, ['mang_xong_nvl_id'], ['mang_xong', 'mang_xong_label']),
      muiCoc: resolveTemplateNvlDisplay(row, nvlMap, ['mui_coc_nvl_id'], ['mui_coc', 'mui_coc_label']),
      tap: resolveTemplateNvlDisplay(row, nvlMap, ['tap_nvl_id', 'tap_vuong_nvl_id'], ['tap_vuong', 'tap_label']),
    }))
    .filter((row) => row.templateId && row.loaiCoc)
    .sort((left, right) => left.loaiCoc.localeCompare(right.loaiCoc, 'vi'))
}
