'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitReceiveExternalPileOrder } from '@/lib/external-pile-procurement/client-api'
import type { ExternalPileOrderDetail } from '@/lib/external-pile-procurement/types'
import { isAdminRole, isWarehouseRole } from '@/lib/auth/roles'

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function getTodayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatOrderStatus(status: string) {
  switch (status) {
    case 'DA_GUI_NCC':
      return 'Đã lập phiếu mua'
    case 'DA_NHAN_MOT_PHAN':
      return 'Đã nhập một phần'
    case 'DA_NHAN_DU':
      return 'Đã nhập đủ'
    case 'HUY':
      return 'Hủy'
    default:
      return 'Nháp'
  }
}

export function ExternalPileProcurementOrderDetailClient(props: {
  detail: ExternalPileOrderDetail
  viewerRole: string
  fastBackToList?: boolean
  inline?: boolean
  onReceived?: (detail: ExternalPileOrderDetail) => void
}) {
  const router = useRouter()
  const canReceive = isWarehouseRole(props.viewerRole) || isAdminRole(props.viewerRole)
  const [note, setNote] = useState('')
  const [receiveQtyByLine, setReceiveQtyByLine] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.detail.order.lines.map((line) => [line.poLineId, line.remainingQty > 0 ? String(line.remainingQty) : '0']))
  )
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const totalRemainingQty = useMemo(
    () => props.detail.order.lines.reduce((sum, line) => sum + line.remainingQty, 0),
    [props.detail.order.lines]
  )
  useEffect(() => {
    setReceiveQtyByLine(
      Object.fromEntries(
        props.detail.order.lines.map((line) => [line.poLineId, line.remainingQty > 0 ? String(line.remainingQty) : '0'])
      )
    )
  }, [props.detail.order.lines])

  function goBack() {
    if (props.fastBackToList && typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.replace('/san-xuat/mua-coc-ngoai')
  }

  async function receiveOrder() {
    setMessage('')
    setError('')
    setPending(true)
    try {
      const result = await submitReceiveExternalPileOrder({
        poId: props.detail.order.poId,
        receiveDate: getTodayInputValue(),
        note,
        items: props.detail.order.lines.map((line) => ({
          poLineId: line.poLineId,
          receiveQty: Number(receiveQtyByLine[line.poLineId] || 0),
        })),
      })
      setMessage(
        `Đã nhập kho cho ${result.data?.poCode || props.detail.order.poCode}. Sinh ${result.data?.createdSerialCount || 0} serial mới.`
      )
      const refreshedDetail: ExternalPileOrderDetail = {
        ...props.detail,
        order: {
          ...props.detail.order,
          totalReceivedQty: props.detail.order.lines.reduce(
            (sum, line) => sum + line.receivedQty + Number(receiveQtyByLine[line.poLineId] || 0),
            0
          ),
          status: (result.data?.status as typeof props.detail.order.status) || props.detail.order.status,
          lines: props.detail.order.lines.map((line) => {
            const addedQty = Number(receiveQtyByLine[line.poLineId] || 0)
            const receivedQty = line.receivedQty + addedQty
            return {
              ...line,
              receivedQty,
              remainingQty: Math.max(line.orderedQty - receivedQty, 0),
            }
          }),
        },
        receivedBatches: [
          {
            receivedAt: new Date().toISOString(),
            receivedDate: getTodayInputValue(),
            note,
            totalReceivedQty: props.detail.order.lines.reduce(
              (sum, line) => sum + Number(receiveQtyByLine[line.poLineId] || 0),
              0
            ),
            items: props.detail.order.lines
              .map((line) => ({
                poLineId: line.poLineId,
                itemLabel: line.itemLabel,
                receiveQty: Number(receiveQtyByLine[line.poLineId] || 0),
                lotId: '',
                lotCode: '',
              }))
              .filter((item) => item.receiveQty > 0),
          },
          ...props.detail.receivedBatches,
        ],
      }
      props.onReceived?.(refreshedDetail)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không nhập kho được phiếu mua cọc ngoài.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={props.inline ? '' : 'space-y-6'}>
      {message ? (
        <section
          className={props.inline ? 'border-b px-6 py-3 text-sm' : 'rounded-2xl border px-4 py-3 text-sm'}
          style={{
            borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)',
            backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
            color: 'var(--color-primary)',
          }}
        >
          {message}
        </section>
      ) : null}
      {error ? <section className={props.inline ? 'border-b px-6 py-3 text-sm app-accent-soft' : 'app-accent-soft rounded-2xl px-4 py-3 text-sm'}>{error}</section> : null}

      {!props.inline ? (
        <section className="app-surface rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="app-outline inline-flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none"
              aria-label="Quay lại danh sách mua cọc ngoài"
              title="Quay lại danh sách mua cọc ngoài"
            >
              ←
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">Chi tiết phiếu mua cọc ngoài</h1>
              <p className="app-muted mt-1 text-sm">
                {props.detail.order.poCode} · {props.detail.order.vendorName || 'Chưa chọn NCC'} · {formatOrderStatus(props.detail.order.status)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className={props.inline ? 'border-t px-6 py-4' : 'app-surface rounded-2xl p-6'} style={props.inline ? { borderColor: 'var(--color-border)' } : undefined}>
        {!props.inline ? (
          <div className="mb-4">
            <div className="text-lg font-semibold">Chi tiết phiếu mua</div>
            <div className="app-muted mt-1 text-sm">
              {props.detail.order.poCode} · {props.detail.order.vendorName || 'Chưa chọn NCC'} · {formatOrderStatus(props.detail.order.status)}
            </div>
          </div>
        ) : null}

        {!props.inline ? (
          <div className="grid gap-4 border-t pt-4 md:grid-cols-4" style={{ borderColor: 'var(--color-border)' }}>
            <Info inline={props.inline} label="Phiếu mua" value={props.detail.order.poCode} />
            <Info inline={props.inline} label="Đề xuất" value={props.detail.order.requestCode || '-'} />
            <Info inline={props.inline} label="Đặt" value={formatNumber(props.detail.order.totalOrderedQty)} />
            <Info inline={props.inline} label="Còn lại" value={formatNumber(totalRemainingQty)} />
          </div>
        ) : null}

        {props.detail.receivedBatches.length ? (
          <section className={props.inline ? 'border-b pb-4' : 'mt-5 border-t pt-5'} style={{ borderColor: 'var(--color-border)' }}>
            <div className="text-sm font-semibold">Lịch sử nhận hàng từng đợt</div>
            <div className="mt-3 space-y-2">
              {props.detail.receivedBatches.map((batch, index) => (
                <div
                  key={`${batch.receivedAt}-${index}`}
                  className={index === 0 ? 'px-1 py-3' : 'border-t px-1 py-3'}
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="grid gap-2 md:grid-cols-[100px_210px_minmax(0,1fr)_auto] md:items-center">
                    <div className="font-semibold">Đợt {index + 1}</div>
                    <div className="app-muted text-xs md:text-sm">
                      {formatDateTime(batch.receivedAt || batch.receivedDate)} · {formatNumber(batch.totalReceivedQty)} cây
                    </div>
                    <div className="min-w-0 flex flex-wrap gap-2">
                      {batch.items.map((item) => (
                        <div
                          key={`${batch.receivedAt}-${item.poLineId}-${item.lotId}`}
                          className="rounded-full border px-3 py-1 text-xs"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          {item.itemLabel} · {formatNumber(item.receiveQty)}
                        </div>
                      ))}
                    </div>
                    {Array.from(new Set(batch.items.map((item) => item.lotId).filter(Boolean))).length ? (
                      <Link
                        href={`/ton-kho/thanh-pham/kiem-ke/in-tem?lot_ids=${Array.from(new Set(batch.items.map((item) => item.lotId).filter(Boolean))).join(',')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border px-3 py-2 text-xs font-semibold"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        Mở tem
                      </Link>
                    ) : null}
                  </div>
                  {batch.note ? <div className="app-muted mt-2 text-xs">{batch.note}</div> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className={props.inline ? 'pt-4' : 'mt-5 border-t pt-5'} style={props.inline ? undefined : { borderColor: 'var(--color-border)' }}>
          <div className="mb-3">
            <div className="text-sm font-semibold">{canReceive ? 'Nhập kho' : 'Chi tiết số lượng'}</div>
            {!props.inline && canReceive ? (
              <div className="app-muted mt-1 text-xs">Thủ kho nhập số lượng nhận trong đợt này rồi xác nhận để cộng tồn và sinh tem.</div>
            ) : null}
          </div>
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Hàng</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Đặt</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Đã nhập</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Còn lại</th>
                {canReceive ? <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Nhập đợt này</th> : null}
              </tr>
            </thead>
            <tbody>
              {props.detail.order.lines.map((line) => (
                <tr key={line.poLineId} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{line.itemLabel}</div>
                    {line.ghiChu ? <div className="app-muted mt-1 text-xs">{line.ghiChu}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right">{formatNumber(line.orderedQty)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(line.receivedQty)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(line.remainingQty)}</td>
                  {canReceive ? (
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        max={line.remainingQty}
                        step="1"
                        value={receiveQtyByLine[line.poLineId] ?? '0'}
                        onChange={(event) =>
                          setReceiveQtyByLine((current) => ({
                            ...current,
                            [line.poLineId]: event.target.value,
                          }))
                        }
                        className="app-input w-28 rounded-xl px-3 py-2 text-sm text-right"
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canReceive ? (
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
            <Field label="Ghi chú nhập kho">
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ghi chú lô nhập, chứng từ NCC, chất lượng nhận..."
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => void receiveOrder()}
                disabled={pending || totalRemainingQty <= 0}
                className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {pending ? 'Đang nhập...' : 'Xác nhận nhập kho'}
              </button>
            </div>
          </div>
        ) : null}
        </div>
      </section>
    </div>
  )
}

function formatDateTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function Info(props: { label: string; value: string; inline?: boolean }) {
  return (
    <div
      className={props.inline ? 'border px-4 py-3' : 'rounded-2xl border px-4 py-3'}
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="app-muted text-xs uppercase tracking-[0.18em]">{props.label}</div>
      <div className="mt-2 text-lg font-semibold">{props.value}</div>
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{props.label}</span>
      {props.children}
    </label>
  )
}
