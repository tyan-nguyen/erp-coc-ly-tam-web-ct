'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { submitCreateFinishedGoodsCountSheet } from '@/lib/finished-goods-counting/client-api'
import { FinishedGoodsOpeningBalancePageClient } from '@/components/ton-kho/finished-goods-opening-balance-page-client'
import { normalizeRole } from '@/lib/auth/roles'
import type {
  FinishedGoodsCountCatalogOption,
  FinishedGoodsCountDraftLine,
  FinishedGoodsCountingPageData,
} from '@/lib/finished-goods-counting/types'
import type { FinishedGoodsOpeningBalancePageData } from '@/lib/ton-kho-thanh-pham/opening-balance-types'

const FINISHED_GOODS_COUNT_LOOKUP_DRAFT_KEY = 'fg-count-lookup-draft'

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

function formatStatusLabel(value: FinishedGoodsCountingPageData['savedSheets'][number]['status']) {
  switch (value) {
    case 'NHAP':
      return 'Nháp'
    case 'CHO_XAC_NHAN_KHO':
      return 'Chờ thủ kho xác nhận'
    case 'CHO_DUYET_CHENH_LECH':
      return 'Chờ Admin duyệt'
    case 'DA_DUYET':
      return 'Đã duyệt'
    case 'DA_DIEU_CHINH_TON':
      return 'Đã điều chỉnh tồn'
    case 'HUY':
      return 'Hủy'
    default:
      return value
  }
}

function formatCountModeLabel(value: FinishedGoodsCountingPageData['savedSheets'][number]['countMode']) {
  return value === 'TON_DAU_KY' ? 'Nhập tồn đầu kỳ' : 'Kiểm kê vận hành'
}

function buildDraftLine(option: FinishedGoodsCountCatalogOption): FinishedGoodsCountDraftLine {
  return {
    id: `fg-count-${option.itemKey}`,
    itemKey: option.itemKey,
    itemLabel: option.itemLabel,
    loaiCoc: option.loaiCoc,
    tenDoan: option.tenDoan,
    chieuDaiM: option.chieuDaiM,
    systemQty: option.systemQty,
    note: '',
  }
}

