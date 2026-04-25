'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { normalizeRole } from '@/lib/auth/roles'
import type { InventoryCountDetail } from '@/lib/inventory-counting/types'
import {
  submitApproveInventoryCount,
  submitConfirmInventoryCount,
  submitSaveInventoryCountDraft,
} from '@/lib/inventory-counting/client-api'

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

function classifyLine(input: {
  itemType: string
  varianceQty: number
  variancePct: number
  allowedLossPct: number
}) {
  if (input.varianceQty === 0) return 'KHONG_AP_DUNG'
  if (input.varianceQty > 0) return 'TON_TANG'
  if (input.itemType === 'FINISHED_GOOD' || input.itemType === 'TOOL' || input.itemType === 'ASSET') {
    return 'CHI_PHI_THAT_THOAT'
  }
  return Math.abs(input.variancePct) <= input.allowedLossPct ? 'CHI_PHI_QUAN_LY' : 'CHI_PHI_THAT_THOAT'
}

function formatClassificationLabel(value: string | null) {
  if (value === 'CHI_PHI_QUAN_LY') return 'Chi phí quản lý'
  if (value === 'CHI_PHI_THAT_THOAT') return 'Chi phí thất thoát'
  if (value === 'TON_TANG') return 'Tồn tăng'
  return 'Không áp dụng'
}

function formatStatusLabel(value: string) {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'NHAP') return 'Nháp'
  if (normalized === 'CHO_XAC_NHAN_KHO') return 'Chờ thủ kho xác nhận'
  if (normalized === 'CHO_DUYET_CHENH_LECH') return 'Chờ duyệt chênh lệch'
  if (normalized === 'DA_DIEU_CHINH_TON') return 'Đã điều chỉnh tồn'
  return value || '-'
}

