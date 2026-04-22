'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  fetchExternalPileOrderDetail,
  submitApproveExternalPileRequest,
  submitCreateExternalPileRequest,
} from '@/lib/external-pile-procurement/client-api'
import { ExternalPileProcurementOrderDetailClient } from '@/components/san-xuat/mua-coc-ngoai-order-detail-client'
import type {
  ExternalPileLineDraft,
  ExternalPileOrderDetail,
  ExternalPileProcurementPageData,
  ExternalPileRequestSummary,
} from '@/lib/external-pile-procurement/types'
import { isAdminRole, isPurchaseRole, isQlsxRole } from '@/lib/auth/roles'

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function buildEmptyLine(index: number): ExternalPileLineDraft {
  return {
    rowId: `line-${index}`,
    loaiCoc: '',
    tenDoan: '',
    chieuDaiM: 0,
    soLuong: 0,
    ghiChu: '',
  }
}

const DOAN_OPTIONS = [
  { value: 'MUI', label: 'Mũi' },
  { value: 'THAN', label: 'Thân' },
]

type UnifiedProcurementRow = {
  rowId: string
  requestId: string
  requestCode: string
  createdAt: string
  lineCount: number
  totalQty: number
  status: string
  note: string
  lines: ExternalPileRequestSummary['lines']
  poId: string | null
  poCode: string | null
  vendorName: string
  receivedQty: number
}

