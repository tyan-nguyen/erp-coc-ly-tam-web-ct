'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isQlsxRole } from '@/lib/auth/roles'
import { submitBocTachBulkDelete } from '@/lib/boc-tach/client-api'

type BocTachListRow = {
  id: string
  displayId: string
  daId: string
  khId: string
  duAn: string
  khachHang: string
  loaiCoc: string
  soLuongMd: number
  phuongThucVanChuyen: string
  trangThai: string
  trangThaiLabel: string
  canDelete: boolean
  linkedQuoteStatus: string | null
  createdAt: string
}

const PAGE_SIZE = 15

export function BocTachListClient(props: {
  rows: BocTachListRow[]
  viewerRole: string
}) {
  const router = useRouter()
  const qlsxViewer = isQlsxRole(props.viewerRole)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(qlsxViewer ? 'DA_GUI' : 'ALL')
  const [quoteFilter, setQuoteFilter] = useState<'VISIBLE' | 'THAT_BAI' | 'ALL'>('VISIBLE')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    const rowsByStatus =
      statusFilter === 'ALL' ? props.rows : props.rows.filter((row) => row.trangThai === statusFilter)
    const rowsByQuoteStatus =
      quoteFilter === 'ALL'
        ? rowsByStatus
        : quoteFilter === 'THAT_BAI'
          ? rowsByStatus.filter((row) => row.linkedQuoteStatus === 'THAT_BAI')
          : rowsByStatus.filter((row) => row.linkedQuoteStatus !== 'THAT_BAI')
    const searchedRows = !normalizedQuery
      ? rowsByQuoteStatus
      : rowsByQuoteStatus.filter((row) =>
      [
        row.displayId,
        row.duAn,
        row.khachHang,
        row.loaiCoc,
        row.trangThaiLabel,
      ]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(normalizedQuery)
      )

    return [...searchedRows].sort((left, right) => {
      const leftTime = new Date(left.createdAt || '').getTime() || 0
      const rightTime = new Date(right.createdAt || '').getTime() || 0
      if (leftTime !== rightTime) return rightTime - leftTime
      return right.id.localeCompare(left.id)
    })
  }, [props.rows, query, statusFilter, quoteFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allCurrentPageSelected =
    pagedRows.length > 0 && pagedRows.every((row) => selectedSet.has(row.id))

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]))
      return prev.filter((item) => item !== id)
    })
  }

  function togglePageSelection(checked: boolean) {
    setSelectedIds((prev) => {
      const currentPageIds = pagedRows.map((row) => row.id)
      if (checked) return Array.from(new Set([...prev, ...currentPageIds]))
      return prev.filter((id) => !currentPageIds.includes(id))
    })
  }

  function exportQuote() {
    setError('')
    setMessage('')
    if (selectedIds.length === 0) {
      setError('Chưa chọn dự toán để xuất báo giá.')
      return
    }
    const selectedRows = props.rows.filter((row) => selectedSet.has(row.id))
    const invalidStatusRows = selectedRows.filter((row) => row.trangThai !== 'DA_DUYET_QLSX')
    if (invalidStatusRows.length > 0) {
      setError('Chỉ xuất báo giá từ các dự toán đã duyệt QLSX.')
      return
    }
    const first = selectedRows[0]
    const sameScope = selectedRows.every(
      (row) =>
        row.daId === first.daId &&
        row.khId === first.khId &&
        row.phuongThucVanChuyen === first.phuongThucVanChuyen
    )
    if (!sameScope) {
      setError('Chỉ ghép chung báo giá khi các dự toán cùng khách hàng, cùng dự án và cùng phương án vận chuyển.')
      return
    }
    router.push(`/don-hang/lap-bao-gia?ids=${selectedIds.join(',')}`)
  }

  async function deleteSelected() {
    setError('')
    setMessage('')
    if (selectedIds.length === 0) {
      setError('Chưa chọn hồ sơ để xóa.')
      return
    }

    const invalidRows = props.rows.filter(
      (row) => selectedSet.has(row.id) && !row.canDelete
    )
    if (invalidRows.length > 0) {
      setError('Có hồ sơ không còn ở trạng thái cho phép xóa. Chỉ xóa được hồ sơ Nháp hoặc Trả lại chỉnh sửa.')
      return
    }

    if (!window.confirm(`Xóa ${selectedIds.length} hồ sơ đã chọn?`)) return

    setDeleting(true)
    try {
      await submitBocTachBulkDelete(selectedIds)

      setSelectedIds([])
      setMessage('Đã xóa hồ sơ đã chọn.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được hồ sơ.')
    } finally {
      setDeleting(false)
    }
  }

  function ActionBar(props: { sticky?: boolean }) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 ${
          props.sticky ? 'sticky bottom-4 z-20 shadow-sm' : ''
        }`}
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {!qlsxViewer ? (
            <button
              type="button"
              onClick={deleteSelected}
              disabled={deleting || selectedIds.length === 0}
              className="app-accent-soft rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </button>
          ) : null}
          {!qlsxViewer ? (
            <button
              type="button"
              onClick={exportQuote}
              disabled={selectedIds.length === 0}
              className="app-primary rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Xuất báo giá
            </button>
          ) : null}
        </div>
        <span className="app-muted text-sm">
          Đã chọn: <span className="font-semibold">{selectedIds.length}</span>
        </span>
      </div>
    )
  }

  return (
    <section className="space-y-5">
      {message ? (
        <section
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)',
            backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
            color: 'var(--color-primary)',
          }}
        >
          {message}
        </section>
      ) : null}
      {error ? <section className="app-accent-soft rounded-2xl px-4 py-3 text-sm">{error}</section> : null}

      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Danh sách bóc tách</h2>
            <p className="app-muted mt-2 text-sm">
              Số dòng: {filteredRows.length} / {props.rows.length}
            </p>
          </div>
          <div className="flex w-full max-w-xl items-center gap-3">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              className="app-input w-52 rounded-xl px-4 py-3 text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DA_GUI">Đã gửi QLSX</option>
              <option value="DA_DUYET_QLSX">Đã duyệt QLSX</option>
              <option value="TRA_LAI">Trả lại chỉnh sửa</option>
              {!qlsxViewer ? <option value="NHAP">Nháp</option> : null}
            </select>
            <select
              value={quoteFilter}
              onChange={(event) => {
                setQuoteFilter(event.target.value as 'VISIBLE' | 'THAT_BAI' | 'ALL')
                setPage(1)
              }}
              className="app-input w-48 rounded-xl px-4 py-3 text-sm"
            >
              <option value="VISIBLE">Ẩn thất bại</option>
              <option value="ALL">Tất cả báo giá</option>
              <option value="THAT_BAI">Chỉ báo giá thất bại</option>
            </select>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo ID, dự án, khách hàng, loại cọc..."
              className="app-input w-full rounded-xl px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={(event) => togglePageSelection(event.target.checked)}
                    aria-label="Chọn tất cả trên trang"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">ID</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Dự án</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Khách hàng</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Loại cọc</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Số lượng (md)</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-sm app-muted">
                    Chưa có hồ sơ bóc tách phù hợp.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-border) 72%, white)' }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(row.id)}
                        onChange={(event) => toggleSelected(row.id, event.target.checked)}
                        aria-label={`Chọn ${row.displayId}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => router.push(`/boc-tach/boc-tach-nvl/${row.id}`)}
                        className="cursor-pointer text-left transition hover:opacity-80"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {row.displayId}
                      </button>
                    </td>
                    <td className="px-4 py-3">{formatProjectName(row.duAn)}</td>
                    <td className="px-4 py-3">{row.khachHang}</td>
                    <td className="px-4 py-3">{formatLoaiCocShort(row.loaiCoc)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.soLuongMd)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                        style={statusBadgeStyle(row.trangThai)}
                      >
                        {row.trangThaiLabel}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="app-outline rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Trang trước
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="app-outline rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Trang sau
            </button>
          </div>

          <div className="flex items-center gap-3">
            <p className="app-muted text-sm">
              Trang {safePage} / {totalPages}
            </p>
            <label className="app-muted text-sm" htmlFor="boc-tach-page-input">
              Đi đến trang
            </label>
            <input
              id="boc-tach-page-input"
              type="number"
              min={1}
              max={totalPages}
              value={safePage}
              onChange={(event) => {
                const value = Number(event.target.value || 1)
                setPage(Math.min(totalPages, Math.max(1, value)))
              }}
              className="app-input w-20 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {selectedIds.length > 0 ? <ActionBar sticky /> : null}
    </section>
  )
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function formatProjectName(value: string) {
  const normalized = String(value || '').trim()
  return normalized.replace(/^DA-[A-Z0-9-]+\s*-\s*/i, '') || normalized
}

function formatLoaiCocShort(value: string) {
  const normalized = String(value || '').trim()
  return normalized.split('-')[0]?.trim() || normalized
}

function statusBadgeStyle(status: string) {
  if (status === 'DA_GUI') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, white)',
      color: 'var(--color-accent)',
    }
  }

  if (status === 'DA_DUYET_QLSX') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, white)',
      color: 'var(--color-primary)',
    }
  }

  if (status === 'TRA_LAI') {
    return {
      backgroundColor: 'color-mix(in srgb, #f59e0b 16%, white)',
      color: '#b45309',
    }
  }

  return {
    backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
    color: 'var(--color-primary)',
  }
}