export function InventoryCountDetailClient(props: { detail: InventoryCountDetail; currentRole: string }) {
  const router = useRouter()
  const normalizedRole = normalizeRole(props.currentRole)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingSave, setPendingSave] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [pendingApprove, setPendingApprove] = useState(false)
  const [lineState, setLineState] = useState<Record<string, { countedQty: string; note: string }>>(() =>
    Object.fromEntries(
      props.detail.lines.map((line) => [
        line.countLineId,
        {
          countedQty: String(line.countedQty || 0),
          note: String(line.note || ''),
        },
      ])
    )
  )

  const totals = useMemo(() => {
    return props.detail.lines.reduce(
      (acc, line) => {
        const current = lineState[line.countLineId] || { countedQty: '0', note: '' }
        const countedQty = Number(current.countedQty || 0)
        const varianceQty = countedQty - Number(line.systemQty || 0)
        acc.systemQty += Number(line.systemQty || 0)
        acc.countedQty += countedQty
        acc.varianceQty += varianceQty
        return acc
      },
      { systemQty: 0, countedQty: 0, varianceQty: 0 }
    )
  }, [lineState, props.detail.lines])

  const isWarehouseLike = normalizedRole === 'warehouse' || normalizedRole === 'thu kho' || normalizedRole === 'thukho' || normalizedRole === 'admin'
  const isInventoryCounterLike =
    normalizedRole === 'kiem ke vien' ||
    normalizedRole === 'kiemke vien' ||
    normalizedRole === 'kiem ke' ||
    normalizedRole === 'inventory counter'
  const isPurchaseLike =
    normalizedRole === 'purchase' ||
    normalizedRole === 'ktmh' ||
    normalizedRole === 'ke toan mua hang' ||
    normalizedRole === 'ketoan mua hang' ||
    normalizedRole === 'mua hang' ||
    normalizedRole === 'purchasing' ||
    normalizedRole === 'admin'
  const canEditDraft =
    (isInventoryCounterLike || normalizedRole === 'admin') &&
    (props.detail.status === 'NHAP' || props.detail.status === 'CHO_XAC_NHAN_KHO')
  const canConfirmWarehouse = isWarehouseLike && (props.detail.status === 'NHAP' || props.detail.status === 'CHO_XAC_NHAN_KHO')
  const canApproveFinal = isPurchaseLike && props.detail.status === 'CHO_DUYET_CHENH_LECH'

  async function handleSave() {
    setMessage('')
    setError('')
    setPendingSave(true)
    try {
      const result = await submitSaveInventoryCountDraft({
        countSheetId: props.detail.countSheetId,
        note: props.detail.note || '',
        lines: props.detail.lines.map((line) => {
          const current = lineState[line.countLineId] || { countedQty: '0', note: '' }
          return {
            countLineId: line.countLineId,
            countedQty: Number(current.countedQty || 0),
            note: current.note,
          }
        }),
      })
      setMessage(`Đã lưu phiếu kiểm kê ${result.data?.countSheetCode || props.detail.countSheetCode}.`) 
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được phiếu kiểm kê.')
    } finally {
      setPendingSave(false)
    }
  }

  async function handleConfirm() {
    setMessage('')
    setError('')
    setPendingConfirm(true)
    try {
      const result = await submitConfirmInventoryCount({ countSheetId: props.detail.countSheetId })
      setMessage(`Thủ kho đã xác nhận phiếu ${result.data?.countSheetCode || props.detail.countSheetCode}. Phiếu đang chờ duyệt chênh lệch.`)
      router.refresh()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Không xác nhận kho được phiếu kiểm kê.')
    } finally {
      setPendingConfirm(false)
    }
  }

  async function handleApprove() {
    setMessage('')
    setError('')
    setPendingApprove(true)
    try {
      const result = await submitApproveInventoryCount({ countSheetId: props.detail.countSheetId })
      setMessage(
        `KTMH/Admin đã duyệt chênh lệch phiếu ${result.data?.countSheetCode || props.detail.countSheetCode} và đã ghi điều chỉnh tồn kho.`
      )
      router.refresh()
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Không duyệt được chênh lệch kiểm kê.')
    } finally {
      setPendingApprove(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/ton-kho/kiem-ke"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg"
            style={{ borderColor: 'var(--color-border)' }}
            aria-label="Về danh sách kiểm kê"
          >
            ←
          </Link>
          <h1 className="text-3xl font-semibold">{props.detail.countSheetCode}</h1>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          <div>
            Ngày kiểm kê: <span className="font-semibold text-slate-900">{formatDateLabel(props.detail.countDate)}</span>
          </div>
          <div>
            Trạng thái: <span className="font-semibold text-slate-900">{formatStatusLabel(props.detail.status)}</span>
          </div>
          <div>
            Loại: <span className="font-semibold text-slate-900">{props.detail.countType === 'OPENING_BALANCE' ? 'Nhập tồn đầu kỳ' : 'Kiểm kê vận hành'}</span>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, #16a34a 10%, white)', color: '#166534' }}>
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, #dc2626 10%, white)', color: '#991b1b' }}>
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Tồn hệ thống</div>
              <div className="mt-2 text-lg font-semibold">{formatNumber(totals.systemQty)}</div>
            </article>
            <article className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">SL kiểm kê</div>
              <div className="mt-2 text-lg font-semibold">{formatNumber(totals.countedQty)}</div>
            </article>
            <article className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Chênh lệch</div>
              <div className={`mt-2 text-lg font-semibold ${totals.varianceQty === 0 ? '' : totals.varianceQty > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatNumber(totals.varianceQty)}
              </div>
            </article>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
              <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                <th className="px-4 py-3">Dòng</th>
                <th className="px-4 py-3">Mặt hàng</th>
                <th className="px-4 py-3 text-right">Tồn hệ thống</th>
                <th className="px-4 py-3 text-right">SL kiểm kê</th>
                <th className="px-4 py-3 text-right">Chênh lệch</th>
                <th className="px-4 py-3 text-right">% chênh lệch</th>
                <th className="px-4 py-3 text-right">% hao hụt</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {props.detail.lines.map((line) => {
                const current = lineState[line.countLineId] || { countedQty: '0', note: '' }
                const countedQty = Number(current.countedQty || 0)
                const varianceQty = countedQty - Number(line.systemQty || 0)
                const variancePct = Number(line.systemQty || 0) === 0 ? 0 : (varianceQty / Number(line.systemQty || 0)) * 100
                const classification = canEditDraft
                  ? classifyLine({
                      itemType: line.itemType,
                      varianceQty,
                      variancePct,
                      allowedLossPct: Number(line.allowedLossPct || 0),
                    })
                  : line.costClassification ||
                    classifyLine({
                      itemType: line.itemType,
                      varianceQty,
                      variancePct,
                      allowedLossPct: Number(line.allowedLossPct || 0),
                    })
                return (
                  <tr key={line.countLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-4 font-semibold">{line.lineNo}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold">{line.itemName}</div>
                      <div className="app-muted mt-1 text-xs">{line.itemCode}{line.unit ? ` · ${line.unit}` : ''}</div>
                    </td>
                    <td className="px-4 py-4 text-right">{formatNumber(line.systemQty)}</td>
                    <td className="px-4 py-4 text-right">
                      {canEditDraft ? (
                        <input
                          className="w-28 rounded-lg border px-3 py-2 text-right"
                          style={{ borderColor: 'var(--color-border)' }}
                          value={current.countedQty}
                          onChange={(event) =>
                            setLineState((prev) => ({
                              ...prev,
                              [line.countLineId]: { ...current, countedQty: event.target.value },
                            }))
                          }
                        />
                      ) : (
                        <span className="font-semibold">{formatNumber(countedQty)}</span>
                      )}
                    </td>
                    <td className={`px-4 py-4 text-right ${varianceQty === 0 ? '' : varianceQty > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatNumber(varianceQty)}
                    </td>
                    <td className="px-4 py-4 text-right">{formatNumber(variancePct)}%</td>
                    <td className="px-4 py-4 text-right">{formatNumber(line.allowedLossPct)}%</td>
                    <td className="px-4 py-4">
                      <span
                        className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor:
                            classification === 'TON_TANG'
                              ? 'color-mix(in srgb, #16a34a 12%, white)'
                              : classification === 'CHI_PHI_QUAN_LY'
                                ? 'color-mix(in srgb, #2563eb 10%, white)'
                                : classification === 'CHI_PHI_THAT_THOAT'
                                  ? 'color-mix(in srgb, #dc2626 10%, white)'
                                  : 'color-mix(in srgb, #64748b 10%, white)',
                          color:
                            classification === 'TON_TANG'
                              ? '#166534'
                              : classification === 'CHI_PHI_QUAN_LY'
                                ? '#1d4ed8'
                                : classification === 'CHI_PHI_THAT_THOAT'
                                  ? '#991b1b'
                                  : '#475569',
                        }}
                      >
                        {formatClassificationLabel(classification)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {canEditDraft ? (
                        <input
                          className="w-full min-w-[180px] rounded-lg border px-3 py-2"
                          style={{ borderColor: 'var(--color-border)' }}
                          value={current.note}
                          onChange={(event) =>
                            setLineState((prev) => ({
                              ...prev,
                              [line.countLineId]: { ...current, note: event.target.value },
                            }))
                          }
                          placeholder="Nếu cần ghi chú"
                        />
                      ) : (
                        <span className="app-muted">{current.note || '-'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          {canEditDraft ? (
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-primary)' }}
              disabled={pendingSave}
              onClick={handleSave}
            >
              {pendingSave ? 'Đang lưu...' : 'Lưu phiếu kiểm kê'}
            </button>
          ) : null}
          {canConfirmWarehouse ? (
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{ borderColor: 'var(--color-border)' }}
              disabled={pendingConfirm}
              onClick={handleConfirm}
            >
              {pendingConfirm ? 'Đang xác nhận...' : 'Xác nhận'}
            </button>
          ) : null}
          {canApproveFinal ? (
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
              disabled={pendingApprove}
              onClick={handleApprove}
            >
              {pendingApprove ? 'Đang duyệt...' : 'Duyệt'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
