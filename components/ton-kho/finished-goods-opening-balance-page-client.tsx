'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { submitCreateFinishedGoodsCountSheet } from '@/lib/finished-goods-counting/client-api'
import type {
  FinishedGoodsOpeningBalancePageData,
  FinishedGoodsOpeningBalanceQuality,
} from '@/lib/ton-kho-thanh-pham/opening-balance-types'

const QUALITY_OPTIONS: Array<{ value: FinishedGoodsOpeningBalanceQuality; label: string; hint: string }> = [
  { value: 'DAT', label: 'Đạt', hint: 'Có thể dùng ngay cho tồn thành phẩm và xuất hàng.' },
  { value: 'LOI', label: 'Lỗi / Khách lẻ', hint: 'Không vào dự án. Chỉ tính cho nhánh khách lẻ / bán tồn.' },
]

const SEGMENT_OPTIONS = [
  { value: 'MUI', label: 'Mũi' },
  { value: 'THAN', label: 'Thân' },
] as const

const OPENING_BALANCE_LOOKUP_DRAFT_KEY = 'fg-opening-balance-lookup-draft'

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function formatCountSheetStatus(value: string) {
  switch (String(value || '').toUpperCase()) {
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
      return value || '-'
  }
}

export function FinishedGoodsOpeningBalancePageClient(props: {
  pageData: FinishedGoodsOpeningBalancePageData
  embedded?: boolean
  showRecentLots?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const today = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const [openingDate, setOpeningDate] = useState(today)
  const [templateId, setTemplateId] = useState('')
  const [maCoc, setMaCoc] = useState('')
  const [loaiCoc, setLoaiCoc] = useState('')
  const [tenDoan, setTenDoan] = useState('')
  const [chieuDaiM, setChieuDaiM] = useState('')
  const [quantity, setQuantity] = useState('')
  const [qualityStatus, setQualityStatus] = useState<FinishedGoodsOpeningBalanceQuality>('DAT')
  const [locationId, setLocationId] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const showRecentLots = props.showRecentLots ?? true

  useEffect(() => {
    const draft = window.sessionStorage.getItem(OPENING_BALANCE_LOOKUP_DRAFT_KEY)
    if (!draft) return
    try {
      const parsed = JSON.parse(draft) as {
        openingDate?: string
        templateId?: string
        maCoc?: string
        loaiCoc?: string
        tenDoan?: string
        chieuDaiM?: string
        quantity?: string
        qualityStatus?: FinishedGoodsOpeningBalanceQuality
        locationId?: string
        note?: string
      }
      setOpeningDate(parsed.openingDate || today)
      setTemplateId(parsed.templateId || '')
      setMaCoc(parsed.maCoc || '')
      setLoaiCoc(parsed.loaiCoc || '')
      setTenDoan(parsed.tenDoan || '')
      setChieuDaiM(parsed.chieuDaiM || '')
      setQuantity(parsed.quantity || '')
      setQualityStatus(parsed.qualityStatus || 'DAT')
      setLocationId(parsed.locationId || '')
      setNote(parsed.note || '')
    } catch {
      // ignore malformed draft
    }
    window.sessionStorage.removeItem(OPENING_BALANCE_LOOKUP_DRAFT_KEY)
  }, [today])

  useEffect(() => {
    const selectedLoaiCoc = searchParams.get('selected_loai_coc')
    if (!selectedLoaiCoc) return
    const selectedOption = props.pageData.loaiCocOptions.find(
      (option) => option.templateId === selectedLoaiCoc || option.maCoc === selectedLoaiCoc || option.loaiCoc === selectedLoaiCoc
    )
    setTemplateId(selectedOption?.templateId || '')
    setMaCoc(selectedOption?.maCoc || '')
    setLoaiCoc(selectedOption?.loaiCoc || selectedLoaiCoc)
    const nextParams = new URLSearchParams(searchParamsString)
    nextParams.delete('selected_loai_coc')
    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, props.pageData.loaiCocOptions, router, searchParams, searchParamsString])

  function handleOpenLookup() {
    const returnTo = searchParamsString ? `${pathname}?${searchParamsString}` : pathname
    window.sessionStorage.setItem(
      OPENING_BALANCE_LOOKUP_DRAFT_KEY,
      JSON.stringify({
        openingDate,
        templateId,
        maCoc,
        loaiCoc,
        tenDoan,
        chieuDaiM,
        quantity,
        qualityStatus,
        locationId,
        note,
      })
    )
    router.push(`/ton-kho/thanh-pham/tra-cuu-coc?return_to=${encodeURIComponent(returnTo)}`)
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
          Chưa thấy schema `pile_serial`. Cần chạy file `sql/pile_serial_setup.sql` rồi mới mở tồn đầu kỳ cọc thành phẩm.
        </div>
      </section>
    )
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (!openingDate) {
      setMessage('Cần chọn ngày mở tồn.')
      return
    }

    if (!loaiCoc.trim()) {
      setMessage('Cần chọn mã cọc.')
      return
    }

    if (!tenDoan.trim()) {
      setMessage('Cần chọn đoạn Mũi hoặc Thân.')
      return
    }

    if (Number(chieuDaiM || 0) <= 0) {
      setMessage('Cần nhập chiều dài lớn hơn 0.')
      return
    }

    if (Number(quantity || 0) <= 0) {
      setMessage('Cần nhập số lượng lớn hơn 0.')
      return
    }

    setSubmitting(true)

    try {
      const result = await submitCreateFinishedGoodsCountSheet({
        countType: 'TON_DAU_KY',
        countDate: openingDate,
        note,
        rows: [
          {
            id: `opening-${loaiCoc}-${tenDoan}-${chieuDaiM}`,
            itemKey: `${templateId || maCoc || loaiCoc}::${tenDoan}::${Number(chieuDaiM || 0)}`,
            itemLabel: `${maCoc || loaiCoc} | ${tenDoan} | ${Number(chieuDaiM || 0)}m`,
            templateId,
            maCoc,
            loaiCoc,
            tenDoan,
            chieuDaiM: Number(chieuDaiM || 0),
            systemQty: 0,
            note,
            openingQty: Number(quantity || 0),
            qualityStatus,
            locationId: locationId || '',
          },
        ],
      })

      setMessage(`Đã tạo phiếu ${result.data?.countSheetCode || ''} chờ Thủ kho xác nhận.`)
      setTemplateId('')
      setMaCoc('')
      setLoaiCoc('')
      setTenDoan('')
      setChieuDaiM('')
      setQuantity('')
      setNote('')
      if (result.data?.countSheetId) {
        window.location.assign(`/ton-kho/thanh-pham/kiem-ke/${result.data.countSheetId}`)
        return
      }
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không tạo được phiếu nhập tồn đầu kỳ.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeQuality = QUALITY_OPTIONS.find((item) => item.value === qualityStatus) || QUALITY_OPTIONS[0]

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        {props.embedded ? null : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-xl font-semibold">Mở tồn đầu kỳ cọc thành phẩm</h2>
              <p className="app-muted mt-2 text-sm">
                Dùng cho hàng tồn cũ trước ngày go-live. Hệ thống sẽ tạo một lô legacy, sinh serial mới để in tem và gán bãi
                ngay từ đầu, nhưng không làm bẩn dữ liệu KHSX hay NVL sản xuất.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Chất lượng đang chọn</div>
              <div className="mt-2 text-base font-semibold">{activeQuality.label}</div>
              <div className="app-muted mt-1 text-xs">{activeQuality.hint}</div>
            </div>
          </div>
        )}

        {props.embedded ? (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-xl font-semibold">Nhập tồn đầu kỳ</h2>
              <p className="app-muted mt-2 text-sm">
                Dùng cho cọc cũ chưa có serial trước khi go-live. Hệ thống sẽ tạo lô legacy và sinh serial để in tem ngay.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Chất lượng đang chọn</div>
              <div className="mt-2 text-base font-semibold">{activeQuality.label}</div>
              <div className="app-muted mt-1 text-xs">{activeQuality.hint}</div>
            </div>
          </div>
        ) : null}

        <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
          <label className="space-y-2">
            <span className="text-sm font-medium">Ngày mở tồn</span>
            <input
              type="date"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              value={openingDate}
              onChange={(event) => setOpeningDate(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Trạng thái chất lượng</span>
            <select
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              value={qualityStatus}
              onChange={(event) => setQualityStatus(event.target.value as FinishedGoodsOpeningBalanceQuality)}
            >
              {QUALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Mã cọc</span>
            <div className="space-y-2">
              <select
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                value={templateId || maCoc || loaiCoc}
                onChange={(event) => {
                  const option = props.pageData.loaiCocOptions.find((item) => item.value === event.target.value)
                  setTemplateId(option?.templateId || '')
                  setMaCoc(option?.maCoc || '')
                  setLoaiCoc(option?.loaiCoc || '')
                }}
              >
                <option value="">Chọn mã cọc</option>
                {props.pageData.loaiCocOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleOpenLookup}
                className="app-outline rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Tra cứu mã cọc
              </button>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Đoạn</span>
            <select
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              value={tenDoan}
              onChange={(event) => setTenDoan(event.target.value)}
            >
              <option value="">Chọn đoạn</option>
              {SEGMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Chiều dài (m)</span>
            <input
              type="number"
              step="0.001"
              min="0"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              placeholder="VD: 4"
              value={chieuDaiM}
              onChange={(event) => setChieuDaiM(event.target.value)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Số lượng</span>
            <input
              type="number"
              min="1"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              placeholder="VD: 50"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium">Bãi / vị trí kho</span>
            <select
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">Để trống để hệ thống tự chọn bãi mặc định theo chất lượng</option>
              {props.pageData.locations.map((option) => (
                <option key={option.locationId} value={option.locationId}>
                  {option.locationLabel}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-sm font-medium">Ghi chú</span>
            <textarea
              className="min-h-[96px] w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              placeholder="VD: Tồn cũ trước go-live, đã kiểm đếm ngoài bãi A."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Đang tạo lô...' : 'Tạo serial tồn đầu kỳ'}
            </button>
            {props.embedded ? null : (
              <Link href="/ton-kho/thanh-pham" className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
                Xem tồn cọc thành phẩm
              </Link>
            )}
            {message ? <div className="text-sm font-medium">{message}</div> : null}
          </div>
        </form>
      </section>

      {showRecentLots ? (
        <section className="app-surface rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Các lô tồn đầu kỳ đã tạo</h3>
              <p className="app-muted mt-2 text-sm">
                Mỗi dòng là một lô legacy đã sinh serial. Có thể mở tem để in/dán lên cọc và dùng ngay cho các bước gán bãi,
                xuất hàng hoặc đối soát tồn.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Số lô gần đây</div>
              <div className="mt-2 text-2xl font-semibold">{props.pageData.recentLots.length}</div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                  <th className="px-4 py-3">Lô</th>
                  <th className="px-4 py-3">Mặt hàng</th>
                  <th className="px-4 py-3 text-right">SL</th>
                  <th className="px-4 py-3">Chất lượng</th>
                  <th className="px-4 py-3">Bãi</th>
                  <th className="px-4 py-3">Ngày mở tồn</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {props.pageData.recentLots.length ? (
                  props.pageData.recentLots.map((row) => (
                    <tr key={row.lotId} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-4">
                        <div className="font-semibold">{row.lotCode}</div>
                        <div className="app-muted mt-1 text-xs">{row.serialCount} serial</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold">{row.loaiCoc}</div>
                        <div className="app-muted mt-1 text-xs">
                          {row.tenDoan} · {formatNumber(row.chieuDaiM)}m
                        </div>
                        {row.countSheetCode ? (
                          <div className="app-muted mt-1 text-xs">
                            Phiếu: {row.countSheetCode} · {formatCountSheetStatus(row.countSheetStatus)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">{row.quantity}</td>
                      <td className="px-4 py-4">{row.qualityStatus === 'LOI' ? 'Lỗi / Khách lẻ' : 'Đạt'}</td>
                      <td className="px-4 py-4">{row.locationLabel}</td>
                      <td className="px-4 py-4">{formatDate(row.openingDate)}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {row.countSheetId ? (
                            <Link
                              href={`/ton-kho/thanh-pham/kiem-ke/${row.countSheetId}`}
                              className="app-outline rounded-xl px-3 py-2 text-sm font-medium"
                            >
                              Mở phiếu
                            </Link>
                          ) : null}
                          <Link
                            href={`/ton-kho/thanh-pham/kiem-ke/in-tem?lot_ids=${encodeURIComponent(row.lotId)}`}
                            className="app-outline rounded-xl px-3 py-2 text-sm font-medium"
                          >
                            In tem
                          </Link>
                          <Link
                            href="/ton-kho/thanh-pham/vi-tri-bai/gan-bai"
                            className="app-outline rounded-xl px-3 py-2 text-sm font-medium"
                          >
                            Gán bãi
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center app-muted" colSpan={7}>
                      Chưa có lô tồn đầu kỳ thành phẩm nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
