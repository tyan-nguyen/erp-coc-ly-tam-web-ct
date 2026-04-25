'use client'

import { useMemo, useState } from 'react'
import type {
  ProductionVarianceMaterialRow,
  ProductionVarianceReportPageData,
  ProductionVarianceReportRow,
} from '@/lib/production-variance-report/types'

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)}%`
}

function formatDate(value: string) {
  if (!value) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <div className="app-muted text-[11px] uppercase tracking-[0.18em]">{props.label}</div>
      <div className="mt-1 text-sm">{props.value}</div>
    </div>
  )
}

const tableHeaderClass = 'px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]'
const tableHeaderStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)',
}
const stickyTableHeaderClass = `sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--color-border)] ${tableHeaderClass}`

function varianceClass(value: number | null | undefined) {
  if (value === null || value === undefined) return ''
  if (value > 0) return 'text-red-600'
  if (value < 0) return 'text-emerald-700'
  return ''
}

export function ProductionVarianceReportClient(props: {
  pageData: ProductionVarianceReportPageData
}) {
  const [activePlanId, setActivePlanId] = useState(() => props.pageData.rows[0]?.planId ?? '')
  const activeRow = useMemo(
    () => props.pageData.rows.find((row) => row.planId === activePlanId) ?? props.pageData.rows[0] ?? null,
    [activePlanId, props.pageData.rows]
  )

  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <section className="px-6 py-6">
        <h1 className="text-2xl font-bold">Báo cáo chênh lệch sản xuất</h1>
      </section>

      <section className="border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" method="get">
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Từ ngày</span>
            <input
              type="date"
              name="from"
              defaultValue={props.pageData.filters.fromDate}
              className="app-input w-full rounded-xl px-3 py-3 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold">Đến ngày</span>
            <input
              type="date"
              name="to"
              defaultValue={props.pageData.filters.toDate}
              className="app-input w-full rounded-xl px-3 py-3 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="app-primary w-full rounded-xl px-5 py-3 text-sm font-semibold md:w-auto">
              Xem báo cáo
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-5 border-t px-6 py-5 md:grid-cols-4" style={{ borderColor: 'var(--color-border)' }}>
        <Metric label="Số ngày" value={formatNumber(props.pageData.summary.planCount)} />
        <Metric label="Thực sản xuất" value={formatNumber(props.pageData.summary.warehouseActualQty)} />
        <Metric label="QC đạt" value={formatNumber(props.pageData.summary.qcAcceptedQty)} />
        <Metric label="Cọc lỗi" value={formatNumber(props.pageData.summary.defectQty)} />
        <Metric label="NVL dự toán" value={formatNumber(props.pageData.summary.materialEstimatedQty)} />
        <Metric label="NVL thực xuất" value={formatNumber(props.pageData.summary.materialActualQty)} />
        <Metric label="Lệch NVL" value={formatNumber(props.pageData.summary.materialVarianceQty)} />
        <Metric label="% lệch" value={formatPercent(props.pageData.summary.materialVariancePct)} />
      </section>

      <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold">Tổng hợp theo ngày</h2>
        </div>

        <div className="divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          {props.pageData.rows.map((row) => (
            <button
              key={row.planId}
              type="button"
              onClick={() => setActivePlanId(row.planId)}
              className="block w-full px-6 py-5 text-left"
              style={{ backgroundColor: row.planId === activeRow?.planId ? 'color-mix(in srgb, var(--color-primary) 4%, white)' : undefined }}
            >
              <div className="text-lg font-semibold">{formatDate(row.date)}</div>
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5">
                <Metric label="KHSX" value={formatNumber(row.plannedQty)} />
                <Metric label="Thực SX" value={formatNumber(row.warehouseActualQty)} />
                <Metric label="QC đạt" value={formatNumber(row.qcAcceptedQty)} />
                <Metric label="Cọc lỗi" value={formatNumber(row.defectQty)} />
                <Metric label="Lệch NVL" value={formatNumber(row.materialVarianceQty)} />
                <Metric label="% lệch" value={formatPercent(row.materialVariancePct)} />
              </div>
            </button>
          ))}
        </div>

        <div className="hidden overflow-x-auto border-t md:block" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={`${stickyTableHeaderClass} text-left`} style={tableHeaderStyle}>Ngày</th>
                <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>KHSX</th>
                <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>Thực SX</th>
                <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>QC đạt</th>
                <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>Cọc lỗi</th>
                <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>NVL dự toán</th>
                <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>NVL thực xuất</th>
                <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>Lệch %</th>
              </tr>
            </thead>
            <tbody>
              {props.pageData.rows.map((row) => (
                <tr
                  key={row.planId}
                  onClick={() => setActivePlanId(row.planId)}
                  className="cursor-pointer border-t"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: row.planId === activeRow?.planId ? 'color-mix(in srgb, var(--color-primary) 4%, white)' : 'white',
                  }}
                >
                  <td className="px-4 py-4 font-semibold">{formatDate(row.date)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.plannedQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.warehouseActualQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.qcAcceptedQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.defectQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.materialEstimatedQty)}</td>
                  <td className="px-4 py-4 text-right">{formatNumber(row.materialActualQty)}</td>
                  <td className={`px-4 py-4 text-right font-semibold ${varianceClass(row.materialVariancePct)}`}>
                    {formatPercent(row.materialVariancePct)}
                  </td>
                </tr>
              ))}
              {props.pageData.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    Chưa có kế hoạch sản xuất trong khoảng ngày đang chọn.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <MaterialDetail row={activeRow} />
    </div>
  )
}

function MaterialDetail({ row }: { row: ProductionVarianceReportRow | null }) {
  if (!row) return null

  return (
    <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="px-6 py-5">
        <h2 className="text-lg font-semibold">Chi tiết vật tư ngày {formatDate(row.date)}</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-4">
          <Metric label="NVL dự toán" value={formatNumber(row.materialEstimatedQty)} />
          <Metric label="NVL thực xuất" value={formatNumber(row.materialActualQty)} />
          <Metric label="Chênh lệch" value={formatNumber(row.materialVarianceQty)} />
          <Metric label="% chênh lệch" value={formatPercent(row.materialVariancePct)} />
        </div>
      </div>

      <div className="divide-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
        {row.materialRows.map((material) => (
          <MaterialMobileRow key={material.key} material={material} />
        ))}
      </div>

      <div className="hidden overflow-x-auto border-t md:block" style={{ borderColor: 'var(--color-border)' }}>
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={`${stickyTableHeaderClass} text-left`} style={tableHeaderStyle}>Vật tư</th>
              <th className={`${stickyTableHeaderClass} text-left`} style={tableHeaderStyle}>Nhóm</th>
              <th className={`${stickyTableHeaderClass} text-left`} style={tableHeaderStyle}>ĐVT</th>
              <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>SL dự toán</th>
              <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>SL thực xuất</th>
              <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>Chênh lệch</th>
              <th className={`${stickyTableHeaderClass} text-right`} style={tableHeaderStyle}>%</th>
            </tr>
          </thead>
          <tbody>
            {row.materialRows.map((material) => (
              <tr key={material.key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-4 py-4 font-semibold">{material.label}</td>
                <td className="px-4 py-4 text-[var(--color-muted)]">{material.group || '-'}</td>
                <td className="px-4 py-4 text-[var(--color-muted)]">{material.unit || '-'}</td>
                <td className="px-4 py-4 text-right">{formatNumber(material.estimatedQty)}</td>
                <td className="px-4 py-4 text-right">{formatNumber(material.actualQty)}</td>
                <td className={`px-4 py-4 text-right font-semibold ${varianceClass(material.varianceQty)}`}>
                  {formatNumber(material.varianceQty)}
                </td>
                <td className={`px-4 py-4 text-right font-semibold ${varianceClass(material.variancePct)}`}>
                  {formatPercent(material.variancePct)}
                </td>
              </tr>
            ))}
            {row.materialRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted)]">
                  Ngày này chưa có phiếu xuất NVL sản xuất.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MaterialMobileRow({ material }: { material: ProductionVarianceMaterialRow }) {
  return (
    <div className="px-6 py-5">
      <div className="text-base font-semibold">{material.label}</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">
        {[material.group, material.unit].filter(Boolean).join(' · ') || '-'}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5">
        <Metric label="Dự toán" value={formatNumber(material.estimatedQty)} />
        <Metric label="Thực xuất" value={formatNumber(material.actualQty)} />
        <Metric label="Chênh lệch" value={formatNumber(material.varianceQty)} />
        <Metric label="%" value={formatPercent(material.variancePct)} />
      </div>
    </div>
  )
}
