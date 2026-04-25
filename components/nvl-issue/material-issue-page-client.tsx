'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAdminRole, isCommercialRole, isWarehouseRole } from '@/lib/auth/roles'
import {
  fetchMaterialIssueCreateBootstrap,
  fetchMaterialIssueVoucherDetail,
  submitConfirmMaterialIssueVoucher,
  submitCreateMaterialIssueVoucher,
} from '@/lib/nvl-issue/client-api'
import type {
  MaterialIssueLineDraft,
  MaterialIssuePageData,
  MaterialIssueVoucherDetail,
  MaterialIssueVoucherSummary,
} from '@/lib/nvl-issue/types'

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

function resolveDisplayMaterialCode(input: { displayCode?: string; materialCode?: string }) {
  const displayCode = String(input.displayCode || '').trim()
  if (displayCode && !isUuidLike(displayCode)) return displayCode

  const materialCode = String(input.materialCode || '').trim()
  if (!materialCode || isUuidLike(materialCode)) return ''
  return materialCode
}

function buildEmptyLine(index: number): MaterialIssueLineDraft {
  return {
    rowId: `line-${index}`,
    materialCode: '',
    requestedQty: 0,
    unitPrice: 0,
    note: '',
  }
}

export function MaterialIssuePageClient(props: {
  pageData: MaterialIssuePageData
  viewerRole: string
}) {
  const router = useRouter()
  const canCreate = isCommercialRole(props.viewerRole) || isAdminRole(props.viewerRole)
  const canConfirm = isWarehouseRole(props.viewerRole) || isAdminRole(props.viewerRole)
  const [createBootstrap, setCreateBootstrap] = useState({
    customers: props.pageData.customers,
    projects: props.pageData.projects,
    materialOptions: props.pageData.materialOptions,
  })
  const [createBootstrapLoaded, setCreateBootstrapLoaded] = useState(
    props.pageData.customers.length > 0 ||
      props.pageData.projects.length > 0 ||
      props.pageData.materialOptions.length > 0 ||
      !canCreate
  )
  const [createBootstrapPending, setCreateBootstrapPending] = useState(false)
  const [createBootstrapRequested, setCreateBootstrapRequested] = useState(false)
  const [issueKind, setIssueKind] = useState<'BAN_VAT_TU' | 'DIEU_CHUYEN'>('BAN_VAT_TU')
  const [khId, setKhId] = useState('')
  const [note, setNote] = useState('')
  const [draftLines, setDraftLines] = useState<MaterialIssueLineDraft[]>([buildEmptyLine(1)])
  const [materialSearchByRow, setMaterialSearchByRow] = useState<Record<string, string>>({})
  const [activeVoucherId, setActiveVoucherId] = useState('')
  const [detailByVoucherId, setDetailByVoucherId] = useState<Record<string, MaterialIssueVoucherDetail>>({})
  const [actualByLine, setActualByLine] = useState<Record<string, string>>({})
  const [confirmNote, setConfirmNote] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState('')

  const vouchers = useMemo(
    () =>
      [...props.pageData.vouchers].sort((left, right) => {
        const leftTime = new Date(left.createdAt || 0).getTime()
        const rightTime = new Date(right.createdAt || 0).getTime()
        if (leftTime !== rightTime) return rightTime - leftTime
        return right.voucherCode.localeCompare(left.voucherCode)
      }),
    [props.pageData.vouchers]
  )

  const materialOptions = useMemo(
    () =>
      createBootstrap.materialOptions.map((item) => ({
        ...item,
        searchLabel: [item.materialName, item.displayCode || item.materialCode].filter(Boolean).join(' · '),
      })),
    [createBootstrap.materialOptions]
  )

  useEffect(() => {
    if (!canCreate || createBootstrapLoaded || createBootstrapRequested) return

    let active = true
    setCreateBootstrapRequested(true)
    setCreateBootstrapPending(true)
    void fetchMaterialIssueCreateBootstrap()
      .then((result) => {
        if (!active || !result.data) return
        setCreateBootstrap(result.data)
        setCreateBootstrapLoaded(true)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu lập phiếu xuất NVL.')
      })
      .finally(() => {
        if (active) {
          setCreateBootstrapPending(false)
          setCreateBootstrapRequested(false)
        }
      })

    return () => {
      active = false
    }
  }, [canCreate, createBootstrapLoaded, createBootstrapRequested])

  function updateDraftLine(rowId: string, key: keyof MaterialIssueLineDraft, value: string) {
    setDraftLines((current) =>
      current.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              [key]:
                key === 'requestedQty' || key === 'unitPrice'
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
    setMaterialSearchByRow((current) => {
      const next = { ...current }
      delete next[rowId]
      return next
    })
  }

  function updateMaterialSearch(rowId: string, value: string) {
    setMaterialSearchByRow((current) => ({
      ...current,
      [rowId]: value,
    }))

    const normalized = value.trim().toLowerCase()
    const matched = materialOptions.find((item) => {
      const searchLabel = item.searchLabel.trim().toLowerCase()
      return (
        searchLabel === normalized ||
        item.materialName.trim().toLowerCase() === normalized ||
        String(item.displayCode || item.materialCode).trim().toLowerCase() === normalized
      )
    })

    updateDraftLine(rowId, 'materialCode', matched ? matched.materialCode : '')
  }

  async function createVoucher() {
    setMessage('')
    setError('')
    setPendingAction('create')
    try {
      const result = await submitCreateMaterialIssueVoucher({
        issueKind,
        khId,
        note,
        lines: draftLines,
      })
      setMessage(`Đã tạo phiếu ${result.data?.voucherCode || ''}.`.trim())
      setDraftLines([buildEmptyLine(1)])
      setMaterialSearchByRow({})
      setKhId('')
      setNote('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được phiếu xuất NVL.')
    } finally {
      setPendingAction('')
    }
  }

  async function selectVoucher(row: MaterialIssueVoucherSummary) {
    setMessage('')
    setError('')

    if (activeVoucherId === row.voucherId) {
      setActiveVoucherId('')
      setConfirmNote('')
      return
    }

    setActiveVoucherId(row.voucherId)
    if (detailByVoucherId[row.voucherId]) {
      const detail = detailByVoucherId[row.voucherId]
      setConfirmNote(detail.note)
      setActualByLine(Object.fromEntries(detail.lines.map((line) => [line.voucherLineId, String(line.actualQty || 0)])))
      return
    }

    setPendingAction(`detail-${row.voucherId}`)
    try {
      const result = await fetchMaterialIssueVoucherDetail(row.voucherId)
      if (!result.data) throw new Error('Không tải được chi tiết phiếu.')
      setDetailByVoucherId((current) => ({
        ...current,
        [row.voucherId]: result.data as MaterialIssueVoucherDetail,
      }))
      setConfirmNote(result.data.note)
      setActualByLine(
        Object.fromEntries((result.data as MaterialIssueVoucherDetail).lines.map((line) => [line.voucherLineId, String(line.actualQty || 0)]))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết phiếu.')
    } finally {
      setPendingAction('')
    }
  }

  async function confirmVoucher(detail: MaterialIssueVoucherDetail) {
    setMessage('')
    setError('')
    setPendingAction(`confirm-${detail.voucherId}`)
    try {
      const result = await submitConfirmMaterialIssueVoucher({
        voucherId: detail.voucherId,
        note: confirmNote,
        lines: detail.lines.map((line) => ({
          voucherLineId: line.voucherLineId,
          actualQty: Number(actualByLine[line.voucherLineId] || 0),
        })),
      })
      const nextDetail: MaterialIssueVoucherDetail = {
        ...detail,
        status: (result.data?.status as MaterialIssueVoucherDetail['status']) || detail.status,
        note: confirmNote,
        operationDate: new Date().toISOString().slice(0, 10),
        actualQtyTotal: detail.lines.reduce((sum, line) => sum + Number(actualByLine[line.voucherLineId] || 0), 0),
        lines: detail.lines.map((line) => ({
          ...line,
          actualQty: Number(actualByLine[line.voucherLineId] || 0),
        })),
      }
      setDetailByVoucherId((current) => ({
        ...current,
        [detail.voucherId]: nextDetail,
      }))
      setMessage(`Đã xác nhận phiếu ${result.data?.voucherCode || detail.voucherCode}.`.trim())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xác nhận được phiếu xuất NVL.')
    } finally {
      setPendingAction('')
    }
  }

  const activeDetail = activeVoucherId ? detailByVoucherId[activeVoucherId] || null : null

  return (
    <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
      {message ? (
        <section className="border-b px-6 py-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)', color: 'var(--color-primary)' }}>
          {message}
        </section>
      ) : null}
      {error ? <section className="border-b px-6 py-3 text-sm app-accent-soft">{error}</section> : null}

      {!props.pageData.schemaReady ? (
        <section className="px-6 py-5">
          <div className="app-accent-soft rounded-2xl px-4 py-3 text-sm">
            Chưa thấy schema `material_issue_voucher`. Cần chạy file `sql/nvl_issue_voucher_setup.sql` trước khi dùng chức năng xuất NVL.
          </div>
        </section>
      ) : (
        <>
          {canCreate ? (
            <section className="px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Phiếu đề xuất xuất NVL</h2>
                <button type="button" onClick={addDraftLine} className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
                  + Thêm dòng
                </button>
              </div>
              {!createBootstrapLoaded || createBootstrapPending ? (
                <div className="mt-4 border-t pt-4 text-sm app-muted" style={{ borderColor: 'var(--color-border)' }}>
                  Đang tải dữ liệu lập phiếu xuất NVL...
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2" style={{ borderColor: 'var(--color-border)' }}>
                <Field label="Loại phiếu">
                  <select value={issueKind} onChange={(event) => setIssueKind(event.target.value as 'BAN_VAT_TU' | 'DIEU_CHUYEN')} className="app-input w-full rounded-xl px-3 py-2 text-sm">
                    <option value="BAN_VAT_TU">Xuất bán vật tư</option>
                    <option value="DIEU_CHUYEN">Điều chuyển</option>
                  </select>
                </Field>
                <Field label="Khách hàng">
                  <select value={khId} onChange={(event) => setKhId(event.target.value)} className="app-input w-full rounded-xl px-3 py-2 text-sm">
                    <option value="">Chọn khách hàng</option>
                    {createBootstrap.customers.map((item) => (
                      <option key={item.khId} value={item.khId}>{item.tenKh}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="hidden border-b pb-2 text-xs font-semibold uppercase tracking-[0.14em] app-muted md:grid md:grid-cols-[minmax(0,1.5fr)_90px_150px_170px_32px] md:gap-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div>NVL</div>
                  <div>ĐVT</div>
                  <div className="text-right">Số lượng</div>
                  <div className="text-right">Đơn giá</div>
                  <div />
                </div>
                <datalist id="nvl-issue-material-options">
                  {materialOptions.map((item) => (
                    <option key={item.materialCode} value={item.searchLabel} />
                  ))}
                </datalist>
                {draftLines.map((row) => {
                  const material = materialOptions.find((item) => item.materialCode === row.materialCode)
                  const searchValue = materialSearchByRow[row.rowId] ?? material?.searchLabel ?? ''
                  return (
                    <div key={row.rowId} className="grid gap-3 border-b py-3 md:grid-cols-[minmax(0,1.5fr)_90px_150px_170px_32px] md:items-start" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] app-muted md:hidden">NVL</div>
                        <input
                          list="nvl-issue-material-options"
                          value={searchValue}
                          onChange={(event) => updateMaterialSearch(row.rowId, event.target.value)}
                          placeholder="Gõ tên hoặc mã NVL để tìm"
                          className="app-input w-full rounded-xl px-3 py-2 text-sm"
                        />
                        {material ? (
                          <div className="app-muted text-xs">
                            {[material.displayCode, `${formatNumber(material.availableQty)} ${material.unit}`].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] app-muted md:hidden">ĐVT</div>
                        <div className="flex h-11 items-center rounded-xl border px-3 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 2%, white)' }}>
                          {material?.unit || '-'}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] app-muted md:hidden">Số lượng</div>
                        <input type="number" min={0} step="0.001" value={row.requestedQty || ''} onChange={(event) => updateDraftLine(row.rowId, 'requestedQty', event.target.value)} className="app-input w-full rounded-xl px-3 py-2 text-right text-sm" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] app-muted md:hidden">Đơn giá</div>
                        <input type="number" min={0} step="1" value={row.unitPrice || ''} onChange={(event) => updateDraftLine(row.rowId, 'unitPrice', event.target.value)} className="app-input w-full rounded-xl px-3 py-2 text-right text-sm" />
                      </div>
                      <div className="flex items-center justify-end md:pt-2">
                        <button type="button" onClick={() => removeDraftLine(row.rowId)} className="text-sm font-semibold app-muted transition-colors hover:text-[var(--color-foreground)]" disabled={draftLines.length === 1}>
                          x
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <Field label="Ghi chú phiếu">
                  <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú phiếu xuất NVL" className="app-input w-full rounded-xl px-3 py-2 text-sm" />
                </Field>
              </div>

              <div className="mt-4 flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <button type="button" onClick={() => void createVoucher()} disabled={pendingAction === 'create' || !createBootstrapLoaded} className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">
                  {pendingAction === 'create' ? 'Đang tạo...' : 'Tạo phiếu'}
                </button>
              </div>
            </section>
          ) : null}

          <section className="border-t px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Danh sách phiếu</h2>
              <div className="app-muted text-sm">{vouchers.length} phiếu</div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Phiếu</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Loại</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-right">SL đề xuất</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-right">SL thực xuất</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.length ? vouchers.map((row) => {
                    const selected = activeVoucherId === row.voucherId
                    return (
                      <tr
                        key={row.voucherId}
                        className="cursor-pointer border-t transition-colors"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 7%, white)' : 'transparent',
                        }}
                        onClick={() => void selectVoucher(row)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold">{row.voucherCode}</div>
                          {row.customerName ? (
                            <div className="app-muted mt-1 text-xs">
                              {row.customerName}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{row.issueKind === 'DIEU_CHUYEN' ? 'Điều chuyển' : 'Xuất bán'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatNumber(row.requestedQtyTotal)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatNumber(row.actualQtyTotal)}</td>
                        <td className="px-4 py-3">{formatStatusLabel(row.status)}</td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm app-muted">Chưa có phiếu xuất NVL nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {activeVoucherId ? (
              <section className="mt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                {pendingAction === `detail-${activeVoucherId}` && !activeDetail ? (
                  <div className="px-6 py-5 text-sm app-muted">Đang tải chi tiết phiếu...</div>
                ) : activeDetail ? (
                  <div className="px-6 py-5">
                    <div className="mb-4">
                      <div className="text-lg font-semibold">Chi tiết phiếu xuất NVL</div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">NVL</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-center">ĐVT</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-right">Khả dụng</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-right">Đơn giá</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-right">Thành tiền</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-right">Thực xuất</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeDetail.lines.map((line) => (
                            <tr key={line.voucherLineId} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                              <td className="px-4 py-3">
                                <div className="font-semibold">{line.materialName}</div>
                                {resolveDisplayMaterialCode(line) ? (
                                  <div className="app-muted mt-1 text-xs">{resolveDisplayMaterialCode(line)}</div>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-center">{line.unit || '-'}</td>
                              <td className="px-4 py-3 text-right">{formatNumber(line.availableQtySnapshot)}</td>
                              <td className="px-4 py-3 text-right">{formatMoney(line.unitPrice)}</td>
                              <td className="px-4 py-3 text-right">{formatMoney(line.lineTotal)}</td>
                              <td className="px-4 py-3 text-right">
                                {canConfirm && activeDetail.status === 'CHO_XAC_NHAN' ? (
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.001"
                                    value={actualByLine[line.voucherLineId] ?? String(line.actualQty || 0)}
                                    onChange={(event) =>
                                      setActualByLine((current) => ({
                                        ...current,
                                        [line.voucherLineId]: event.target.value,
                                      }))
                                    }
                                    className="app-input w-28 rounded-xl px-3 py-2 text-right text-sm"
                                  />
                                ) : (
                                  formatNumber(line.actualQty)
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[minmax(0,1fr)_220px]" style={{ borderColor: 'var(--color-border)' }}>
                      <Field label={canConfirm ? 'Ghi chú xác nhận' : 'Ghi chú phiếu'}>
                        <input
                          value={confirmNote}
                          onChange={(event) => setConfirmNote(event.target.value)}
                          className="app-input w-full rounded-xl px-3 py-2 text-sm"
                          placeholder="Ghi chú phiếu xuất NVL"
                          disabled={!canConfirm || activeDetail.status !== 'CHO_XAC_NHAN'}
                        />
                      </Field>
                      {canConfirm && activeDetail.status === 'CHO_XAC_NHAN' ? (
                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => void confirmVoucher(activeDetail)}
                            disabled={pendingAction === `confirm-${activeDetail.voucherId}`}
                            className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                          >
                            {pendingAction === `confirm-${activeDetail.voucherId}` ? 'Đang xác nhận...' : 'Xác nhận xuất'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-5 text-sm app-muted">Không tải được chi tiết phiếu.</div>
                )}
              </section>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] app-muted">{props.label}</span>
      {props.children}
    </label>
  )
}

function formatStatusLabel(status: MaterialIssueVoucherSummary['status']) {
  if (status === 'DA_XUAT') return 'Đã xuất'
  if (status === 'XUAT_MOT_PHAN') return 'Xuất một phần'
  if (status === 'HUY') return 'Hủy'
  return 'Chờ xác nhận'
}
