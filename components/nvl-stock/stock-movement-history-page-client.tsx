'use client'

import type { NvlStockMovementHistoryPageData } from '@/lib/nvl-stock/types'

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

function formatMovementNote(note: string, sourceId: string) {
  return extractDocumentCode(note) || extractDocumentCode(sourceId) || note || '-'
}

function getSignedQuantity(row: NvlStockMovementHistoryPageData['rows'][number]) {
  const raw = Number(row.quantity || 0)
  if (String(row.physicalEffect || '').toUpperCase() === 'OUT') return -Math.abs(raw)
  return Math.abs(raw)
}

export function NvlStockMovementHistoryPageClient(props: { pageData: NvlStockMovementHistoryPageData }) {
  const totalSignedQty = props.pageData.rows.reduce((sum, row) => sum + getSignedQuantity(row), 0)

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div>
          <h3 className="text-lg font-semibold">{props.pageData.materialName || props.pageData.materialCode}</h3>
          <p className="app-muted mt-2 text-sm">
            {props.pageData.materialCode}
            {props.pageData.unit ? ` · ${props.pageData.unit}` : ''}
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
              <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3">Biến động</th>
                <th className="px-4 py-3 text-right">SL</th>
                <th className="px-4 py-3">Kho</th>
                <th className="px-4 py-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {props.pageData.rows.length ? (
                <>
                  {props.pageData.rows.map((row) => (
                    <tr key={row.movementId} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-4">{formatDateLabel(row.movementDate)}</td>
                      <td className="px-4 py-4 font-semibold">{row.movementType}</td>
                      <td className="px-4 py-4 text-right font-semibold">{formatNumber(getSignedQuantity(row))}</td>
                      <td className="px-4 py-4">{row.warehouseLabel || '-'}</td>
                      <td className="px-4 py-4">{formatMovementNote(row.note, row.sourceId)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                    <td className="px-4 py-4" />
                    <td className="px-4 py-4 font-semibold">Tổng</td>
                    <td className="px-4 py-4 text-right font-semibold">{formatNumber(totalSignedQty)}</td>
                    <td className="px-4 py-4" />
                    <td className="px-4 py-4" />
                  </tr>
                </>
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center app-muted" colSpan={5}>
                    {props.pageData.schemaReady ? 'Chưa có movement nào cho vật tư này.' : 'Chưa có schema để đọc lịch sử biến động.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
