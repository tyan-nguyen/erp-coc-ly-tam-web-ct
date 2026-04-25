'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
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

function CountSheetMetric(props: { label: string; value: string | number; alignRight?: boolean }) {
  return (
    <div className={['min-w-0', props.alignRight ? 'text-right' : ''].filter(Boolean).join(' ')}>
      <div className="app-muted text-[11px] uppercase tracking-[0.18em]">{props.label}</div>
      <div className="mt-1 text-sm">{props.value}</div>
    </div>
  )
}

const stickyHeaderClass =
  'sticky top-0 z-20 border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]'
const stickyHeaderStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)',
}

function buildDraftLine(option: FinishedGoodsCountCatalogOption): FinishedGoodsCountDraftLine {
  return {
    id: `fg-count-${option.itemKey}`,
    itemKey: option.itemKey,
    itemLabel: option.itemLabel,
    templateId: option.templateId,
    maCoc: option.maCoc,
    loaiCoc: option.loaiCoc,
    tenDoan: option.tenDoan,
    chieuDaiM: option.chieuDaiM,
    systemQty: option.systemQty,
    note: '',
  }
}

function buildEmptyDraftLine(): FinishedGoodsCountDraftLine {
  return {
    id: `fg-count-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
    itemKey: '',
    itemLabel: '',
    loaiCoc: '',
    tenDoan: '',
    chieuDaiM: 0,
    systemQty: 0,
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
  const [lines, setLines] = useState<FinishedGoodsCountDraftLine[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setCountType(requestedCountType)
  }, [requestedCountType])

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

  function addEmptyLine() {
    setError('')
    setLines((current) => [...current, buildEmptyDraftLine()])
  }

  function updateLineItem(lineId: string, itemKey: string) {
    const selectedOption = props.pageData.catalogOptions.find((option) => option.itemKey === itemKey)
    if (!selectedOption) {
      setLines((current) =>
        current.map((line) =>
          line.id === lineId
            ? {
                ...buildEmptyDraftLine(),
                id: lineId,
              }
            : line
        )
      )
      return
    }

    const duplicateLine = lines.find((line) => line.id !== lineId && line.itemKey === itemKey)
    if (duplicateLine) {
      setError('Pool cọc này đã có trong phiếu kiểm kê.')
      return
    }

    setError('')
    setLines((current) => {
      return current.map((line) =>
        line.id === lineId
          ? {
              ...buildDraftLine(selectedOption),
              id: lineId,
            }
          : line
      )
    })
  }

  async function handleCreate() {
    setMessage('')
    setError('')

    if (!props.pageData.schemaReady) {
      setError('Schema kiểm kê chưa sẵn sàng. Cần chạy inventory_counting_setup.sql trước khi lưu phiếu.')
      return
    }

    const validLines = lines.filter((line) => String(line.itemKey || '').trim())
    if (!validLines.length) {
      setError('Phiếu kiểm kê cọc cần ít nhất một pool hàng.')
      return
    }

    try {
      setIsSaving(true)
      const result = await submitCreateFinishedGoodsCountSheet({
        countDate,
        note,
        rows: validLines,
      })
      setMessage(`Đã tạo phiếu ${result.data?.countSheetCode || ''} với ${result.data?.lineCount || 0} dòng kiểm kê cọc.`)
      setLines([])
      setNote('')
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
    <div className="app-surface overflow-hidden rounded-2xl">
      {canCreateDraft ? (
      <section>
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <h2 className="text-2xl font-semibold">Tạo phiếu kiểm kê cọc thành phẩm</h2>
          {countType === 'VAN_HANH' ? (
            <button
              type="button"
              onClick={addEmptyLine}
              className="text-2xl font-medium leading-none text-slate-700"
              aria-label="Thêm dòng kiểm kê"
              title="Thêm dòng kiểm kê"
            >
              +
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 px-6 pb-5 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Loại kiểm kê</span>
            <select
              value={countType}
              onChange={(event) => handleCountTypeChange(event.target.value as 'VAN_HANH' | 'TON_DAU_KY')}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <option value="VAN_HANH">Kiểm kê vận hành</option>
              <option value="TON_DAU_KY">Nhập tồn đầu kỳ</option>
            </select>
          </label>
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
      </section>
      ) : null}

      {canCreateDraft && countType === 'TON_DAU_KY' ? (
        <FinishedGoodsOpeningBalancePageClient pageData={props.openingBalancePageData} embedded showRecentLots={false} />
      ) : null}

      {canCreateDraft && countType === 'VAN_HANH' ? (
      <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>

        {message ? (
          <div className="mx-6 mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{message}</div>
        ) : null}
        {error ? (
          <div className="mx-6 mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="overflow-x-auto border-t" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03] text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Danh sách</th>
                <th className="px-4 py-3 font-semibold text-right">Tồn hệ thống</th>
                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {lines.length ? (
                lines.map((line) => (
                  <tr key={line.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-4">
                      <select
                        value={line.itemKey}
                        onChange={(event) => updateLineItem(line.id, event.target.value)}
                        className="w-full rounded-xl border px-3 py-2.5"
                        style={{ borderColor: 'var(--color-border)' }}
                        aria-label="Chọn pool kiểm kê"
                      >
                        <option value="">Chọn loại cọc / đoạn / chiều dài...</option>
                        {props.pageData.catalogOptions.map((option) => (
                          <option key={option.itemKey} value={option.itemKey}>
                            {option.itemLabel} · Hệ thống: {formatNumber(option.systemQty)} · Dự án: {formatNumber(option.projectQty)} · Khách lẻ:{' '}
                            {formatNumber(option.retailQty)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4 text-right">{formatNumber(line.systemQty)}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setLines((current) => current.filter((row) => row.id !== line.id))}
                        className="inline-flex h-7 w-7 items-center justify-center text-sm font-normal leading-none text-[var(--color-muted)] hover:text-slate-950"
                        aria-label="Xóa dòng kiểm kê"
                        title="Xóa dòng kiểm kê"
                      >
                        x
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm app-muted" style={{ borderTop: '1px solid var(--color-border)' }}>
                    Chưa có dòng nào. Bấm + để thêm dòng kiểm kê.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
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

      <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold">Phiếu kiểm kê gần đây</h2>
          </div>
        </div>

        <div className="divide-y border-y md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          {props.pageData.savedSheets.length ? (
            props.pageData.savedSheets.map((sheet) => (
              <Link
                key={sheet.countSheetId}
                href={`/ton-kho/thanh-pham/kiem-ke/${sheet.countSheetId}`}
                className="block px-5 py-5 text-left transition-colors hover:bg-[color:color-mix(in_srgb,var(--color-primary)_3%,white)]"
              >
                <div className="min-w-0">
                  <div className="break-all text-lg font-semibold leading-snug">{sheet.countSheetCode}</div>
                  <div className="app-muted mt-2 text-sm">{formatCountModeLabel(sheet.countMode)}</div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
                  <CountSheetMetric label="Ngày kiểm kê" value={formatDateLabel(sheet.countDate)} />
                  <CountSheetMetric label="Trạng thái" value={formatStatusLabel(sheet.status)} />
                  <CountSheetMetric label="Số dòng" value={formatNumber(sheet.lineCount)} />
                  <CountSheetMetric label="SL kiểm" value={formatNumber(sheet.countedQtyTotal)} />
                  <CountSheetMetric label="Tồn hệ thống" value={formatNumber(sheet.systemQtyTotal)} />
                  <CountSheetMetric label="Chênh lệch" value={formatNumber(sheet.varianceQtyTotal)} />
                </div>
              </Link>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-sm app-muted">
              Chưa có phiếu kiểm kê cọc nào.
            </div>
          )}
        </div>

        <div className="hidden max-h-[56vh] overflow-auto border-t md:block" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="text-left">
              <tr>
                <th className={stickyHeaderClass} style={stickyHeaderStyle}>Mã phiếu</th>
                <th className={stickyHeaderClass} style={stickyHeaderStyle}>Loại</th>
                <th className={stickyHeaderClass} style={stickyHeaderStyle}>Ngày kiểm kê</th>
                <th className={stickyHeaderClass} style={stickyHeaderStyle}>Trạng thái</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>Dòng</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>Tồn hệ thống</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>SL kiểm</th>
                <th className={`${stickyHeaderClass} text-right`} style={stickyHeaderStyle}>Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {props.pageData.savedSheets.length ? (
                props.pageData.savedSheets.map((sheet) => (
                  <tr
                    key={sheet.countSheetId}
                    className="cursor-pointer transition-colors hover:bg-[color:color-mix(in_srgb,var(--color-primary)_3%,white)]"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                    onClick={() => router.push(`/ton-kho/thanh-pham/kiem-ke/${sheet.countSheetId}`)}
                    tabIndex={0}
                    role="link"
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      router.push(`/ton-kho/thanh-pham/kiem-ke/${sheet.countSheetId}`)
                    }}
                  >
                    <td className="px-4 py-4 font-semibold">{sheet.countSheetCode}</td>
                    <td className="px-4 py-4">{formatCountModeLabel(sheet.countMode)}</td>
                    <td className="px-4 py-4">{formatDateLabel(sheet.countDate)}</td>
                    <td className="px-4 py-4">{formatStatusLabel(sheet.status)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(sheet.lineCount)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(sheet.systemQtyTotal)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(sheet.countedQtyTotal)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(sheet.varianceQtyTotal)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm app-muted">
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
