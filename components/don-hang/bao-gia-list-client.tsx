'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BaoGiaListItem, BaoGiaStatus } from '@/lib/bao-gia/repository'
import { isAdminRole, isCommercialRole, isSalesAccountingRole } from '@/lib/auth/roles'
import {
  submitBaoGiaProductionApproval,
  submitBaoGiaStatusTransition,
} from '@/lib/bao-gia/client-api'

const PAGE_SIZE = 15

export function BaoGiaListClient(props: { rows: BaoGiaListItem[]; viewerRole: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState(props.rows)
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | BaoGiaStatus | 'ALL'>('ACTIVE')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const commercialViewer = isCommercialRole(props.viewerRole)
  const salesAccountingViewer = isSalesAccountingRole(props.viewerRole)
  const adminViewer = isAdminRole(props.viewerRole)
  const canUpdateSalesResult = commercialViewer || adminViewer
  const canApproveProduction = salesAccountingViewer || adminViewer

  useEffect(() => {
    setRows(props.rows)
  }, [props.rows])

  const filteredRows = useMemo(() => {
    const normalized = normalizeText(query)
    const rowsByStatus =
      statusFilter === 'ALL'
        ? rows
        : statusFilter === 'ACTIVE'
          ? rows.filter((row) => row.status !== 'THAT_BAI')
          : rows.filter((row) => row.status === statusFilter)
    const searchedRows = !normalized
      ? rowsByStatus
      : rowsByStatus.filter((row) =>
      [row.maBaoGia, row.duAn, row.khachHang, row.statusLabel]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(normalized)
      )

    return [...searchedRows].sort((left, right) => {
      const leftTime = new Date(left.createdAt || '').getTime() || 0
      const rightTime = new Date(right.createdAt || '').getTime() || 0
      if (leftTime !== rightTime) return rightTime - leftTime
      return right.quoteId.localeCompare(left.quoteId)
    })
  }, [query, rows, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selectedSet = new Set(selectedIds)
  const selectedRow =
    selectedIds.length === 1 ? rows.find((row) => row.quoteId === selectedIds[0]) || null : null
  const allCurrentPageSelected = pagedRows.length > 0 && pagedRows.every((row) => selectedSet.has(row.quoteId))
  const salesStatusLocked = Boolean(selectedRow?.productionApproved)
  const hasSingleSelection = selectedIds.length === 1

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((item) => item !== id)))
  }

  function togglePageSelection(checked: boolean) {
    const pageIds = pagedRows.map((row) => row.quoteId)
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, ...pageIds])) : prev.filter((id) => !pageIds.includes(id))))
  }

  async function transition(status: BaoGiaStatus) {
    setError('')
    setMessage('')
    if (selectedIds.length !== 1) {
      setError('Chỉ được chọn 1 báo giá để chuyển trạng thái.')
      return
    }
    setActing(true)
    try {
      const result = await submitBaoGiaStatusTransition({
        quoteId: selectedIds[0],
        status,
        note,
      })
      setRows((current) =>
        current.map((row) =>
          row.quoteId === selectedIds[0]
            ? {
                ...row,
                status: result.data?.status || row.status,
                statusLabel: result.data?.statusLabel || row.statusLabel,
              }
            : row
        )
      )
      setMessage('Đã cập nhật trạng thái báo giá.')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái báo giá.')
    } finally {
      setActing(false)
    }
  }

  async function approveProduction() {
    setError('')
    setMessage('')
    if (selectedIds.length !== 1 || !selectedRow) {
      setError('Chỉ được chọn 1 báo giá để duyệt sản xuất.')
      return
    }
    setActing(true)
    try {
      const result = await submitBaoGiaProductionApproval({
        quoteId: selectedIds[0],
        note,
      })
      setRows((current) =>
        current.map((row) =>
          row.quoteId === selectedIds[0]
            ? {
                ...row,
                productionApproved: result.data?.productionApproved ?? true,
                productionApprovalLabel: result.data?.productionApprovalLabel || row.productionApprovalLabel,
              }
            : row
        )
      )
      setMessage('Đã duyệt sản xuất. QLSX sẽ thấy đơn hàng để lập kế hoạch.')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không duyệt sản xuất được.')
    } finally {
      setActing(false)
    }
  }

  return (
    <section className="space-y-5">
      {message ? (
        <section className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)', color: 'var(--color-primary)' }}>
          {message}
        </section>
      ) : null}
      {error ? <section className="app-accent-soft rounded-2xl px-4 py-3 text-sm">{error}</section> : null}

      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Danh sách báo giá</h2>
            <p className="app-muted mt-2 text-sm">Số dòng: {filteredRows.length} / {rows.length}</p>
          </div>
          <div className="flex w-full max-w-xl items-center gap-3">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as 'ACTIVE' | BaoGiaStatus | 'ALL')
                setPage(1)
              }}
              className="app-input w-48 rounded-xl px-4 py-3 text-sm"
            >
              <option value="ACTIVE">Ẩn thất bại</option>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="NHAP">Đã lưu báo giá</option>
              <option value="DA_XUAT_PDF">Đã xuất PDF</option>
              <option value="DA_GUI_KHACH">Đã gửi khách</option>
              <option value="DA_CHOT">Thành công</option>
              <option value="THAT_BAI">Thất bại</option>
            </select>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Tìm theo mã báo giá, dự án, khách hàng..." className="app-input w-full rounded-xl px-4 py-3 text-sm" />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                <th className="w-12 px-4 py-3"><input type="checkbox" checked={allCurrentPageSelected} onChange={(event) => togglePageSelection(event.target.checked)} /></th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Mã báo giá</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Dự án</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Khách hàng</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Version</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Số dự toán</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Tổng tiền</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.quoteId} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedSet.has(row.quoteId)} onChange={(event) => toggleSelected(row.quoteId, event.target.checked)} /></td>
                  <td className="px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => router.push(`/don-hang/bao-gia/${row.quoteId}`)}
                      className="cursor-pointer text-left transition hover:opacity-80"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {row.maBaoGia}
                    </button>
                  </td>
                  <td className="px-4 py-3">{row.duAn}</td>
                  <td className="px-4 py-3">{row.khachHang}</td>
                  <td className="px-4 py-3 text-right">{row.currentVersionNo}</td>
                  <td className="px-4 py-3 text-right">{row.sourceEstimateCount}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(row.totalAmount)}</td>
                  <td className="px-4 py-3">{row.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedIds.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ghi chú trạng thái / lưu ý thương mại..."
              className="app-input rounded-xl px-4 py-3 text-sm"
              disabled={!canUpdateSalesResult && !canApproveProduction}
            />
            <div className="flex flex-wrap items-center gap-3">
              {canUpdateSalesResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => void transition('DA_CHOT')}
                    disabled={acting || !hasSingleSelection || salesStatusLocked}
                    className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Thành công
                  </button>
                  <button
                    type="button"
                    onClick={() => void transition('THAT_BAI')}
                    disabled={acting || !hasSingleSelection || salesStatusLocked}
                    className="app-accent-soft rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Thất bại
                  </button>
                </>
              ) : null}
              {canApproveProduction && selectedRow?.status === 'DA_CHOT' && !selectedRow.productionApproved ? (
                <button
                  type="button"
                  onClick={() => void approveProduction()}
                  disabled={acting || !hasSingleSelection}
                  className="app-primary rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Duyệt sản xuất
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {selectedIds.length > 1 ? (
          <p className="app-muted mt-3 text-sm">
            Chỉ chọn 1 báo giá nếu muốn đổi trạng thái hoặc duyệt sản xuất.
          </p>
        ) : null}
        {salesStatusLocked ? (
          <p className="app-muted mt-3 text-sm">
            Báo giá đã duyệt sản xuất nên không thể đổi lại trạng thái kinh doanh.
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between text-sm">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="app-outline rounded-xl px-4 py-2 font-semibold disabled:opacity-50">Trang trước</button>
          <span className="app-muted">Trang {safePage} / {totalPages}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages} className="app-outline rounded-xl px-4 py-2 font-semibold disabled:opacity-50">Trang sau</button>
        </div>
      </section>
    </section>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value || 0))
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
