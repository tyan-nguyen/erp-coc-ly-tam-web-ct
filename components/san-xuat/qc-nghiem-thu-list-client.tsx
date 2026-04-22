'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { QcPlanListItem } from '@/lib/san-xuat/types'

export function QcNghiemThuListClient(props: {
  rows: QcPlanListItem[]
  viewerRole: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filteredRows = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return props.rows
    return props.rows.filter((row) =>
      [row.plan.ngay_ke_hoach, row.plan.trang_thai, row.plan.ghi_chu]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [props.rows, query])

  function openPlan(planId: string) {
    router.push(`/san-xuat/qc-nghiem-thu/${planId}?from=list`)
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Danh sách ngày chờ nghiệm thu QC</h2>
            <p className="app-muted mt-2 text-sm">{props.rows.length} kế hoạch đủ điều kiện QC</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="app-input w-full max-w-md rounded-xl px-4 py-2 text-sm"
            placeholder="Tìm theo ngày, trạng thái, ghi chú..."
          />
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Ngày</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Trạng thái KH</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Số đơn</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Số dòng</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL kế hoạch</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">QC</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.plan.plan_id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 font-semibold">{formatDisplayDate(row.plan.ngay_ke_hoach)}</td>
                  <td className="px-4 py-3">{formatPlanStatus(row.plan.trang_thai)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.orderCount)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.lineCount)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.totalPlannedQty)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-sm font-semibold"
                      style={{
                        backgroundColor: row.qcConfirmed
                          ? 'color-mix(in srgb, var(--color-primary) 12%, white)'
                          : 'color-mix(in srgb, var(--color-warning,#f59e0b) 14%, white)',
                        color: row.qcConfirmed ? 'var(--color-primary)' : 'var(--color-warning,#b45309)',
                      }}
                    >
                      {row.qcConfirmed ? 'Đã QC' : 'Chờ QC'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openPlan(row.plan.plan_id)}
                      className="app-outline rounded-xl px-4 py-2 text-sm font-semibold"
                    >
                      Mở
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                    Chưa có kế hoạch nào đủ điều kiện để QC nghiệm thu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0))
}

function formatDisplayDate(value: string) {
  const [year, month, day] = String(value || '').split('-')
  if (!year || !month || !day) return value || '-'
  return `${day}/${month}/${year}`
}

function formatPlanStatus(status: string) {
  if (status === 'DA_CHOT') return 'Đã chốt kế hoạch'
  if (status === 'NHAP') return 'Nháp'
  return status || '-'
}
