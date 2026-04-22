'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeRole } from '@/lib/auth/roles'
import type { FinishedGoodsCountDetail } from '@/lib/finished-goods-counting/types'
import {
  submitApproveFinishedGoodsCount,
  submitConfirmFinishedGoodsCount,
  submitSaveFinishedGoodsCountDraft,
} from '@/lib/finished-goods-counting/client-api'

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

function formatStatusLabel(value: FinishedGoodsCountDetail['status']) {
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
    default:
      return value
  }
}

function buildLineState(detail: FinishedGoodsCountDetail) {
  return Object.fromEntries(
    detail.lines.map((line) => [
      line.countLineId,
      {
        note: line.note || '',
        unexpectedFoundDatQty: String(line.unexpectedFoundDatQty || 0),
        unexpectedFoundLoiQty: String(line.unexpectedFoundLoiQty || 0),
        serialRows: Object.fromEntries(
          line.serialRows.map((serialRow) => [
            serialRow.countSerialId,
            {
              countStatus: serialRow.countStatus,
              qualityProposal: serialRow.qualityProposal,
              note: serialRow.note || '',
            },
          ])
        ),
      },
    ])
  )
}

export function FinishedGoodsCountDetailClient(props: {
  detail: FinishedGoodsCountDetail
  currentRole: string
}) {
  const router = useRouter()
  const normalizedRole = normalizeRole(props.currentRole)
  const isInventoryCounter =
    normalizedRole === 'kiem ke vien' ||
    normalizedRole === 'kiemke vien' ||
    normalizedRole === 'kiem ke' ||
    normalizedRole === 'inventory counter'
  const isWarehouse =
    normalizedRole === 'thu kho' || normalizedRole === 'thukho' || normalizedRole === 'warehouse'
  const isAdmin = normalizedRole === 'admin'
  const [detail, setDetail] = useState<FinishedGoodsCountDetail>(props.detail)
  const [note, setNote] = useState(props.detail.note || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingSave, setPendingSave] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [pendingApprove, setPendingApprove] = useState(false)
  const [lineState, setLineState] = useState(() => buildLineState(props.detail))

  useEffect(() => {
    setDetail(props.detail)
    setNote(props.detail.note || '')
    setLineState(buildLineState(props.detail))
    setMessage('')
    setError('')
    setPendingSave(false)
    setPendingConfirm(false)
    setPendingApprove(false)
  }, [props.detail])

  const canEditDraft = (isInventoryCounter || isAdmin) && detail.status === 'NHAP'
  const canConfirmWarehouse = (isWarehouse || isAdmin) && detail.status === 'CHO_XAC_NHAN_KHO'
  const canApproveFinal = isAdmin && detail.status === 'CHO_DUYET_CHENH_LECH'

  if (detail.countMode === 'TON_DAU_KY') {
    const printableLots = detail.lines.flatMap((line) => line.printableLots || [])
    const printableLotIds = Array.from(new Set(printableLots.map((lot) => lot.lotId).filter(Boolean)))
    const canOpenPrintedLabels = printableLotIds.length > 0

    return (
      <div className="space-y-6">
        <section className="app-surface rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <Link
                  href="/ton-kho/thanh-pham/kiem-ke"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg font-semibold"
                  style={{ borderColor: 'var(--color-border)' }}
                  aria-label="Về danh sách kiểm kê cọc"
                >
                  ←
                </Link>
                <h2 className="break-all text-xl font-semibold sm:text-2xl">{detail.countSheetCode}</h2>
              </div>
            </div>
          </div>

          <div className="app-muted mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <span>
              Ngày kiểm kê: <strong>{formatDateLabel(detail.countDate)}</strong>
            </span>
            <span>
              Trạng thái: <strong>{formatStatusLabel(detail.status)}</strong>
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {detail.lines.map((line) => (
              <section key={line.countLineId} className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)' }}>
                <h3 className="mt-2 text-xl font-semibold">{line.itemLabel}</h3>
                <div className="app-muted mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <span>Hệ thống: <strong>{formatNumber(line.systemQty)}</strong></span>
                  <span>Mở tồn: <strong>{formatNumber(line.countedQty)}</strong></span>
                  <span>Chênh lệch: <strong>{formatNumber(line.varianceQty)}</strong></span>
                  <span>Chất lượng: <strong>{line.qualityStatus === 'LOI' ? 'Lỗi / Khách lẻ' : 'Đạt'}</strong></span>
                </div>
                {line.note ? (
                  <div className="mt-3 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                    {line.note}
                  </div>
                ) : null}
                {line.printableLots.length ? (
                  <div
                    className="mt-4 rounded-2xl border px-4 py-4"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Tem đã sẵn sàng</div>
                        <p className="app-muted mt-1 text-sm">Mở danh sách tem ở tab mới để chọn từng tem, chọn tất cả hoặc in theo lô.</p>
                      </div>
                      {canOpenPrintedLabels ? (
                        <Link
                          href={`/ton-kho/thanh-pham/kiem-ke/in-tem?lot_ids=${line.printableLots.map((lot) => lot.lotId).join(',')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border px-3 py-2 text-xs font-semibold"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          Mở danh sách tem
                        </Link>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {line.printableLots.map((lot) => (
                        <div
                          key={`${line.countLineId}-${lot.lotId}`}
                          className="rounded-xl border px-4 py-3"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <div className="text-sm font-semibold">{lot.lotCode}</div>
                          <div className="app-muted mt-1 text-sm">{formatNumber(lot.serialCount)} serial</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-3 border-t pt-4">
            {canConfirmWarehouse ? (
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--color-border)' }}
                disabled={pendingConfirm}
                onClick={handleConfirm}
              >
                {pendingConfirm ? 'Đang duyệt...' : 'Duyệt'}
              </button>
            ) : null}
            {canApproveFinal ? (
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary)' }}
                disabled={pendingApprove}
                onClick={handleApprove}
              >
                {pendingApprove ? 'Đang duyệt...' : 'Duyệt'}
              </button>
            ) : null}
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
        </section>
      </div>
    )
  }

  function syncDetail(nextDetail: FinishedGoodsCountDetail | undefined) {
    if (!nextDetail) return
    setDetail(nextDetail)
    setNote(nextDetail.note || '')
    setLineState(buildLineState(nextDetail))
  }

  async function handleSave() {
    setMessage('')
    setError('')
    try {
      setPendingSave(true)
      const result = await submitSaveFinishedGoodsCountDraft({
        countSheetId: detail.countSheetId,
        note,
        lines: detail.lines.map((line) => {
          const current = lineState[line.countLineId]
          return {
            countLineId: line.countLineId,
            note: current?.note || '',
            unexpectedFoundDatQty: Number(current?.unexpectedFoundDatQty || 0),
            unexpectedFoundLoiQty: Number(current?.unexpectedFoundLoiQty || 0),
            serialRows: line.serialRows.map((serialRow) => {
              const currentSerial = current?.serialRows[serialRow.countSerialId]
              return {
                countSerialId: serialRow.countSerialId,
                countStatus: currentSerial?.countStatus || serialRow.countStatus,
                qualityProposal: currentSerial?.qualityProposal || serialRow.qualityProposal,
                note: currentSerial?.note || '',
              }
            }),
          }
        }),
      })
      syncDetail(result.data)
      setMessage(`Đã lưu phiếu kiểm kê cọc ${result.data?.countSheetCode || detail.countSheetCode}.`)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được phiếu kiểm kê cọc.')
    } finally {
      setPendingSave(false)
    }
  }

  async function handleConfirm() {
    setMessage('')
    setError('')
    try {
      setPendingConfirm(true)
      const result = await submitConfirmFinishedGoodsCount({ countSheetId: detail.countSheetId })
      syncDetail(result.data)
      setMessage(`Thủ kho đã xác nhận phiếu ${result.data?.countSheetCode || detail.countSheetCode}.`)
      router.refresh()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Không xác nhận kho được phiếu kiểm kê cọc.')
    } finally {
      setPendingConfirm(false)
    }
  }

  async function handleApprove() {
    setMessage('')
    setError('')
    try {
      setPendingApprove(true)
      const result = await submitApproveFinishedGoodsCount({ countSheetId: detail.countSheetId })
      syncDetail(result.data)
      setMessage(`Admin đã duyệt phiếu ${result.data?.countSheetCode || detail.countSheetCode} và ghi điều chỉnh tồn cọc.`)
      router.refresh()
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Không duyệt được chênh lệch kiểm kê cọc.')
    } finally {
      setPendingApprove(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <Link
                  href="/ton-kho/thanh-pham/kiem-ke"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg font-semibold"
                  style={{ borderColor: 'var(--color-border)' }}
                  aria-label="Về danh sách kiểm kê cọc"
                >
                  ←
                </Link>
              <h2 className="break-all text-xl font-semibold sm:text-2xl">{detail.countSheetCode}</h2>
            </div>
          </div>
        </div>

        <div className="app-muted mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <span>
            Ngày kiểm kê: <strong>{formatDateLabel(detail.countDate)}</strong>
          </span>
          <span>
            Trạng thái: <strong>{formatStatusLabel(detail.status)}</strong>
          </span>
        </div>

        <div className="mt-6 space-y-6">
          {detail.lines.map((line) => {
            const current = lineState[line.countLineId]
            const serialRows = line.serialRows.map((serialRow) => ({
              ...serialRow,
              current: current?.serialRows[serialRow.countSerialId] || {
                countStatus: serialRow.countStatus,
                qualityProposal: serialRow.qualityProposal,
                note: serialRow.note,
              },
            }))
            const generatedLots = Array.isArray(line.generatedLots) ? line.generatedLots : []
            const unexpectedFoundDatQty = Number(current?.unexpectedFoundDatQty || 0)
            const unexpectedFoundLoiQty = Number(current?.unexpectedFoundLoiQty || 0)
            const shouldShowGeneratedLots = detail.status !== 'NHAP' && generatedLots.length > 0
            const countedQty =
              serialRows.reduce((sum, serialRow) => {
                if (serialRow.current.countStatus === 'MISSING_IN_COUNT') return sum
                if (serialRow.current.qualityProposal === 'HUY') return sum
                return sum + 1
              }, 0) +
              unexpectedFoundDatQty +
              unexpectedFoundLoiQty

            return (
              <section key={line.countLineId} className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="mt-2 text-xl font-semibold">{line.itemLabel}</h3>
                    <p className="app-muted mt-2 text-sm">
                      Hệ thống: <strong>{formatNumber(line.systemQty)}</strong> · Kiểm kê: <strong>{formatNumber(countedQty)}</strong> · Chênh lệch:{' '}
                      <strong>{formatNumber(countedQty - line.systemQty)}</strong>
                    </p>
                  </div>
                  {canEditDraft ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Dư đạt</span>
                        <input
                          type="number"
                          min={0}
                          value={current?.unexpectedFoundDatQty === '0' ? '' : current?.unexpectedFoundDatQty || ''}
                          disabled={!canEditDraft}
                          onChange={(event) =>
                            setLineState((prev) => {
                              const nextState = prev ?? buildLineState(detail)
                              return {
                                ...nextState,
                                [line.countLineId]: {
                                  ...nextState[line.countLineId],
                                  unexpectedFoundDatQty: event.target.value,
                                },
                              }
                            })
                          }
                          className="w-full rounded-xl border px-3 py-2"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="font-medium">Dư lỗi</span>
                        <input
                          type="number"
                          min={0}
                          value={current?.unexpectedFoundLoiQty === '0' ? '' : current?.unexpectedFoundLoiQty || ''}
                          disabled={!canEditDraft}
                          onChange={(event) =>
                            setLineState((prev) => {
                              const nextState = prev ?? buildLineState(detail)
                              return {
                                ...nextState,
                                [line.countLineId]: {
                                  ...nextState[line.countLineId],
                                  unexpectedFoundLoiQty: event.target.value,
                                },
                              }
                            })
                          }
                          className="w-full rounded-xl border px-3 py-2"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>

            {shouldShowGeneratedLots ? (
              <div
                className="mt-4 rounded-2xl border px-4 py-4"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Tem dư chờ duyệt</div>
                    <p className="app-muted mt-1 hidden text-sm md:block">
                      Các serial dưới đây đã được sinh để kho in và dán ngay khi phát hiện dư. Chúng chưa tính vào tồn khả dụng cho tới khi Admin duyệt.
                    </p>
                    <p className="app-muted mt-1 text-sm md:hidden">Đã sinh tem dư để in dán, chờ Admin duyệt.</p>
                  </div>
                  <Link
                    href={`/ton-kho/thanh-pham/kiem-ke/in-tem?lot_ids=${generatedLots
                      .map((lot) => lot.lotId)
                      .filter(Boolean)
                      .join(',')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    Mở danh sách tem
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {generatedLots.map((lot, index) => (
                    <div
                      key={`${line.countLineId}-${lot.lotId || lot.lotCode || index}`}
                      className="rounded-xl border px-4 py-3"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="text-sm font-semibold">{lot.lotCode}</div>
                      <div className="app-muted mt-1 text-sm">
                        {lot.qualityProposal === 'LOI' ? 'Lỗi / Khách lẻ' : 'Đạt'} · {formatNumber(lot.serialCount)} serial
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

                <div className="mt-5 md:hidden space-y-3">
                  {serialRows.map((serialRow) => (
                    <article
                      key={serialRow.countSerialId}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 2%, white)' }}
                    >
                      <div className="text-sm font-semibold break-all">{serialRow.serialCode}</div>
                      <div className="app-muted mt-2 text-sm">Hiển thị hệ thống: {serialRow.systemVisibilityLabel || '-'}</div>
                      <div className="mt-3 grid gap-3">
                        {canEditDraft ? (
                          <>
                            <label className="space-y-2 text-sm">
                              <span className="font-medium">Kết quả kiểm</span>
                              <select
                                value={serialRow.current.countStatus}
                                disabled={!canEditDraft}
                                onChange={(event) =>
                                  setLineState((prev) => {
                                    const nextState = prev ?? buildLineState(detail)
                                    return {
                                      ...nextState,
                                      [line.countLineId]: {
                                        ...nextState[line.countLineId],
                                        serialRows: {
                                          ...nextState[line.countLineId].serialRows,
                                          [serialRow.countSerialId]: {
                                            ...nextState[line.countLineId].serialRows[serialRow.countSerialId],
                                            countStatus:
                                              event.target.value === 'MISSING_IN_COUNT' || event.target.value === 'WRONG_LOCATION'
                                                ? event.target.value
                                                : 'COUNTED',
                                          },
                                        },
                                      },
                                    }
                                  })
                                }
                                className="w-full rounded-xl border px-3 py-2"
                                style={{ borderColor: 'var(--color-border)' }}
                              >
                                <option value="COUNTED">Có thấy trong kiểm kê</option>
                                <option value="MISSING_IN_COUNT">Thiếu trong kiểm kê</option>
                              </select>
                            </label>
                            <label className="space-y-2 text-sm">
                              <span className="font-medium">Trạng thái đề xuất</span>
                              <select
                                value={serialRow.current.qualityProposal}
                                disabled={!canEditDraft}
                                onChange={(event) =>
                                  setLineState((prev) => {
                                    const nextState = prev ?? buildLineState(detail)
                                    return {
                                      ...nextState,
                                      [line.countLineId]: {
                                        ...nextState[line.countLineId],
                                        serialRows: {
                                          ...nextState[line.countLineId].serialRows,
                                          [serialRow.countSerialId]: {
                                            ...nextState[line.countLineId].serialRows[serialRow.countSerialId],
                                            qualityProposal:
                                              event.target.value === 'LOI' || event.target.value === 'HUY' ? event.target.value : 'DAT',
                                          },
                                        },
                                      },
                                    }
                                  })
                                }
                                className="w-full rounded-xl border px-3 py-2"
                                style={{ borderColor: 'var(--color-border)' }}
                              >
                                <option value="DAT">Đạt</option>
                                <option value="LOI">Lỗi / Khách lẻ</option>
                                <option value="HUY">Hủy</option>
                              </select>
                            </label>
                            <label className="space-y-2 text-sm">
                              <span className="font-medium">Ghi chú</span>
                              <input
                                type="text"
                                value={serialRow.current.note}
                                disabled={!canEditDraft}
                                onChange={(event) =>
                                  setLineState((prev) => {
                                    const nextState = prev ?? buildLineState(detail)
                                    return {
                                      ...nextState,
                                      [line.countLineId]: {
                                        ...nextState[line.countLineId],
                                        serialRows: {
                                          ...nextState[line.countLineId].serialRows,
                                          [serialRow.countSerialId]: {
                                            ...nextState[line.countLineId].serialRows[serialRow.countSerialId],
                                            note: event.target.value,
                                          },
                                        },
                                      },
                                    }
                                  })
                                }
                                className="w-full rounded-xl border px-3 py-2"
                                style={{ borderColor: 'var(--color-border)' }}
                              />
                            </label>
                          </>
                        ) : (
                          <>
                            <div className="text-sm">
                              <span className="font-medium">Kết quả kiểm: </span>
                              {serialRow.current.countStatus === 'MISSING_IN_COUNT' ? 'Thiếu trong kiểm kê' : 'Có thấy trong kiểm kê'}
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Trạng thái đề xuất: </span>
                              {serialRow.current.qualityProposal === 'LOI'
                                ? 'Lỗi / Khách lẻ'
                                : serialRow.current.qualityProposal === 'HUY'
                                  ? 'Hủy'
                                  : 'Đạt'}
                            </div>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-5 hidden overflow-hidden rounded-2xl border md:block" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="max-h-[520px] overflow-auto">
              <table className={`w-full table-fixed border-separate border-spacing-0 text-sm ${canEditDraft ? 'min-w-[1000px]' : 'min-w-[820px]'}`}>
                <thead className="text-left">
                  <tr>
                    <th className="sticky top-0 z-20 border-b px-4 py-3 font-semibold" style={{ backgroundColor: '#f6f8fb', borderColor: 'var(--color-border)', width: canEditDraft ? '28%' : '32%' }}>Serial</th>
                    <th className="sticky top-0 z-20 border-b px-4 py-3 font-semibold" style={{ backgroundColor: '#f6f8fb', borderColor: 'var(--color-border)', width: canEditDraft ? '18%' : '22%' }}>Hiển thị hệ thống</th>
                    <th className="sticky top-0 z-20 border-b px-4 py-3 font-semibold" style={{ backgroundColor: '#f6f8fb', borderColor: 'var(--color-border)', width: canEditDraft ? '20%' : '22%' }}>Kết quả kiểm</th>
                    <th className="sticky top-0 z-20 border-b px-4 py-3 font-semibold" style={{ backgroundColor: '#f6f8fb', borderColor: 'var(--color-border)', width: canEditDraft ? '16%' : '24%' }}>Trạng thái đề xuất</th>
                    {canEditDraft ? (
                      <th className="sticky top-0 z-20 border-b px-4 py-3 font-semibold" style={{ backgroundColor: '#f6f8fb', borderColor: 'var(--color-border)', width: '18%' }}>Ghi chú</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {serialRows.map((serialRow) => (
                    <tr key={serialRow.countSerialId} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-4 font-semibold">{serialRow.serialCode}</td>
                      <td className="px-4 py-4">{serialRow.systemVisibilityLabel || '-'}</td>
                      <td className="px-4 py-4">
                        {canEditDraft ? (
                          <select
                            value={serialRow.current.countStatus}
                            disabled={!canEditDraft}
                            onChange={(event) =>
                              setLineState((prev) => {
                                const nextState = prev ?? buildLineState(detail)
                                return {
                                  ...nextState,
                                  [line.countLineId]: {
                                    ...nextState[line.countLineId],
                                    serialRows: {
                                      ...nextState[line.countLineId].serialRows,
                                      [serialRow.countSerialId]: {
                                        ...nextState[line.countLineId].serialRows[serialRow.countSerialId],
                                        countStatus:
                                          event.target.value === 'MISSING_IN_COUNT' || event.target.value === 'WRONG_LOCATION'
                                            ? event.target.value
                                            : 'COUNTED',
                                      },
                                    },
                                  },
                                }
                              })
                            }
                            className="w-full rounded-xl border px-3 py-2"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            <option value="COUNTED">Có thấy trong kiểm kê</option>
                            <option value="MISSING_IN_COUNT">Thiếu trong kiểm kê</option>
                          </select>
                        ) : (
                          <span>{serialRow.current.countStatus === 'MISSING_IN_COUNT' ? 'Thiếu trong kiểm kê' : 'Có thấy trong kiểm kê'}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {canEditDraft ? (
                          <select
                            value={serialRow.current.qualityProposal}
                            disabled={!canEditDraft}
                            onChange={(event) =>
                              setLineState((prev) => {
                                const nextState = prev ?? buildLineState(detail)
                                return {
                                  ...nextState,
                                  [line.countLineId]: {
                                    ...nextState[line.countLineId],
                                    serialRows: {
                                      ...nextState[line.countLineId].serialRows,
                                      [serialRow.countSerialId]: {
                                        ...nextState[line.countLineId].serialRows[serialRow.countSerialId],
                                        qualityProposal:
                                          event.target.value === 'LOI' || event.target.value === 'HUY' ? event.target.value : 'DAT',
                                      },
                                    },
                                  },
                                }
                              })
                            }
                            className="w-full rounded-xl border px-3 py-2"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            <option value="DAT">Đạt</option>
                            <option value="LOI">Lỗi / Khách lẻ</option>
                            <option value="HUY">Hủy</option>
                          </select>
                        ) : (
                          <span>
                            {serialRow.current.qualityProposal === 'LOI'
                              ? 'Lỗi / Khách lẻ'
                              : serialRow.current.qualityProposal === 'HUY'
                                ? 'Hủy'
                                : 'Đạt'}
                          </span>
                        )}
                      </td>
                      {canEditDraft ? (
                        <td className="px-4 py-4">
                          <input
                            type="text"
                            value={serialRow.current.note}
                            disabled={!canEditDraft}
                            onChange={(event) =>
                              setLineState((prev) => {
                                const nextState = prev ?? buildLineState(detail)
                                return {
                                  ...nextState,
                                  [line.countLineId]: {
                                    ...nextState[line.countLineId],
                                    serialRows: {
                                      ...nextState[line.countLineId].serialRows,
                                      [serialRow.countSerialId]: {
                                        ...nextState[line.countLineId].serialRows[serialRow.countSerialId],
                                        note: event.target.value,
                                      },
                                    },
                                  },
                                }
                              })
                            }
                            className="w-full rounded-xl border px-3 py-2"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
                  </div>
                </div>
              </section>
            )
          })}
        </div>

        {canEditDraft ? (
          <div className="mt-6">
            <label className="text-sm font-semibold">Ghi chú phiếu</label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              style={{ borderColor: 'var(--color-border)' }}
              value={note}
              disabled={!canEditDraft}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3 border-t pt-4">
          {canEditDraft ? (
            <button
              type="button"
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto sm:py-2"
              style={{ backgroundColor: 'var(--color-primary)' }}
              disabled={pendingSave}
              onClick={handleSave}
            >
              {pendingSave ? 'Đang lưu...' : 'Lưu phiếu kiểm kê cọc'}
            </button>
          ) : null}
          {canConfirmWarehouse ? (
            <button
              type="button"
              className="w-full rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-60 sm:w-auto sm:py-2"
              style={{ borderColor: 'var(--color-border)' }}
              disabled={pendingConfirm}
              onClick={handleConfirm}
            >
              {pendingConfirm ? 'Đang duyệt...' : 'Duyệt'}
            </button>
          ) : null}
          {canApproveFinal ? (
            <button
              type="button"
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto sm:py-2"
              style={{ backgroundColor: 'var(--color-primary)' }}
              disabled={pendingApprove}
              onClick={handleApprove}
            >
              {pendingApprove ? 'Đang duyệt...' : 'Duyệt'}
            </button>
          ) : null}
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
      </section>
    </div>
  )
}
