'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type {
  FinishedGoodsInventoryItemDetail,
  FinishedGoodsInventoryPageData,
  FinishedGoodsInventoryScope,
} from '@/lib/ton-kho-thanh-pham/types'
import { normalizeSearch } from '@/lib/ton-kho-thanh-pham/internal'

const SCOPE_OPTIONS: Array<{ value: FinishedGoodsInventoryScope; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PROJECT', label: 'Có dự án' },
  { value: 'RETAIL', label: 'Có khách lẻ' },
  { value: 'HOLD', label: 'Chờ xử lý' },
]

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function formatStatusLabel(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) return '-'
  if (normalized === 'TRONG_KHO') return 'Trong kho'
  if (normalized === 'TRONG_KHU_CHO_QC') return 'Chờ QC'
  if (normalized === 'BINH_THUONG') return 'Bình thường'
  if (normalized === 'THANH_LY') return 'Thanh lý / khách lẻ'
  if (normalized === 'HUY') return 'Hủy'
  return normalized.replaceAll('_', ' ')
}

function buildSerialStatusDisplay(lifecycleStatus: string, dispositionStatus: string) {
  const normalizedDispositionStatus = String(dispositionStatus || '').trim()
  if (normalizedDispositionStatus && normalizedDispositionStatus !== 'BINH_THUONG') {
    return {
      primary: formatStatusLabel(normalizedDispositionStatus),
      secondary: null as string | null,
      primaryClassName: normalizedDispositionStatus === 'HUY' ? 'font-medium text-red-600' : '',
    }
  }

  return {
    primary: formatStatusLabel(lifecycleStatus),
    secondary: null as string | null,
    primaryClassName: '',
  }
}

function formatSerialNote(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) return '-'

  const externalPurchaseMatch = normalized.match(
    /^Nhập mua cọc ngoài từ phiếu\s+(PO-COC-[A-Z0-9-]+)\s*-\s*NCC\s+(.+?)\s*-\s*dòng\s+\d+$/i
  )
  if (externalPurchaseMatch) {
    const [, purchaseOrderCode, vendorName] = externalPurchaseMatch
    return `${purchaseOrderCode} - NCC ${String(vendorName || '').trim()}`
  }

  return normalized
}

function SummaryMetric(props: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <div className="app-muted text-[11px] uppercase tracking-[0.18em]">{props.label}</div>
      <div className="mt-1 text-sm">{props.value}</div>
    </div>
  )
}