export function FinishedGoodsCountPageClient(props: {
  pageData: FinishedGoodsCountingPageData
  openingBalancePageData: FinishedGoodsOpeningBalancePageData
  currentRole: string
}) {
  const normalizedRole = normalizeRole(props.currentRole)
  const canCreateDraft =
    normalizedRole === 'admin' ||
    normalizedRole === 'kiem ke vien' ||
    normalizedRole === 'kiemke vien' ||
    normalizedRole === 'kiem ke' ||
    normalizedRole === 'inventory counter'
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const requestedCountType = searchParams.get('count_type') === 'TON_DAU_KY' ? 'TON_DAU_KY' : 'VAN_HANH'
  const [countDate, setCountDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [countType, setCountType] = useState<'VAN_HANH' | 'TON_DAU_KY'>(requestedCountType)
  const [note, setNote] = useState('')
  const [selectedItemKey, setSelectedItemKey] = useState('')
  const [lines, setLines] = useState<FinishedGoodsCountDraftLine[]>([])
  const [lookupLoaiCoc, setLookupLoaiCoc] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const draft = window.sessionStorage.getItem(FINISHED_GOODS_COUNT_LOOKUP_DRAFT_KEY)
    if (!draft) return
    try {
      const parsed = JSON.parse(draft) as {
        countDate?: string
        note?: string
        selectedItemKey?: string
        lines?: FinishedGoodsCountDraftLine[]
        lookupLoaiCoc?: string
      }
      setCountDate(parsed.countDate || new Date().toISOString().slice(0, 10))
      setNote(parsed.note || '')
      setSelectedItemKey(parsed.selectedItemKey || '')
      setLines(Array.isArray(parsed.lines) ? parsed.lines : [])
      setLookupLoaiCoc(parsed.lookupLoaiCoc || '')
    } catch {
      // ignore malformed draft
    }
    window.sessionStorage.removeItem(FINISHED_GOODS_COUNT_LOOKUP_DRAFT_KEY)
  }, [])

  useEffect(() => {
    setCountType(requestedCountType)
  }, [requestedCountType])

  useEffect(() => {
    const selectedLoaiCoc = searchParams.get('selected_loai_coc')
    if (!selectedLoaiCoc) return
    setLookupLoaiCoc(selectedLoaiCoc)
    const firstMatchedOption = props.pageData.catalogOptions.find((option) => option.loaiCoc === selectedLoaiCoc)
    if (firstMatchedOption) {
      setSelectedItemKey(firstMatchedOption.itemKey)
    }
    const nextParams = new URLSearchParams(searchParamsString)
    nextParams.delete('selected_loai_coc')
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, props.pageData.catalogOptions, router, searchParams, searchParamsString])

  function handleCountTypeChange(nextType: 'VAN_HANH' | 'TON_DAU_KY') {
    if (nextType === countType) return
    setCountType(nextType)
    const nextParams = new URLSearchParams(searchParamsString)
    if (nextType === 'TON_DAU_KY') {
      nextParams.set('count_type', 'TON_DAU_KY')
    } else {
      nextParams.delete('count_type')
    }
    const nextQuery = nextParams.toString()
    const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname
    window.requestAnimationFrame(() => {
      router.replace(nextHref, { scroll: false })
    })
  }

  const visibleCatalogOptions = useMemo(
    () =>
      lookupLoaiCoc
        ? props.pageData.catalogOptions.filter((option) => option.loaiCoc === lookupLoaiCoc)
        : props.pageData.catalogOptions,
    [lookupLoaiCoc, props.pageData.catalogOptions]
  )

  const selectedOption = useMemo(
    () => visibleCatalogOptions.find((option) => option.itemKey === selectedItemKey) || null,
    [selectedItemKey, visibleCatalogOptions]
  )

  function handleOpenLookup() {
    const returnTo = searchParamsString ? `${pathname}?${searchParamsString}` : pathname
    window.sessionStorage.setItem(
      FINISHED_GOODS_COUNT_LOOKUP_DRAFT_KEY,
      JSON.stringify({
        countDate,
        note,
        selectedItemKey,
        lines,
        lookupLoaiCoc,
      })
    )
    router.push(`/ton-kho/thanh-pham/tra-cuu-coc?return_to=${encodeURIComponent(returnTo)}`)
  }

  function addSelectedItem() {
    if (!selectedOption) {
      setError('Cần chọn pool cọc trước khi thêm vào phiếu kiểm kê.')
      return
    }

    setError('')
    setLines((current) => {
      if (current.some((line) => line.itemKey === selectedOption.itemKey)) return current
      return [...current, buildDraftLine(selectedOption)]
    })
    setSelectedItemKey('')
  }

  async function handleCreate() {
    setMessage('')
    setError('')

    if (!props.pageData.schemaReady) {
      setError('Schema kiểm kê chưa sẵn sàng. Cần chạy inventory_counting_setup.sql trước khi lưu phiếu.')
      return
    }

    if (!lines.length) {
      setError('Phiếu kiểm kê cọc cần ít nhất một pool hàng.')
      return
    }

    try {
      setIsSaving(true)
      const result = await submitCreateFinishedGoodsCountSheet({
        countDate,
        note,
        rows: lines,
      })
      setMessage(`Đã tạo phiếu ${result.data?.countSheetCode || ''} với ${result.data?.lineCount || 0} dòng kiểm kê cọc.`)
      setLines([])
      setNote('')
      setSelectedItemKey('')
      setLookupLoaiCoc('')
      if (result.data?.countSheetId) {
        window.location.assign(`/ton-kho/thanh-pham/kiem-ke/${result.data.countSheetId}`)
        return
      }
      router.refresh()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không tạo được phiếu kiểm kê cọc.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {canCreateDraft ? (
      <section className="app-surface rounded-2xl p-6">
        <div className="max-w-sm space-y-2">
          <span className="text-sm font-medium">Loại kiểm kê</span>
          <select
            value={countType}
            onChange={(event) => handleCountTypeChange(event.target.value as 'VAN_HANH' | 'TON_DAU_KY')}
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            <option value="VAN_HANH">Kiểm kê vận hành</option>
            <option value="TON_DAU_KY">Nhập tồn đầu kỳ</option>
          </select>
        </div>
      </section>
      ) : null}

      {canCreateDraft && countType === 'TON_DAU_KY' ? (
        <FinishedGoodsOpeningBalancePageClient pageData={props.openingBalancePageData} embedded showRecentLots={false} />
      ) : null}

      {canCreateDraft && countType === 'VAN_HANH' ? (
      <section className="app-surface rounded-2xl p-6">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold">Tạo phiếu kiểm kê cọc thành phẩm</h2>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Ngày kiểm kê</span>
            <input
              type="date"
              value={countDate}
              onChange={(event) => setCountDate(event.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Ghi chú</span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: kiểm kê bãi thành phẩm cuối ngày"
              className="w-full rounded-xl border px-3 py-2"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </label>
        </div>

        <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[320px] flex-1 space-y-2 text-sm">
              <span className="font-medium">Chọn pool cọc cần kiểm kê</span>
              <select
                value={selectedItemKey}
                onChange={(event) => setSelectedItemKey(event.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="">Chọn loại cọc / đoạn / chiều dài...</option>
                {visibleCatalogOptions.map((option) => (
                  <option key={option.itemKey} value={option.itemKey}>
                    {option.itemLabel} · Hệ thống: {formatNumber(option.systemQty)} · Dự án: {formatNumber(option.projectQty)} · Khách lẻ:{' '}
                    {formatNumber(option.retailQty)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleOpenLookup}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Tra cứu mã cọc
            </button>
            <button
              type="button"
              onClick={addSelectedItem}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--color-border)' }}
            >
              Thêm vào phiếu
            </button>
          </div>
          {lookupLoaiCoc ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border px-3 py-1 font-semibold" style={{ borderColor: 'var(--color-border)' }}>
                Đang lọc theo mã: {lookupLoaiCoc}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLookupLoaiCoc('')
                  setSelectedItemKey('')
                }}
                className="app-outline rounded-xl px-3 py-1.5 font-semibold"
              >
                Bỏ lọc
              </button>
            </div>
          ) : null}
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Pool kiểm kê</th>
                <th className="px-4 py-3 font-semibold text-right">Tồn hệ thống</th>
                <th className="px-4 py-3 font-semibold">Ghi chú</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {lines.length ? (
                lines.map((line) => (
                  <tr key={line.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-4 font-semibold">{line.itemLabel}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(line.systemQty)}</td>
                    <td className="px-4 py-4">
                      <input
                        type="text"
                        value={line.note}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((row) => (row.id === line.id ? { ...row, note: event.target.value } : row))
                          )
                        }
                        placeholder="Ghi chú dòng kiểm kê"
                        className="w-full rounded-xl border px-3 py-2"
                        style={{ borderColor: 'var(--color-border)' }}
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setLines((current) => current.filter((row) => row.id !== line.id))}
                        className="rounded-lg border px-3 py-2 text-xs font-semibold"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm app-muted">
                    Chưa có pool nào trong phiếu kiểm kê cọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSaving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isSaving ? 'Đang tạo phiếu...' : 'Tạo phiếu kiểm kê cọc'}
          </button>
        </div>
      </section>
      ) : null}

      <section className="app-surface rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Phiếu kiểm kê gần đây</h2>
            {canCreateDraft ? (
              <p className="app-muted mt-2 text-sm">Theo dõi nhanh phiếu nháp, phiếu đang chờ thủ kho xác nhận và phiếu đang chờ Admin duyệt chênh lệch.</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {props.pageData.savedSheets.length ? (
            props.pageData.savedSheets.map((sheet) => (
              <article
                key={sheet.countSheetId}
                className="rounded-2xl border p-4"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 2%, white)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-all text-base font-semibold">{sheet.countSheetCode}</div>
                    <div className="app-muted mt-2 text-sm">{formatCountModeLabel(sheet.countMode)}</div>
                  </div>
                  <Link
                    href={`/ton-kho/thanh-pham/kiem-ke/${sheet.countSheetId}`}
                    className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    Mở phiếu
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="app-muted">Ngày kiểm kê</div>
                    <div className="mt-1 font-semibold">{formatDateLabel(sheet.countDate)}</div>
                  </div>
                  <div>
                    <div className="app-muted">Trạng thái</div>
                    <div className="mt-1 font-semibold">{formatStatusLabel(sheet.status)}</div>
                  </div>
                  <div>
                    <div className="app-muted">Số dòng</div>
                    <div className="mt-1 font-semibold">{formatNumber(sheet.lineCount)}</div>
                  </div>
                  <div>
                    <div className="app-muted">SL kiểm</div>
                    <div className="mt-1 font-semibold">{formatNumber(sheet.countedQtyTotal)}</div>
                  </div>
                  <div>
                    <div className="app-muted">Tồn hệ thống</div>
                    <div className="mt-1 font-semibold">{formatNumber(sheet.systemQtyTotal)}</div>
                  </div>
                  <div>
                    <div className="app-muted">Chênh lệch</div>
                    <div className="mt-1 font-semibold">{formatNumber(sheet.varianceQtyTotal)}</div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border px-4 py-8 text-center text-sm app-muted" style={{ borderColor: 'var(--color-border)' }}>
              Chưa có phiếu kiểm kê cọc nào.
            </div>
          )}
        </div>

        <div className="mt-5 hidden overflow-hidden rounded-2xl border md:block" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã phiếu</th>
                <th className="px-4 py-3 font-semibold">Loại</th>
                <th className="px-4 py-3 font-semibold">Ngày kiểm kê</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-right">Dòng</th>
                <th className="px-4 py-3 font-semibold text-right">Tồn hệ thống</th>
                <th className="px-4 py-3 font-semibold text-right">SL kiểm</th>
                <th className="px-4 py-3 font-semibold text-right">Chênh lệch</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {props.pageData.savedSheets.length ? (
                props.pageData.savedSheets.map((sheet) => (
                  <tr key={sheet.countSheetId} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-4 font-semibold">{sheet.countSheetCode}</td>
                    <td className="px-4 py-4">{formatCountModeLabel(sheet.countMode)}</td>
                    <td className="px-4 py-4">{formatDateLabel(sheet.countDate)}</td>
                    <td className="px-4 py-4">{formatStatusLabel(sheet.status)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(sheet.lineCount)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(sheet.systemQtyTotal)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(sheet.countedQtyTotal)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(sheet.varianceQtyTotal)}</td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/ton-kho/thanh-pham/kiem-ke/${sheet.countSheetId}`}
                        className="rounded-lg border px-3 py-2 text-xs font-semibold"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        Mở phiếu
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm app-muted">
                    Chưa có phiếu kiểm kê cọc nào.
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
