'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { NvlReceiptDetail } from '@/lib/nvl-procurement/types'
import { submitSaveReceiptDraft } from '@/lib/nvl-procurement/client-api'

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

export function NvlReceiptDetailClient(props: { detail: NvlReceiptDetail }) {
  const [note, setNote] = useState(props.detail.note || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [lineState, setLineState] = useState<Record<string, {
    receivedQty: string
    acceptedQty: string
    defectiveQty: string
    rejectedQty: string
  }>>(() =>
    Object.fromEntries(
      props.detail.lines.map((line) => [
        line.receiptLineId,
        {
          receivedQty: String(line.receivedQty || 0),
          acceptedQty: String(line.acceptedQty || 0),
          defectiveQty: String(line.defectiveQty || 0),
          rejectedQty: String(line.rejectedQty || 0),
        },
      ])
    )
  )

  const totals = useMemo(() => {
    return props.detail.lines.reduce(
      (acc, line) => {
        const current = lineState[line.receiptLineId] || {
          receivedQty: '0',
          acceptedQty: '0',
          defectiveQty: '0',
          rejectedQty: '0',
        }
        acc.receivedQty += Number(current.receivedQty || 0)
        acc.acceptedQty += Number(current.acceptedQty || 0)
        acc.defectiveQty += Number(current.defectiveQty || 0)
        acc.rejectedQty += Number(current.rejectedQty || 0)
        return acc
      },
      { receivedQty: 0, acceptedQty: 0, defectiveQty: 0, rejectedQty: 0 }
    )
  }, [lineState, props.detail.lines])

  async function handleSave() {
    setMessage('')
    setError('')
    setPending(true)
    try {
      const result = await submitSaveReceiptDraft({
        receiptId: props.detail.receiptId,
        note,
        lines: props.detail.lines.map((line) => {
          const current = lineState[line.receiptLineId] || {
            receivedQty: '0',
            acceptedQty: '0',
            defectiveQty: '0',
            rejectedQty: '0',
          }
          return {
            receiptLineId: line.receiptLineId,
            receivedQty: Number(current.receivedQty || 0),
            acceptedQty: Number(current.acceptedQty || 0),
            defectiveQty: Number(current.defectiveQty || 0),
            rejectedQty: Number(current.rejectedQty || 0),
          }
        }),
      })
      setMessage(`Đã lưu receipt ${result.data?.receiptCode || props.detail.receiptCode}.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được receipt NVL.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="app-muted text-xs uppercase tracking-[0.18em]">Receipt / Batch</div>
            <h2 className="mt-3 text-2xl font-semibold">{props.detail.receiptCode}</h2>
            <p className="app-muted mt-2 text-sm">
              Nhập số nhận thực tế cho từng dòng của receipt. Chỉ sau khi nhập số thật rồi quay về màn mua hàng bấm `Ghi nhập kho`
              thì movement tồn kho NVL mới được sinh.
            </p>
          </div>
          <Link
            href="/ton-kho/nvl/mua-hang"
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Về mua hàng NVL
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">PO</div>
            <div className="mt-2 text-base font-semibold">{props.detail.poCode || '-'}</div>
          </article>
          <article className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">NCC</div>
            <div className="mt-2 text-base font-semibold">{props.detail.vendorName || '-'}</div>
          </article>
          <article className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">Đợt</div>
            <div className="mt-2 text-base font-semibold">{props.detail.batchNo}</div>
          </article>
          <article className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">Trạng thái</div>
            <div className="mt-2 text-base font-semibold">{props.detail.status}</div>
          </article>
        </div>

        <div className="mt-5">
          <label className="text-sm font-semibold">Ghi chú receipt</label>
          <textarea
            className="mt-2 min-h-24 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            style={{ borderColor: 'var(--color-border)' }}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-primary)' }}
            disabled={pending}
            onClick={handleSave}
          >
            {pending ? 'Đang lưu...' : 'Lưu receipt'}
          </button>
          <div className="app-muted self-center text-sm">
            Sau khi lưu số thực tế, quay lại màn `Mua hàng NVL` để bấm `Ghi nhập kho`.
          </div>
        </div>

        {message ? (
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, #16a34a 10%, white)',
              color: '#166534',
            }}
          >
            {message}
          </div>
        ) : null}
        {error ? (
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, #dc2626 10%, white)',
              color: '#991b1b',
            }}
          >
            {error}
          </div>
        ) : null}
      </section>

      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Dòng nhận hàng</h3>
            <p className="app-muted mt-2 text-sm">
              Với từng dòng, nhập `SL nhận` trước. Sau đó phân tách thành `Đạt`, `Lỗi`, `Từ chối`.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <article className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Nhận</div>
              <div className="mt-2 text-lg font-semibold">{formatNumber(totals.receivedQty)}</div>
            </article>
            <article className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Đạt</div>
              <div className="mt-2 text-lg font-semibold">{formatNumber(totals.acceptedQty)}</div>
            </article>
            <article className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Lỗi</div>
              <div className="mt-2 text-lg font-semibold">{formatNumber(totals.defectiveQty)}</div>
            </article>
            <article className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Từ chối</div>
              <div className="mt-2 text-lg font-semibold">{formatNumber(totals.rejectedQty)}</div>
            </article>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
              <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                <th className="px-4 py-3">Dòng</th>
                <th className="px-4 py-3">NVL</th>
                <th className="px-4 py-3 text-right">SL đặt</th>
                <th className="px-4 py-3 text-right">SL nhận</th>
                <th className="px-4 py-3 text-right">SL đạt</th>
                <th className="px-4 py-3 text-right">SL lỗi</th>
                <th className="px-4 py-3 text-right">SL từ chối</th>
              </tr>
            </thead>
            <tbody>
              {props.detail.lines.map((line) => {
                const current = lineState[line.receiptLineId] || {
                  receivedQty: '0',
                  acceptedQty: '0',
                  defectiveQty: '0',
                  rejectedQty: '0',
                }
                return (
                  <tr key={line.receiptLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-4 font-semibold">{line.lineNo}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold">{line.materialName}</div>
                      <div className="app-muted mt-1 text-xs">
                        {line.materialCode}
                        {line.unit ? ` · ${line.unit}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">{formatNumber(line.orderedQty)}</td>
                    <td className="px-4 py-4 text-right">
                      <input
                        className="w-24 rounded-lg border px-3 py-2 text-right"
                        style={{ borderColor: 'var(--color-border)' }}
                        value={current.receivedQty}
                        onChange={(event) =>
                          setLineState((prev) => ({
                            ...prev,
                            [line.receiptLineId]: { ...current, receivedQty: event.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <input
                        className="w-24 rounded-lg border px-3 py-2 text-right"
                        style={{ borderColor: 'var(--color-border)' }}
                        value={current.acceptedQty}
                        onChange={(event) =>
                          setLineState((prev) => ({
                            ...prev,
                            [line.receiptLineId]: { ...current, acceptedQty: event.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <input
                        className="w-24 rounded-lg border px-3 py-2 text-right"
                        style={{ borderColor: 'var(--color-border)' }}
                        value={current.defectiveQty}
                        onChange={(event) =>
                          setLineState((prev) => ({
                            ...prev,
                            [line.receiptLineId]: { ...current, defectiveQty: event.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <input
                        className="w-24 rounded-lg border px-3 py-2 text-right"
                        style={{ borderColor: 'var(--color-border)' }}
                        value={current.rejectedQty}
                        onChange={(event) =>
                          setLineState((prev) => ({
                            ...prev,
                            [line.receiptLineId]: { ...current, rejectedQty: event.target.value },
                          }))
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
