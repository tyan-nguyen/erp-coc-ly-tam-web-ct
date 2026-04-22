'use client'

import { useEffect, useMemo, useState } from 'react'
import type { NvlStockMovementHistoryPageData, NvlStockTruthPageData } from '@/lib/nvl-stock/types'

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function formatDateLabel(value: string) {
  if (!value) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

function extractDocumentCode(input: string) {
  const text = String(input || '')
  const match = text.match(/[A-Z]{2,}(?:-[A-Z]+)*-\d{8}-\d+/u)
  return match?.[0] || ''
}

function formatMovementNote(row: NvlStockMovementHistoryPageData['rows'][number]) {
  if (String(row.movementType || '').trim() === 'Xuất cho sản xuất') {
    return `Xuất SX ngày ${formatDateLabel(row.movementDate)}`
  }
  const note = String(row.note || '')
  const sourceId = String(row.sourceId || '')
  return extractDocumentCode(note) || extractDocumentCode(sourceId) || note || '-'
}

function getSignedQuantity(row: NvlStockMovementHistoryPageData['rows'][number]) {
  const raw = Number(row.quantity || 0)
  if (String(row.physicalEffect || '').toUpperCase() === 'OUT') return -Math.abs(raw)
  return Math.abs(raw)
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getMaterialSubLabel(row: NvlStockTruthPageData['rows'][number]) {
  const code = String(row.materialCode || '').trim()
  if (!code) return ''
  if (code.includes('::')) return ''
  return code
}

type StockFilter = 'ALL' | 'IN_STOCK' | 'PENDING'

export function NvlStockTruthPageClient(props: { pageData: NvlStockTruthPageData }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StockFilter>('ALL')
  const [activeMaterialCode, setActiveMaterialCode] = useState('')
  const [historyData, setHistoryData] = useState<NvlStockMovementHistoryPageData | null>(null)
  const [historyPending, setHistoryPending] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    return props.pageData.rows.filter((row) => {
      if (filter === 'IN_STOCK' && Number(row.stockQty || 0) <= 0) return false
      if (filter === 'PENDING' && Number(row.blockedQty || 0) <= 0) return false

      if (!normalizedQuery) return true

      const haystack = normalizeText(
        [row.materialName, row.materialCode, row.unit, row.lastMovementDate].filter(Boolean).join(' ')
      )
      return haystack.includes(normalizedQuery)
    })
  }, [filter, props.pageData.rows, query])

  useEffect(() => {
    if (!activeMaterialCode) {
      setHistoryData(null)
      setHistoryPending(false)
      setHistoryError('')
      return
    }

    let cancelled = false

    async function loadHistory() {
      try {
        setHistoryPending(true)
        setHistoryError('')
        const response = await fetch(`/api/nvl-stock/history?materialCode=${encodeURIComponent(activeMaterialCode)}`, {
          cache: 'no-store',
        })
        const payload = (await response.json()) as {
          ok?: boolean
          error?: string
          data?: NvlStockMovementHistoryPageData
        }
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || 'Không tải được lịch sử tồn NVL.')
        }
        if (cancelled) return
        setHistoryData(payload.data)
      } catch (error) {
        if (cancelled) return
        setHistoryData(null)
        setHistoryError(error instanceof Error ? error.message : 'Không tải được lịch sử tồn NVL.')
      } finally {
        if (!cancelled) setHistoryPending(false)
      }
    }

    loadHistory()

    return () => {
      cancelled = true
    }
  }, [activeMaterialCode])

  const activeRow = filteredRows.find((row) => row.materialCode === activeMaterialCode) || null
  const totalSignedQty = historyData?.rows.reduce((sum, row) => sum + getSignedQuantity(row), 0) || 0
  const effectiveStockQty = historyData && activeRow ? totalSignedQty : Number(activeRow?.stockQty || 0)
  const effectiveBlockedQty = Number(activeRow?.blockedQty || 0)
  const effectiveAvailableQty = Math.max(effectiveStockQty - effectiveBlockedQty, 0)

  return (
    <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
      <section className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Bảng tồn kho NVL</h3>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-nowrap md:items-center">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm NVL, mã, ĐVT..."
              className="app-input h-11 w-full rounded-xl px-4 text-sm md:w-[320px]"
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as StockFilter)}
              className="app-input h-11 w-full rounded-xl px-4 text-sm md:w-[170px]"
            >
              <option value="ALL">Tất cả</option>
              <option value="IN_STOCK">Còn tồn</option>
              <option value="PENDING">Chờ xử lý</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border max-md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          <div className="max-h-[620px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                  <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>NVL</th>
                  <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>ĐVT</th>
                  <th className="sticky top-0 z-10 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Tồn vật lý</th>
                  <th className="sticky top-0 z-10 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Khả dụng</th>
                  <th className="sticky top-0 z-10 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Chờ xử lý</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((row) => {
                    const selected = row.materialCode === activeMaterialCode
                    return (
                      <tr
                        key={row.materialCode}
                        onClick={() => setActiveMaterialCode((current) => (current === row.materialCode ? '' : row.materialCode))}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderTop: '1px solid var(--color-border)',
                          backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 6%, white)' : 'transparent',
                        }}
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold">{row.materialName}</div>
                          {getMaterialSubLabel(row) ? <div className="app-muted mt-1 text-xs">{getMaterialSubLabel(row)}</div> : null}
                        </td>
                        <td className="px-4 py-4">{row.unit || '-'}</td>
                        <td className="px-4 py-4 text-right font-semibold">{formatNumber(row.stockQty)}</td>
                        <td className="px-4 py-4 text-right">{formatNumber(row.availableQty)}</td>
                        <td className="px-4 py-4 text-right">{formatNumber(row.blockedQty)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center app-muted" colSpan={5}>
                      {props.pageData.schemaReady ? 'Không có NVL nào khớp bộ lọc.' : 'Chưa có schema để đọc tồn kho NVL.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          {filteredRows.length ? (
            filteredRows.map((row) => {
              const selected = row.materialCode === activeMaterialCode
              return (
                <button
                  key={row.materialCode}
                  type="button"
                  onClick={() => setActiveMaterialCode((current) => (current === row.materialCode ? '' : row.materialCode))}
                  className="w-full px-0 py-4 text-left"
                  style={{
                    backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 6%, white)' : 'transparent',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{row.materialName}</div>
                      {getMaterialSubLabel(row) ? <div className="app-muted mt-1 text-xs">{getMaterialSubLabel(row)}</div> : null}
                    </div>
                    <div className="rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)' }}>
                      {row.unit || '-'}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="app-muted text-[11px] uppercase tracking-[0.14em]">Tồn</div>
                      <div className="mt-1 font-semibold">{formatNumber(row.stockQty)}</div>
                    </div>
                    <div>
                      <div className="app-muted text-[11px] uppercase tracking-[0.14em]">Khả dụng</div>
                      <div className="mt-1 font-semibold">{formatNumber(row.availableQty)}</div>
                    </div>
                    <div>
                      <div className="app-muted text-[11px] uppercase tracking-[0.14em]">Chờ xử lý</div>
                      <div className="mt-1 font-semibold">{formatNumber(row.blockedQty)}</div>
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="py-8 text-center app-muted">
              {props.pageData.schemaReady ? 'Không có NVL nào khớp bộ lọc.' : 'Chưa có schema để đọc tồn kho NVL.'}
            </div>
          )}
        </div>
      </section>

      <section className="border-t px-4 py-4 sm:px-6 sm:py-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Lịch sử biến động</h3>
            {activeRow ? (
              <div className="mt-2 space-y-1">
                <div className="text-sm app-muted">
                  {activeRow.materialName}
                  {activeRow.unit ? ` · ${activeRow.unit}` : ''}
                </div>
                <div className="text-sm app-muted">
                  Tồn vật lý = tổng nhập - tổng xuất. Có thể xuất = tồn vật lý - chờ xử lý.
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm app-muted">Chọn một dòng NVL ở bảng trên để xem lịch sử ngay bên dưới.</div>
            )}
          </div>
          {historyData && activeRow ? (
            <div className="text-sm app-muted">
              Tồn vật lý hiện tại: <span className="font-medium text-[var(--color-foreground)]">{formatNumber(effectiveStockQty)}</span>
            </div>
          ) : null}
        </div>

        {activeRow ? (
          <div className="mt-4 grid gap-3 border-t border-b py-3 text-sm md:grid-cols-3" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <div className="app-muted text-[11px] uppercase tracking-[0.14em]">Tồn vật lý</div>
              <div className="mt-1 font-semibold">{formatNumber(effectiveStockQty)}</div>
            </div>
            <div>
              <div className="app-muted text-[11px] uppercase tracking-[0.14em]">Có thể xuất</div>
              <div className="mt-1 font-semibold">{formatNumber(effectiveAvailableQty)}</div>
            </div>
            <div>
              <div className="app-muted text-[11px] uppercase tracking-[0.14em]">Chờ xử lý</div>
              <div className="mt-1 font-semibold">{formatNumber(effectiveBlockedQty)}</div>
            </div>
          </div>
        ) : null}

        {historyPending ? <div className="mt-5 text-sm app-muted">Đang tải lịch sử...</div> : null}
        {historyError ? <div className="mt-5 text-sm text-red-600">{historyError}</div> : null}

        {!historyPending && !historyError && activeRow && historyData ? (
          <div className="mt-4 overflow-hidden rounded-2xl border max-md:hidden" style={{ borderColor: 'var(--color-border)' }}>
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                  <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                    <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Ngày</th>
                    <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Biến động</th>
                    <th className="sticky top-0 z-10 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>SL</th>
                    <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Kho</th>
                    <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.rows.length ? (
                    <>
                      {historyData.rows.map((row) => (
                        <tr key={row.movementId} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td className="px-4 py-4">{formatDateLabel(row.movementDate)}</td>
                        <td className="px-4 py-4 font-semibold">{row.movementType}</td>
                        <td className="px-4 py-4 text-right font-semibold">{formatNumber(getSignedQuantity(row))}</td>
                          <td className="px-4 py-4">{row.warehouseLabel || '-'}</td>
                          <td className="px-4 py-4">{formatMovementNote(row)}</td>
                        </tr>
                      ))}
                      <tr
                        style={{
                          borderTop: '1px solid var(--color-border)',
                          backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)',
                        }}
                      >
                        <td className="px-4 py-4" />
                        <td className="px-4 py-4 font-semibold">Cân đối hiện tại</td>
                        <td className="px-4 py-4 text-right font-semibold">{formatNumber(totalSignedQty)}</td>
                        <td className="px-4 py-4" />
                        <td className="px-4 py-4" />
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center app-muted" colSpan={5}>
                        {historyData.schemaReady ? 'Chưa có movement nào cho vật tư này.' : 'Chưa có schema để đọc lịch sử biến động.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {!historyPending && !historyError && activeRow && historyData ? (
          <div className="mt-4 divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
            {historyData.rows.length ? (
              <>
                {historyData.rows.map((row) => (
                  <div key={row.movementId} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{row.movementType}</div>
                        <div className="app-muted mt-1 text-xs">{formatDateLabel(row.movementDate)}</div>
                      </div>
                      <div className="text-right font-semibold">{formatNumber(getSignedQuantity(row))}</div>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm">
                      <div><span className="app-muted">Kho:</span> {row.warehouseLabel || '-'}</div>
                      <div><span className="app-muted">Ghi chú:</span> {formatMovementNote(row)}</div>
                    </div>
                  </div>
                ))}
                <div className="py-4 text-sm">
                  <span className="app-muted">Cân đối hiện tại:</span>{' '}
                  <span className="font-semibold">{formatNumber(totalSignedQty)}</span>
                </div>
              </>
            ) : (
              <div className="py-8 text-center app-muted">
                {historyData.schemaReady ? 'Chưa có movement nào cho vật tư này.' : 'Chưa có schema để đọc lịch sử biến động.'}
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}