export function ThanhPhamInventoryPageClient(props: {
  pageData: FinishedGoodsInventoryPageData
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [scope, setScope] = useState<FinishedGoodsInventoryScope>(
    (searchParams.get('scope') as FinishedGoodsInventoryScope) || props.pageData.filters.scope
  )
  const [activeItemKey, setActiveItemKey] = useState(props.pageData.selectedItemDetail?.itemKey || '')
  const [activeDetail, setActiveDetail] = useState<FinishedGoodsInventoryItemDetail | null>(props.pageData.selectedItemDetail)
  const [detailLoading, setDetailLoading] = useState(false)
  const activeItemKeyRef = useRef(activeItemKey)
  const activeSerialPageRef = useRef(props.pageData.selectedItemDetail?.serialPage || 1)
  const detailCacheRef = useRef<Record<string, FinishedGoodsInventoryItemDetail>>(
    Object.fromEntries(
      Object.entries(props.pageData.prefetchedItemDetails).map(([itemKey, detail]) => [`${itemKey}::${props.pageData.filters.scope}::1`, detail])
    )
  )
  const activeRequestRef = useRef(0)

  activeItemKeyRef.current = activeItemKey
  activeSerialPageRef.current = activeDetail?.serialPage || 1

  const buildHref = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParamsString)
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key)
      else params.set(key, value)
    }
    const queryString = params.toString()
    return queryString ? `${pathname}?${queryString}` : pathname
  }

  const buildInventoryHref = (updates: Record<string, string | null>) =>
    buildHref({
      q: props.pageData.filters.query || null,
      scope: props.pageData.filters.scope,
      ...updates,
    })

  useEffect(() => {
    const nextQuery = query.trim()
    const normalizedNextQuery = normalizeSearch(nextQuery)
    const currentQuery = props.pageData.filters.query || ''
    if (normalizedNextQuery === currentQuery) return

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(searchParamsString)
      if (!nextQuery) params.delete('q')
      else params.set('q', nextQuery)
      params.set('scope', scope)
      params.set('page', '1')
      if (activeItemKeyRef.current) {
        params.set('item', activeItemKeyRef.current)
        if (activeSerialPageRef.current) params.set('serial_page', String(activeSerialPageRef.current))
        else params.delete('serial_page')
      } else {
        params.delete('item')
        params.delete('serial_page')
      }
      const queryString = params.toString()
      router.replace(
        queryString ? `${pathname}?${queryString}` : pathname
      )
    }, 180)

    return () => window.clearTimeout(timeoutId)
  }, [pathname, props.pageData.filters.query, query, router, scope, searchParamsString])

  useEffect(() => {
    setScope(props.pageData.filters.scope)
    setActiveItemKey(props.pageData.selectedItemDetail?.itemKey || '')
    setActiveDetail(props.pageData.selectedItemDetail)
    setDetailLoading(false)

    for (const [itemKey, detail] of Object.entries(props.pageData.prefetchedItemDetails)) {
      detailCacheRef.current[`${itemKey}::${props.pageData.filters.scope}::1`] = detail
    }

    if (props.pageData.selectedItemDetail) {
      const cacheKey = `${props.pageData.selectedItemDetail.itemKey}::${props.pageData.filters.scope}::${props.pageData.selectedItemDetail.serialPage}`
      detailCacheRef.current[cacheKey] = props.pageData.selectedItemDetail
    }
  }, [props.pageData])

  const updateUrl = (href: string) => {
    window.history.replaceState(null, '', href)
  }

  const fetchItemDetail = async (itemKey: string, serialPage: number) => {
    const cacheKey = `${itemKey}::${scope}::${serialPage}`
    const requestId = activeRequestRef.current + 1
    activeRequestRef.current = requestId

    try {
      const params = new URLSearchParams({
        item: itemKey,
        scope,
        serial_page: String(serialPage),
      })
      const response = await fetch(`/api/finished-goods/detail?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as {
        ok: boolean
        error?: string
        data?: {
          selectedItemDetail: FinishedGoodsInventoryItemDetail | null
        }
      }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Không tải được chi tiết serial.')
      }

      if (activeRequestRef.current !== requestId) return

      const nextDetail = payload.data?.selectedItemDetail ?? null
      if (nextDetail && nextDetail.itemKey !== itemKey) {
        throw new Error('Chi tiết serial trả về không khớp dòng đang chọn.')
      }
      if (nextDetail) {
        detailCacheRef.current[cacheKey] = nextDetail
      }
      setActiveDetail(nextDetail)
    } catch (error) {
      if (activeRequestRef.current !== requestId) return
      console.error(error)
      setActiveDetail(null)
    } finally {
      if (activeRequestRef.current === requestId) {
        setDetailLoading(false)
      }
    }
  }

  const handleSelectItem = (itemKey: string, serialPage = 1) => {
    const cacheKey = `${itemKey}::${scope}::${serialPage}`
    const isSameSelection = activeItemKey === itemKey && (activeDetail?.serialPage || 1) === serialPage

    if (isSameSelection) {
      setActiveItemKey('')
      setActiveDetail(null)
      setDetailLoading(false)
      activeRequestRef.current += 1
      updateUrl(
        buildInventoryHref({
          item: null,
          serial_page: null,
        })
      )
      return
    }

    setActiveItemKey(itemKey)
    updateUrl(
      buildInventoryHref({
        item: itemKey,
        serial_page: String(serialPage),
      })
    )

    const cachedDetail = detailCacheRef.current[cacheKey]
    if (cachedDetail && cachedDetail.itemKey === itemKey) {
      setActiveDetail(cachedDetail)
      setDetailLoading(false)
      return
    }

    setActiveDetail(null)
    setDetailLoading(true)
    void fetchItemDetail(itemKey, serialPage)
  }

  if (!props.pageData.schemaReady) {
    return (
      <section className="app-surface rounded-2xl p-6">
        <div
          className="rounded-2xl border px-4 py-4 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, white)',
            color: 'var(--color-accent)',
          }}
        >
          Chưa thấy schema `pile_serial`. Cần chạy file `sql/pile_serial_setup.sql` rồi mới xem được tồn kho cọc thành phẩm.
        </div>
      </section>
    )
  }

  const stickyHeaderClass = 'sticky top-0 z-20 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]'
  const stickyHeaderStyle = { backgroundColor: '#f6f8fb' }
  const selectedSummaryRow = props.pageData.summaryRows.find((row) => row.itemKey === activeItemKey)
  const activeDisplayDetail = activeDetail?.itemKey === activeItemKey ? activeDetail : null

  return (
    <section className="app-surface overflow-hidden rounded-2xl">
      <div className="px-6 py-6">
        <h1 className="text-2xl font-bold">Danh sách tồn</h1>
      </div>

      <div className="border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="grid gap-4 lg:grid-cols-[1.6fr_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium">Tìm mặt hàng</span>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              placeholder="VD: MUI 9m, THAN 9m, A500..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Nhóm tồn</span>
            <select
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              value={scope}
              onChange={(event) => {
                const nextScope = event.target.value as FinishedGoodsInventoryScope
                setScope(nextScope)
                router.replace(
                  buildHref({
                    q: query.trim() || null,
                    scope: nextScope,
                    page: '1',
                    item: null,
                    serial_page: null,
                  })
                )
              }}
            >
              {SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h3 className="text-lg font-semibold">Tổng hợp theo mặt hàng</h3>
          <div className="app-muted text-sm">Số dòng: {props.pageData.summaryTotalCount}</div>
        </div>

        <div className="mt-5 hidden max-h-[56vh] overflow-auto border-y md:block" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
              <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                <th className={stickyHeaderClass} style={stickyHeaderStyle}>Hàng</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>Tồn vật lý</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>Dự án</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>Khách lẻ</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>Chờ xử lý</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>Số lô</th>
                <th className={stickyHeaderClass} style={stickyHeaderStyle}>SX mới nhất</th>
              </tr>
            </thead>
            <tbody>
              {props.pageData.summaryRows.length ? (
                props.pageData.summaryRows.map((row) => {
                  const selected = activeItemKey === row.itemKey

                  return (
                    <tr
                      key={row.itemKey}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-[color:color-mix(in_srgb,var(--color-primary)_3%,white)]"
                      onClick={() => handleSelectItem(row.itemKey)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        handleSelectItem(row.itemKey)
                      }}
                      style={{
                        borderTop: '1px solid var(--color-border)',
                        backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 4%, white)' : undefined,
                      }}
                    >
                      <td className="px-4 py-4 font-semibold">{row.itemLabel}</td>
                      <td className="px-4 py-4 text-right font-semibold">{row.physicalQty}</td>
                      <td className="px-4 py-4 text-right">{row.projectQty}</td>
                      <td className="px-4 py-4 text-right">{row.retailQty}</td>
                      <td className="px-4 py-4 text-right">{row.holdQty}</td>
                      <td className="px-4 py-4 text-right">{row.lotCount}</td>
                      <td className="px-4 py-4">{formatDate(row.latestProductionDate)}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center app-muted" colSpan={7}>
                    Không có dòng tồn nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 divide-y border-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          {props.pageData.summaryRows.length ? (
            props.pageData.summaryRows.map((row) => {
              const selected = activeItemKey === row.itemKey

              return (
                <button
                  key={row.itemKey}
                  type="button"
                  className="block w-full px-4 py-4 text-left transition-colors"
                  style={{
                    backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 4%, white)' : 'transparent',
                  }}
                  onClick={() => handleSelectItem(row.itemKey)}
                >
                  <div className="text-base font-semibold leading-snug">{row.itemLabel}</div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <SummaryMetric label="Tồn vật lý" value={row.physicalQty} />
                    <SummaryMetric label="Dự án" value={row.projectQty} />
                    <SummaryMetric label="Khách lẻ" value={row.retailQty} />
                    <SummaryMetric label="Chờ xử lý" value={row.holdQty} />
                    <SummaryMetric label="Số lô" value={row.lotCount} />
                    <SummaryMetric label="SX mới nhất" value={formatDate(row.latestProductionDate)} />
                  </div>
                </button>
              )
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm app-muted">
              Không có dòng tồn nào khớp bộ lọc hiện tại.
            </div>
          )}
        </div>

        {props.pageData.summaryPageCount > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link
              className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium ${
                props.pageData.filters.page <= 1 ? 'pointer-events-none opacity-50' : ''
              }`}
              style={{ borderColor: 'var(--color-border)' }}
              href={buildHref({
                scope: props.pageData.filters.scope,
                page: props.pageData.filters.page > 1 ? String(props.pageData.filters.page - 1) : '1',
                serial_page: props.pageData.selectedItemDetail ? String(props.pageData.selectedItemDetail.serialPage) : null,
              })}
            >
              Trang trước
            </Link>
            <div className="app-muted text-sm">
              Trang {props.pageData.filters.page}/{props.pageData.summaryPageCount}
            </div>
            <Link
              className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium ${
                props.pageData.filters.page >= props.pageData.summaryPageCount ? 'pointer-events-none opacity-50' : ''
              }`}
              style={{ borderColor: 'var(--color-border)' }}
              href={buildHref({
                scope: props.pageData.filters.scope,
                page:
                  props.pageData.filters.page < props.pageData.summaryPageCount
                    ? String(props.pageData.filters.page + 1)
                    : String(props.pageData.summaryPageCount),
                serial_page: props.pageData.selectedItemDetail ? String(props.pageData.selectedItemDetail.serialPage) : null,
              })}
            >
              Trang sau
            </Link>
          </div>
        ) : null}
      </div>

      <div className="border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        {activeItemKey ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Chi tiết serial</h3>
                <p className="app-muted mt-2 text-sm">
                  {activeDisplayDetail?.itemLabel || selectedSummaryRow?.itemLabel || 'Đang tải chi tiết...'}
                </p>
                {activeDisplayDetail?.legacyShipmentGapQty ? (
                  <div
                    className="mt-3 rounded-2xl border px-4 py-3 text-sm"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'color-mix(in srgb, var(--color-primary) 6%, white)',
                    }}
                  >
                    Có {activeDisplayDetail.legacyShipmentGapQty} cây đã xuất theo phiếu cũ/nhập tay nhưng chưa gắn
                    serial. Bảng tổng đã trừ phần này; danh sách serial bên dưới chỉ phản ánh các serial đã đối soát.
                  </div>
                ) : null}
              </div>
              <div className="app-muted flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span>Tồn vật lý: {activeDisplayDetail?.physicalQty ?? selectedSummaryRow?.physicalQty ?? '-'}</span>
                <span>Dự án: {activeDisplayDetail?.projectQty ?? selectedSummaryRow?.projectQty ?? '-'}</span>
                <span>Khách lẻ: {activeDisplayDetail?.retailQty ?? selectedSummaryRow?.retailQty ?? '-'}</span>
                <span>Chờ xử lý: {activeDisplayDetail?.holdQty ?? selectedSummaryRow?.holdQty ?? '-'}</span>
              </div>
            </div>

            {detailLoading && !activeDisplayDetail ? (
              <div className="py-8 text-sm app-muted">Đang tải chi tiết serial...</div>
            ) : activeDisplayDetail?.legacyShipmentGapQty ? (
              <div
                className="rounded-2xl border px-4 py-5 text-sm"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'color-mix(in srgb, var(--color-accent) 6%, white)',
                }}
              >
                Chưa thể hiển thị danh sách serial “còn trong kho” một cách chính xác cho dòng này, vì còn{' '}
                {activeDisplayDetail.legacyShipmentGapQty} cây đã xuất theo phiếu cũ/nhập tay nhưng chưa gắn serial.
                Mình cần làm thêm một bước `đối soát serial legacy` để chốt cây nào đã đi, cây nào còn ở kho. Trước mắt, số tổng ở
                phía trên đã được điều chỉnh đúng theo phiếu xuất/trả.
              </div>
            ) : activeDisplayDetail ? (
              <>
                <div className="hidden max-h-[48vh] overflow-auto border-y md:block" style={{ borderColor: 'var(--color-border)' }}>
                  <table className="min-w-full text-sm">
                    <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                      <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                        <th className={stickyHeaderClass} style={stickyHeaderStyle}>Serial</th>
                        <th className={stickyHeaderClass} style={stickyHeaderStyle}>Ngày SX</th>
                        <th className={stickyHeaderClass} style={stickyHeaderStyle}>Kho</th>
                        <th className={stickyHeaderClass} style={stickyHeaderStyle}>Hiển thị</th>
                        <th className={stickyHeaderClass} style={stickyHeaderStyle}>Trạng thái</th>
                        <th className={stickyHeaderClass} style={stickyHeaderStyle}>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDisplayDetail.serialRows.map((row) => {
                        const statusDisplay = buildSerialStatusDisplay(row.lifecycleStatus, row.dispositionStatus)
                        return (
                          <tr key={row.serialId} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <td className="px-4 py-4 font-medium">{row.serialCode}</td>
                            <td className="px-4 py-4">{formatDate(row.productionDate)}</td>
                            <td className="px-4 py-4">{row.locationLabel}</td>
                            <td className="px-4 py-4">{row.visibilityLabel}</td>
                            <td className="px-4 py-4">
                              <div className={statusDisplay.primaryClassName || undefined}>{statusDisplay.primary}</div>
                              {statusDisplay.secondary ? <div className="app-muted mt-1 text-xs">{statusDisplay.secondary}</div> : null}
                            </td>
                            <td className="px-4 py-4">{formatSerialNote(row.note)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y border-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
                  {activeDisplayDetail.serialRows.map((row) => {
                    const statusDisplay = buildSerialStatusDisplay(row.lifecycleStatus, row.dispositionStatus)
                    return (
                      <div key={row.serialId} className="px-4 py-4">
                        <div className="text-sm font-semibold break-words">{row.serialCode}</div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                          <SummaryMetric label="Ngày SX" value={formatDate(row.productionDate)} />
                          <SummaryMetric label="Kho" value={row.locationLabel} />
                          <SummaryMetric label="Hiển thị" value={row.visibilityLabel} />
                          <div className="min-w-0">
                            <div className="app-muted text-[11px] uppercase tracking-[0.18em]">Trạng thái</div>
                            <div className={`mt-1 text-sm ${statusDisplay.primaryClassName || ''}`}>{statusDisplay.primary}</div>
                            {statusDisplay.secondary ? <div className="app-muted mt-1 text-xs">{statusDisplay.secondary}</div> : null}
                          </div>
                          <div className="col-span-2 min-w-0">
                            <div className="app-muted text-[11px] uppercase tracking-[0.18em]">Ghi chú</div>
                            <div className="mt-1 text-sm break-words">{formatSerialNote(row.note)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {activeDisplayDetail.serialPageCount > 1 ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium ${
                        activeDisplayDetail.serialPage <= 1 ? 'pointer-events-none opacity-50' : ''
                      }`}
                      style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => handleSelectItem(activeItemKey, activeDisplayDetail.serialPage - 1)}
                    >
                      Serial trước
                    </button>
                    <div className="app-muted text-center text-sm">
                      Trang serial {activeDisplayDetail.serialPage}/{activeDisplayDetail.serialPageCount}
                    </div>
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium ${
                        activeDisplayDetail.serialPage >= activeDisplayDetail.serialPageCount
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }`}
                      style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => handleSelectItem(activeItemKey, activeDisplayDetail.serialPage + 1)}
                    >
                      Serial sau
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="py-8 text-sm app-muted">Không tải được chi tiết serial cho dòng này.</div>
            )}
          </div>
        ) : (
          <div className="text-sm app-muted">Chọn một dòng hàng ở bảng trên để xem danh sách serial chi tiết.</div>
        )}
      </div>
    </section>
  )
}