export function ExternalPileProcurementPageClient(props: {
  pageData: ExternalPileProcurementPageData
  viewerRole: string
}) {
  const router = useRouter()
  const adminViewer = isAdminRole(props.viewerRole)
  const qlsxViewer = isQlsxRole(props.viewerRole)
  const purchaseViewer = isPurchaseRole(props.viewerRole)
  const canCreateRequest = adminViewer || qlsxViewer
  const canApproveRequest = adminViewer || purchaseViewer
  const [requestNote, setRequestNote] = useState('')
  const [draftLines, setDraftLines] = useState<ExternalPileLineDraft[]>([buildEmptyLine(1)])
  const [approveState, setApproveState] = useState<Record<string, { vendorId: string; note: string; orderedQtyByLineId: Record<string, number> }>>({})
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [orderDetailByPoId, setOrderDetailByPoId] = useState<Record<string, ExternalPileOrderDetail>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState('')

  const requestRows = useMemo(
    () =>
      [...props.pageData.requestRows].sort((left, right) => {
        const leftTime = new Date(left.createdAt || 0).getTime()
        const rightTime = new Date(right.createdAt || 0).getTime()
        if (leftTime !== rightTime) return rightTime - leftTime
        return right.requestCode.localeCompare(left.requestCode)
      }),
    [props.pageData.requestRows]
  )
  const orderRows = useMemo(
    () =>
      [...props.pageData.orderRows].sort((left, right) => {
        const leftTime = new Date(left.createdAt || 0).getTime()
        const rightTime = new Date(right.createdAt || 0).getTime()
        if (leftTime !== rightTime) return rightTime - leftTime
        return right.poCode.localeCompare(left.poCode)
      }),
    [props.pageData.orderRows]
  )
  const unifiedRows = useMemo(() => {
    const orderByRequestId = new Map(
      orderRows
        .filter((row) => row.requestId)
        .map((row) => [row.requestId, row] as const)
    )

    return requestRows.map((requestRow) => {
      const matchedOrder = orderByRequestId.get(requestRow.requestId) || null
      return {
        rowId: matchedOrder?.poId || requestRow.requestId,
        requestId: requestRow.requestId,
        requestCode: requestRow.requestCode,
        createdAt: requestRow.createdAt,
        lineCount: requestRow.lineCount,
        totalQty: requestRow.totalQty,
        status: matchedOrder?.status || requestRow.status,
        note: matchedOrder?.note || requestRow.note,
        lines: requestRow.lines,
        poId: matchedOrder?.poId || null,
        poCode: matchedOrder?.poCode || null,
        vendorName: matchedOrder?.vendorName || '',
        receivedQty: matchedOrder?.totalReceivedQty || 0,
      } satisfies UnifiedProcurementRow
    })
  }, [orderRows, requestRows])

  function updateDraftLine(rowId: string, key: keyof ExternalPileLineDraft, value: string) {
    setDraftLines((current) =>
      current.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              [key]:
                key === 'chieuDaiM' || key === 'soLuong'
                  ? Number(value || 0)
                  : value,
            }
          : row
      )
    )
  }

  function addDraftLine() {
    setDraftLines((current) => [...current, buildEmptyLine(current.length + 1)])
  }

  function removeDraftLine(rowId: string) {
    setDraftLines((current) => (current.length > 1 ? current.filter((row) => row.rowId !== rowId) : current))
  }

  async function createRequest() {
    setMessage('')
    setError('')
    setPendingAction('create-request')
    try {
      const result = await submitCreateExternalPileRequest({
        note: requestNote,
        lines: draftLines,
      })
      setMessage(`Đã tạo đề xuất ${result.data?.requestCode || ''} với ${result.data?.lineCount || 0} dòng.`.trim())
      setRequestNote('')
      setDraftLines([buildEmptyLine(1)])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được đề xuất mua cọc ngoài.')
    } finally {
      setPendingAction('')
    }
  }

  function readApproveState(requestId: string) {
    return approveState[requestId] || { vendorId: '', note: '', orderedQtyByLineId: {} }
  }

  function updateApproveState(requestId: string, key: 'vendorId' | 'note', value: string) {
    setApproveState((current) => ({
      ...current,
      [requestId]: {
        ...readApproveState(requestId),
        [key]: value,
      },
    }))
  }

  function updateApproveOrderedQty(requestId: string, requestLineId: string, value: string) {
    setApproveState((current) => ({
      ...current,
      [requestId]: {
        ...readApproveState(requestId),
        orderedQtyByLineId: {
          ...readApproveState(requestId).orderedQtyByLineId,
          [requestLineId]: Math.max(Math.trunc(Number(value || 0)), 0),
        },
      },
    }))
  }

  async function approveRequest(row: ExternalPileRequestSummary) {
    const state = readApproveState(row.requestId)
    const vendor = props.pageData.vendorOptions.find((item) => item.value === state.vendorId)
    setMessage('')
    setError('')
    setPendingAction(`approve-${row.requestId}`)
    try {
      const result = await submitApproveExternalPileRequest({
        requestId: row.requestId,
        vendorId: state.vendorId,
        vendorName: vendor?.label || '',
        expectedDate: '',
        note: state.note,
        lines: row.lines.map((line) => ({
          requestLineId: line.requestLineId,
          orderedQty: state.orderedQtyByLineId[line.requestLineId] ?? line.soLuongDeXuat,
        })),
      })
      setMessage(`Đã lập phiếu mua ${result.data?.poCode || ''} từ đề xuất ${row.requestCode}.`.trim())
      setActiveRequestId(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không duyệt được đề xuất mua cọc ngoài.')
    } finally {
      setPendingAction('')
    }
  }

  async function handleSelectRow(row: UnifiedProcurementRow) {
    setMessage('')
    setError('')

    if (activeRequestId === row.requestId) {
      setActiveRequestId(null)
      return
    }

    setActiveRequestId(row.requestId)

    if (!row.poId || row.status === 'CHO_DUYET' || orderDetailByPoId[row.poId]) {
      return
    }

    setPendingAction(`detail-${row.poId}`)
    try {
      const result = await fetchExternalPileOrderDetail(row.poId)
      setOrderDetailByPoId((current) => ({
        ...current,
        [row.poId as string]: result.data as ExternalPileOrderDetail,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết phiếu.')
    } finally {
      setPendingAction('')
    }
  }

  const activeRow = activeRequestId
    ? unifiedRows.find((row) => row.requestId === activeRequestId) || null
    : null

  return (
    <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
      {message ? (
        <section className="border-b px-6 py-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)', color: 'var(--color-primary)' }}>
          {message}
        </section>
      ) : null}
      {error ? <section className="border-b px-6 py-3 text-sm app-accent-soft">{error}</section> : null}

      {!props.pageData.schemaReady ? (
        <section className="border-b px-6 py-4">
          <div className="app-accent-soft px-4 py-3 text-sm">
            Schema mua cọc ngoài đang dùng lại bảng request/order hiện có. Nếu màn này chưa tải được dữ liệu, cần kiểm tra lại setup `nvl_procurement_setup.sql`.
          </div>
        </section>
      ) : null}

      {canCreateRequest ? (
        <section className="px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Phiếu đề xuất</h2>
            <button type="button" onClick={addDraftLine} className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
              + Thêm dòng
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {draftLines.map((row, index) => (
              <div
                key={row.rowId}
                className="grid gap-3 border-t pt-3 md:grid-cols-[minmax(0,1.2fr)_180px_140px_140px_44px]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Field label="Loại cọc">
                  <input
                    list={`loai-coc-options-${index}`}
                    value={row.loaiCoc}
                    onChange={(event) => updateDraftLine(row.rowId, 'loaiCoc', event.target.value)}
                    placeholder="Ví dụ: PHC - A400 - 80"
                    className="app-input w-full rounded-xl px-3 py-2 text-sm"
                  />
                  <datalist id={`loai-coc-options-${index}`}>
                    {props.pageData.loaiCocOptions.map((option) => (
                      <option key={option.value} value={option.label} />
                    ))}
                  </datalist>
                </Field>

                <Field label="Đoạn">
                  <select
                    value={row.tenDoan}
                    onChange={(event) => updateDraftLine(row.rowId, 'tenDoan', event.target.value)}
                    className="app-input w-full rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">Chọn đoạn</option>
                    {DOAN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Chiều dài (m)">
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={row.chieuDaiM || ''}
                    onChange={(event) => updateDraftLine(row.rowId, 'chieuDaiM', event.target.value)}
                    className="app-input w-full rounded-xl px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Số lượng">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={row.soLuong || ''}
                    onChange={(event) => updateDraftLine(row.rowId, 'soLuong', event.target.value)}
                    className="app-input w-full rounded-xl px-3 py-2 text-sm"
                  />
                </Field>

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => removeDraftLine(row.rowId)}
                    className="inline-flex h-11 w-11 items-center justify-center text-sm font-semibold app-muted transition-colors hover:text-[var(--color-foreground)]"
                    disabled={draftLines.length === 1}
                    aria-label="Xóa dòng"
                    title="Xóa dòng"
                  >
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <Field label="Ghi chú đề xuất">
              <input
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Ghi chú chung cho phiếu đề xuất"
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="mt-4 flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <button
              type="button"
              onClick={() => void createRequest()}
              disabled={pendingAction === 'create-request'}
              className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {pendingAction === 'create-request' ? 'Đang gửi...' : 'Gửi đề xuất'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Danh sách phiếu</h2>
          <div className="app-muted text-sm">{unifiedRows.length} phiếu</div>
        </div>
        <div className="mt-3 space-y-3">
          {unifiedRows.length ? (
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="min-w-full text-left text-sm">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '33%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Phiếu</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Mã cọc</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-right">SL</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-right">Đã nhập</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {unifiedRows.map((row) => {
                    const selected = activeRequestId === row.requestId
                    const localDetail = row.poId ? orderDetailByPoId[row.poId] : null
                    const displayedReceivedQty = localDetail?.order.totalReceivedQty ?? row.receivedQty
                    const displayedStatus = localDetail?.order.status ?? row.status
                    return (
                      <tr
                        key={row.rowId}
                        className="cursor-pointer border-t align-top transition-colors"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 7%, white)' : 'transparent',
                        }}
                        onClick={() => void handleSelectRow(row)}
                      >
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="font-semibold">{row.requestCode}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="font-semibold">{row.lines[0]?.itemLabel || '-'}</div>
                            {row.lineCount > 1 ? (
                              <div className="app-muted text-xs">+ {row.lineCount - 1} dòng khác</div>
                            ) : null}
                            {row.vendorName ? <div className="app-muted text-xs">{row.vendorName}</div> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatNumber(row.totalQty)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatNumber(displayedReceivedQty)}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="font-medium">{formatUnifiedStatus(displayedStatus)}</div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border px-4 py-3 text-sm app-muted" style={{ borderColor: 'var(--color-border)' }}>
              Chưa có phiếu mua cọc ngoài.
            </div>
          )}
        </div>

        {activeRow ? (
          <section className="mt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            {canApproveRequest && activeRow.status === 'CHO_DUYET' ? (
              <ApproveDetailBlock
                row={activeRow}
                approveDraft={readApproveState(activeRow.requestId)}
                vendorOptions={props.pageData.vendorOptions}
                pendingAction={pendingAction}
                onChangeVendor={(value) => updateApproveState(activeRow.requestId, 'vendorId', value)}
                onChangeNote={(value) => updateApproveState(activeRow.requestId, 'note', value)}
                onChangeOrderedQty={(requestLineId, value) => updateApproveOrderedQty(activeRow.requestId, requestLineId, value)}
                onApprove={() =>
                  void approveRequest({
                    requestId: activeRow.requestId,
                    requestCode: activeRow.requestCode,
                    createdAt: activeRow.createdAt,
                    lineCount: activeRow.lineCount,
                    totalQty: activeRow.totalQty,
                    status: 'CHO_DUYET',
                    note: activeRow.note,
                    lines: activeRow.lines,
                  })
                }
              />
            ) : activeRow.poId ? (
              pendingAction === `detail-${activeRow.poId}` && !orderDetailByPoId[activeRow.poId] ? (
                <div className="px-6 py-5 text-sm app-muted">Đang tải chi tiết phiếu...</div>
              ) : orderDetailByPoId[activeRow.poId] ? (
                <ExternalPileProcurementOrderDetailClient
                  inline
                  detail={orderDetailByPoId[activeRow.poId]}
                  viewerRole={props.viewerRole}
                  onReceived={(detail) => {
                    setOrderDetailByPoId((current) => ({
                      ...current,
                      [activeRow.poId as string]: detail,
                    }))
                  }}
                />
              ) : (
                <div className="px-6 py-5 text-sm app-muted">Chưa tải được chi tiết phiếu.</div>
              )
            ) : (
              <div className="px-6 py-5 text-sm app-muted">Phiếu này chưa có dữ liệu chi tiết để hiển thị.</div>
            )}
          </section>
        ) : null}
      </section>
    </div>
  )
}

function formatUnifiedStatus(status: string) {
  switch (status) {
    case 'CHO_DUYET':
      return 'Chưa duyệt'
    case 'DA_GUI_NCC':
      return 'Đã lập phiếu mua'
    case 'DA_NHAN_MOT_PHAN':
      return 'Đã nhập một phần'
    case 'DA_NHAN_DU':
      return 'Đã nhập đủ'
    case 'HUY':
      return 'Hủy'
    case 'DA_CHUYEN_DAT_HANG':
      return 'Đã chuyển phiếu mua'
    default:
      return 'Nháp'
  }
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] app-muted">{props.label}</span>
      {props.children}
    </label>
  )
}

function ApproveDetailBlock(props: {
  row: UnifiedProcurementRow
  approveDraft: { vendorId: string; note: string; orderedQtyByLineId: Record<string, number> }
  vendorOptions: ExternalPileProcurementPageData['vendorOptions']
  pendingAction: string
  onChangeVendor: (value: string) => void
  onChangeNote: (value: string) => void
  onChangeOrderedQty: (requestLineId: string, value: string) => void
  onApprove: () => void
}) {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <div className="text-lg font-semibold">Duyệt phiếu đề xuất</div>
        <div className="app-muted mt-1 text-sm">
          {props.row.requestCode} · {formatNumber(props.row.totalQty)} cây
        </div>
      </div>

      <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
        {props.row.lines.map((line) => (
          <div
            key={line.requestLineId}
            className="grid gap-3 border-t py-3 md:grid-cols-[minmax(0,1fr)_220px_120px_120px]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="min-w-0">
              <div className="app-muted mb-1 text-xs font-semibold uppercase tracking-[0.12em]">Mã cọc</div>
              <div className="font-semibold">{line.itemLabel}</div>
              {line.ghiChu ? <div className="app-muted mt-1 text-xs">{line.ghiChu}</div> : null}
            </div>
            <div>
              <div className="app-muted mb-1 text-xs font-semibold uppercase tracking-[0.12em]">NCC</div>
              <select
                value={props.approveDraft.vendorId}
                onChange={(event) => props.onChangeVendor(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="">Chọn NCC</option>
                {props.vendorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <div className="app-muted mb-1 text-right text-xs font-semibold uppercase tracking-[0.12em]">SL đề xuất</div>
              <div className="rounded-xl px-3 py-2 text-right text-sm font-semibold" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                {formatNumber(line.soLuongDeXuat)}
              </div>
            </div>
            <div className="text-right">
              <div className="app-muted mb-1 text-right text-xs font-semibold uppercase tracking-[0.12em]">SL mua</div>
              <input
                type="number"
                min={0}
                step="1"
                value={
                  Object.prototype.hasOwnProperty.call(props.approveDraft.orderedQtyByLineId, line.requestLineId)
                    ? props.approveDraft.orderedQtyByLineId[line.requestLineId]
                    : ''
                }
                onChange={(event) => props.onChangeOrderedQty(line.requestLineId, event.target.value)}
                className="app-input w-full rounded-xl px-3 py-2 text-right text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[minmax(0,1fr)_180px]" style={{ borderColor: 'var(--color-border)' }}>
        <input
          value={props.approveDraft.note}
          onChange={(event) => props.onChangeNote(event.target.value)}
          placeholder="Ghi chú"
          className="app-input w-full rounded-xl px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={props.onApprove}
          disabled={props.pendingAction === `approve-${props.row.requestId}`}
          className="app-primary w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {props.pendingAction === `approve-${props.row.requestId}` ? 'Đang duyệt...' : 'Lập phiếu mua'}
        </button>
      </div>
    </div>
  )
}
