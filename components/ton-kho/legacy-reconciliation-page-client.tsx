'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { V2EmptyState } from '@/components/ui/v2-empty-state'
import { V2FilterBar } from '@/components/ui/v2-filter-bar'
import { V2SectionCard } from '@/components/ui/v2-section-card'
import type { LegacyReconciliationPageData } from '@/lib/ton-kho-thanh-pham/reconciliation-types'

export function LegacyReconciliationPageClient(props: {
  pageData: LegacyReconciliationPageData
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  const buildHref = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key)
      else params.set(key, value)
    }
    const queryString = params.toString()
    return queryString ? `${pathname}?${queryString}` : pathname
  }

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    router.push(
      buildHref({
        q: query.trim() || null,
        page: '1',
      })
    )
  }

  return (
    <div className="space-y-6">
      <V2FilterBar
        title="Lọc chứng từ còn legacy gap"
        description="Tìm theo mã phiếu, khách hàng, dự án, đơn hàng hoặc tên mặt hàng đang còn thiếu gắn serial."
        actions={
          <form className="grid gap-3 lg:grid-cols-[1fr_auto]" onSubmit={handleApplyFilters}>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              placeholder="VD: PX-E46E9D, Hiệp Mỹ Tây, MUI 9m..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
              type="submit"
            >
              Lọc chứng từ
            </button>
          </form>
        }
      />

      <V2SectionCard
        title="Chứng từ cần đối soát serial cũ"
        description="Mỗi dòng là một phiếu đã xuất theo số lượng nhưng còn thiếu gắn serial ở một hoặc nhiều mặt hàng."
        actions={
          <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">Số phiếu còn gap</div>
            <div className="mt-2 text-2xl font-semibold">{props.pageData.totalCount}</div>
          </div>
        }
      >
        {props.pageData.rows.length ? (
          <div className="space-y-4">
            {props.pageData.rows.map((row) => (
              <div
                key={row.voucherId}
                className="overflow-hidden rounded-2xl border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div
                  className="flex flex-wrap items-start justify-between gap-4 px-4 py-4"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
                >
                  <div>
                    <div className="text-lg font-semibold">{row.maPhieu}</div>
                    <div className="app-muted mt-1 text-sm">
                      {row.customerName || 'Chưa có khách hàng'}
                      {row.projectName ? ` · ${row.projectName}` : ''}
                      {row.orderLabel ? ` · ${row.orderLabel}` : ''}
                    </div>
                    <div className="app-muted mt-1 text-xs uppercase tracking-[0.18em]">
                      {row.sourceType === 'TON_KHO' ? 'Bán tồn kho' : 'Theo đơn hàng'} · {row.status}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-xl border px-4 py-3 text-right text-sm" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="app-muted text-xs uppercase tracking-[0.18em]">Tổng gap</div>
                      <div className="mt-2 text-xl font-semibold">{row.unresolvedQtyTotal}</div>
                    </div>
                    <div className="rounded-xl border px-4 py-3 text-right text-sm" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="app-muted text-xs uppercase tracking-[0.18em]">Số dòng</div>
                      <div className="mt-2 text-xl font-semibold">{row.lineCount}</div>
                    </div>
                    <Link
                      href={`/ton-kho/thanh-pham/doi-soat-legacy/${row.voucherId}`}
                      className="inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      Mở chi tiết đối soát
                    </Link>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                        <th className="px-4 py-3">Mặt hàng</th>
                        <th className="px-4 py-3 text-right">Đã xuất</th>
                        <th className="px-4 py-3 text-right">Đã gắn serial</th>
                        <th className="px-4 py-3 text-right">Đã trả</th>
                        <th className="px-4 py-3 text-right">Còn gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.lines.map((line) => (
                        <tr key={`${row.voucherId}::${line.itemKey}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td className="px-4 py-4 font-medium">{line.itemLabel}</td>
                          <td className="px-4 py-4 text-right">{line.actualQty}</td>
                          <td className="px-4 py-4 text-right">{line.assignedQty}</td>
                          <td className="px-4 py-4 text-right">{line.returnedQty}</td>
                          <td className="px-4 py-4 text-right font-semibold">{line.unresolvedQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {props.pageData.pageCount > 1 ? (
              <div className="flex items-center justify-between gap-3">
                <Link
                  className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium ${
                    props.pageData.filters.page <= 1 ? 'pointer-events-none opacity-50' : ''
                  }`}
                  style={{ borderColor: 'var(--color-border)' }}
                  href={buildHref({ page: props.pageData.filters.page > 1 ? String(props.pageData.filters.page - 1) : '1' })}
                >
                  Trang trước
                </Link>
                <div className="app-muted text-sm">
                  Trang {props.pageData.filters.page}/{props.pageData.pageCount}
                </div>
                <Link
                  className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium ${
                    props.pageData.filters.page >= props.pageData.pageCount ? 'pointer-events-none opacity-50' : ''
                  }`}
                  style={{ borderColor: 'var(--color-border)' }}
                  href={buildHref({
                    page:
                      props.pageData.filters.page < props.pageData.pageCount
                        ? String(props.pageData.filters.page + 1)
                        : String(props.pageData.pageCount),
                  })}
                >
                  Trang sau
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <V2EmptyState
            title="Chưa có chứng từ nào cần đối soát"
            description="Hiện chưa có phiếu xuất tay nào còn khoảng thiếu giữa số đã xuất và số serial đã gắn. Khi có legacy gap, danh sách sẽ hiện ở đây để kho xử lý dần."
          />
        )}
      </V2SectionCard>
    </div>
  )
}
