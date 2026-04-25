'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type {
  AvailableSegmentOption,
  KeHoachNgayDetail,
  WarehouseConcreteGradeSummary,
  WarehouseIssueMaterialSummary,
} from '@/lib/san-xuat/types'
import { isAdminRole, isQlsxRole, isWarehouseRole } from '@/lib/auth/roles'
import {
  fetchKeHoachNgayDetail,
  submitAddKeHoachLine,
  submitDeleteKeHoachLine,
  submitReopenWarehouseIssue,
  submitSaveWarehouseIssue,
} from '@/lib/san-xuat/client-api'

type ConcreteAllocationRow = {
  id: string
  concreteGrade: string
  variant: string
  volumeM3: number
}

export function KeHoachNgayDetailClient(props: {
  detail: KeHoachNgayDetail
  embedded?: boolean
  viewerRole: string
}) {
  const [localDetail, setLocalDetail] = useState<KeHoachNgayDetail | null>(null)
  const detail = localDetail || props.detail
  const warehouseViewer = isWarehouseRole(props.viewerRole)
  const adminViewer = isAdminRole(props.viewerRole)
  const canEditPlan = (isQlsxRole(props.viewerRole) || adminViewer) && detail.plan.trang_thai !== 'DA_CHOT'
  const warehouseIssue = detail.warehouseIssue
  const adminCanReopenWarehouseIssue = adminViewer && detail.plan.trang_thai === 'DA_CHOT' && Boolean(warehouseIssue?.locked)
  const canUseWarehouseFlow = warehouseViewer && detail.plan.trang_thai === 'DA_CHOT'
  const warehouseIssueLocked = canUseWarehouseFlow && Boolean(warehouseIssue?.locked)

  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedDoanKey, setSelectedDoanKey] = useState('')
  const [soLuongKeHoach, setSoLuongKeHoach] = useState<number>(0)
  const [note, setNote] = useState('')
  const [actualQtyByLine, setActualQtyByLine] = useState<Record<string, string>>(() =>
    buildInitialActualQtyState(detail.lines)
  )
  const [issueNote, setIssueNote] = useState(warehouseIssue?.note || '')
  const [concreteAllocationRows, setConcreteAllocationRows] = useState<ConcreteAllocationRow[]>(() =>
    buildInitialConcreteAllocationRows(warehouseIssue?.concreteSummaries || [])
  )
  const [materialActuals, setMaterialActuals] = useState<Record<string, string>>(() =>
    buildInitialMaterialActualState(warehouseIssue?.materialSummaries || [])
  )
  const [materialActualTouched, setMaterialActualTouched] = useState<Record<string, boolean>>(() =>
    buildInitialMaterialTouchedState(warehouseIssue?.materialSummaries || [], Boolean(warehouseIssue?.voucherId))
  )
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLocalDetail(null)
  }, [props.detail])

  useEffect(() => {
    setActualQtyByLine(buildInitialActualQtyState(detail.lines))
    setIssueNote(warehouseIssue?.note || '')
    setConcreteAllocationRows(buildInitialConcreteAllocationRows(warehouseIssue?.concreteSummaries || []))
    setMaterialActuals(buildInitialMaterialActualState(warehouseIssue?.materialSummaries || []))
    setMaterialActualTouched(
      buildInitialMaterialTouchedState(warehouseIssue?.materialSummaries || [], Boolean(warehouseIssue?.voucherId))
    )
  }, [detail.plan.plan_id, detail.lines, warehouseIssue])

  async function reloadPlanDetail() {
    const result = await fetchKeHoachNgayDetail(detail.plan.plan_id)
    if (result.data) setLocalDetail(result.data)
  }

  const orderOptions = useMemo(() => {
    const map = new Map<string, AvailableSegmentOption>()
    for (const row of detail.availableSegments) {
      if (!map.has(row.orderId)) map.set(row.orderId, row)
    }
    return Array.from(map.values())
  }, [detail.availableSegments])

  const segmentOptions = useMemo(
    () => detail.availableSegments.filter((row) => row.orderId === selectedOrderId),
    [detail.availableSegments, selectedOrderId]
  )

  const selectedSegment = useMemo(
    () => segmentOptions.find((row) => row.doanKey === selectedDoanKey) || null,
    [segmentOptions, selectedDoanKey]
  )

  const concreteRequirements = useMemo(() => {
    if (!warehouseIssue) return [] as WarehouseConcreteGradeSummary[]

    const bucket = new Map<string, WarehouseConcreteGradeSummary>()
    for (const lineDraft of warehouseIssue.lineDrafts) {
      const actualQty = Number(actualQtyByLine[lineDraft.lineId] || 0)
      const requiredM3 = round3(Number(lineDraft.concreteRequiredM3PerUnit || 0) * actualQty)
      if (requiredM3 <= 0) continue

      const gradeKey = normalizeGrade(lineDraft.concreteGrade)
      const current = bucket.get(gradeKey) || {
        concreteGrade: lineDraft.concreteGrade,
        requiredM3: 0,
        variantOptions: lineDraft.variantOptions,
        variantRecipes: lineDraft.variantRecipes,
        allocations: [],
      }
      current.requiredM3 = round3(current.requiredM3 + requiredM3)
      if (!current.variantOptions.length && lineDraft.variantOptions.length) {
        current.variantOptions = lineDraft.variantOptions
      }
      if (!current.variantRecipes.length && lineDraft.variantRecipes.length) {
        current.variantRecipes = lineDraft.variantRecipes
      }
      bucket.set(gradeKey, current)
    }

    return Array.from(bucket.values()).sort((a, b) => a.concreteGrade.localeCompare(b.concreteGrade))
  }, [actualQtyByLine, warehouseIssue])

  const concreteRequirementMap = useMemo(
    () => new Map(concreteRequirements.map((summary) => [normalizeGrade(summary.concreteGrade), summary])),
    [concreteRequirements]
  )

  const concreteGradeOptions = useMemo(
    () =>
      concreteRequirements.map((summary) => ({
        value: summary.concreteGrade,
        label: summary.concreteGrade,
      })),
    [concreteRequirements]
  )

  const concreteSummaries = useMemo(() => {
    return concreteRequirements.map((summary) => {
      const gradeKey = normalizeGrade(summary.concreteGrade)
      const allocations = concreteAllocationRows
        .filter((row) => normalizeGrade(row.concreteGrade) === gradeKey)
        .map((row) => ({
          variant: row.variant,
          volumeM3: round3(Number(row.volumeM3 || 0)),
        }))

      return {
        ...summary,
        allocations,
      }
    })
  }, [concreteAllocationRows, concreteRequirements])

  const concreteMaterialSummaries = useMemo(
    () => concreteSummaries.flatMap((summary) => buildConcreteMaterialsFromSummary(summary)),
    [concreteSummaries]
  )

  const nonConcreteMaterialSummaries = useMemo(() => {
    if (!warehouseIssue) return [] as WarehouseIssueMaterialSummary[]

    const lineDraftMap = new Map(warehouseIssue.lineDrafts.map((row) => [row.lineId, row]))
    const bucket = new Map<string, WarehouseIssueMaterialSummary>()

    for (const line of detail.lines) {
      const lineDraft = lineDraftMap.get(line.line_id)
      if (!lineDraft) continue
      const actualQty = Number(actualQtyByLine[line.line_id] || 0)
      for (const material of lineDraft.materials.filter((item) => item.nhom !== 'BETONG')) {
        const estimateQty = round3(Number(material.ratePerUnit || 0) * actualQty)
        const current = bucket.get(material.key)
        if (current) {
          current.estimateQty = round3(current.estimateQty + estimateQty)
          continue
        }
        bucket.set(material.key, {
          key: material.key,
          nhom: material.nhom,
          label: material.label,
          dvt: material.dvt,
          estimateQty,
          actualQty: estimateQty,
        })
      }
    }

    return Array.from(bucket.values())
      .map((material) => ({
        ...material,
        actualQty: round3(toNumber(materialActuals[material.key], material.estimateQty)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [actualQtyByLine, materialActuals, detail.lines, warehouseIssue])

  const allMaterialSummaries = useMemo(
    () => mergeMaterialSummaries([...nonConcreteMaterialSummaries, ...concreteMaterialSummaries]).map((material) => ({
      ...material,
      actualQty: round3(toNumber(materialActuals[material.key], material.estimateQty)),
    })),
    [concreteMaterialSummaries, materialActuals, nonConcreteMaterialSummaries]
  )

  const groupedMaterialSummaries = useMemo(() => {
    const order: Array<WarehouseIssueMaterialSummary['nhom']> = ['BETONG', 'THEP', 'PHU_KIEN', 'PHU_GIA']
    return order
      .map((nhom) => ({
        nhom,
        items: allMaterialSummaries.filter((material) => material.nhom === nhom),
      }))
      .filter((group) => group.items.length > 0)
  }, [allMaterialSummaries])

  useEffect(() => {
    setMaterialActuals((current) => {
      let changed = false
      const next = { ...current }
      for (const material of concreteMaterialSummaries) {
        const targetValue = String(material.estimateQty)
        if (!(material.key in next) || !materialActualTouched[material.key]) {
          if (next[material.key] !== targetValue) {
            next[material.key] = targetValue
            changed = true
          }
        }
      }
      return changed ? next : current
    })
  }, [concreteMaterialSummaries, materialActualTouched])

  useEffect(() => {
    setMaterialActuals((current) => {
      let changed = false
      const next = { ...current }
      for (const material of allMaterialSummaries) {
        const targetValue = String(material.estimateQty)
        if (!(material.key in next) || !materialActualTouched[material.key]) {
          if (next[material.key] !== targetValue) {
            next[material.key] = targetValue
            changed = true
          }
        }
      }
      return changed ? next : current
    })
  }, [allMaterialSummaries, materialActualTouched])

  const concreteAllocatedByGrade = useMemo(() => {
    const bucket = new Map<string, number>()
    for (const row of concreteAllocationRows) {
      const key = normalizeGrade(row.concreteGrade)
      bucket.set(key, round3((bucket.get(key) ?? 0) + Number(row.volumeM3 || 0)))
    }
    return bucket
  }, [concreteAllocationRows])

  async function addLine() {
    setError('')
    setMessage('')
    if (!canEditPlan) {
      setError('Kế hoạch ngày đã chốt hoặc role hiện tại không được sửa.')
      return
    }
    if (!selectedOrderId || !selectedDoanKey) {
      setError('Cần chọn đơn hàng và đoạn sản xuất.')
      return
    }
    setPending(true)
    try {
      await submitAddKeHoachLine({
        planId: detail.plan.plan_id,
        orderId: selectedOrderId,
        doanKey: selectedDoanKey,
        soLuongKeHoach,
        note,
      })
      setMessage('Đã thêm dòng kế hoạch sản xuất.')
      setSelectedDoanKey('')
      setSoLuongKeHoach(0)
      setNote('')
      await reloadPlanDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thêm được dòng kế hoạch.')
    } finally {
      setPending(false)
    }
  }

  async function deleteLine(lineId: string) {
    setError('')
    setMessage('')
    if (!canEditPlan) {
      setError('Kế hoạch ngày đã chốt hoặc role hiện tại không được sửa.')
      return
    }
    setPending(true)
    try {
      await submitDeleteKeHoachLine({
        planId: detail.plan.plan_id,
        lineId,
      })
      setMessage('Đã xóa dòng kế hoạch.')
      await reloadPlanDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được dòng kế hoạch.')
    } finally {
      setPending(false)
    }
  }

  async function saveWarehouseIssue() {
    setError('')
    setMessage('')
    if (!canUseWarehouseFlow || !warehouseIssue) {
      setError('Role hiện tại không được xác nhận thực sản xuất và xuất NVL.')
      return
    }
    if (warehouseIssueLocked) {
      setError('Phiếu thực sản xuất và xuất NVL đã được xác nhận. Muốn chỉnh sửa cần mở lại bằng chức năng riêng.')
      return
    }

    setPending(true)
    try {
      const result = await submitSaveWarehouseIssue({
        planId: detail.plan.plan_id,
        note: issueNote,
        actualItems: warehouseIssue.lineDrafts.map((item) => ({
          lineId: item.lineId,
          soLuongThucTe: Number(actualQtyByLine[item.lineId] || 0),
        })),
        lineDrafts: warehouseIssue.lineDrafts.map((item) => ({
          ...item,
          actualProductionQty: Number(actualQtyByLine[item.lineId] || 0),
        })),
        concreteSummaries,
        materialSummaries: allMaterialSummaries,
      })
      const stockMovement = result.data?.stockMovement
      const stockMovementError = result.data?.stockMovementError
      const generation = result.data?.serialGeneration
      const generationError = result.data?.serialGenerationError
      const messageParts = ['Đã xác nhận thực sản xuất và lưu phiếu xuất NVL theo ngày thao tác.']
      if (stockMovementError) {
        messageParts.push(`Chưa ghi được stock movement NVL: ${stockMovementError}`)
      } else if (stockMovement && stockMovement.createdMovementCount > 0) {
        messageParts.push(
          `Đã ghi ${formatNumber(stockMovement.createdMovementCount)} movement NVL, tổng xuất ${formatNumber(stockMovement.totalIssuedQty)}.`
        )
      }
      if (generationError) {
        messageParts.push(`Chưa sinh được lot/serial: ${generationError}`)
      } else if (generation && generation.generatedSerialCount > 0) {
        messageParts.push(
          `Đã sinh ${formatNumber(generation.generatedLotCount)} lô / ${formatNumber(generation.generatedSerialCount)} serial.`
        )
      }
      setMessage(messageParts.join(' '))
      await reloadPlanDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được phiếu xác nhận thực sản xuất & xuất NVL.')
    } finally {
      setPending(false)
    }
  }

  async function reopenWarehouseIssue() {
    setError('')
    setMessage('')
    if (!adminCanReopenWarehouseIssue) {
      setError('Chỉ Admin mới được mở lại phiếu thực sản xuất và xuất NVL.')
      return
    }

    setPending(true)
    try {
      await submitReopenWarehouseIssue({
        planId: detail.plan.plan_id,
      })
      setMessage('Đã mở lại phiếu thực sản xuất và xuất NVL. Admin có thể chỉnh lại rồi xác nhận lại.')
      await reloadPlanDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không mở lại được phiếu thực sản xuất và xuất NVL.')
    } finally {
      setPending(false)
    }
  }

  const totalColumns = 10 + (canEditPlan ? 1 : 0)

  return (
    <div className="space-y-6">
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

      {!props.embedded ? (
        <section className="app-surface rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
                Sản xuất
              </div>
              <h1 className="mt-4 text-2xl font-bold">Kế hoạch ngày {formatDate(detail.plan.ngay_ke_hoach)}</h1>
              <p className="app-muted mt-2 text-sm">
                Một kế hoạch chỉ gắn với một ngày. Bên dưới là các dòng sản xuất cụ thể theo từng đơn hàng và từng đoạn như Mũi, Thân 1, Thân 2...
              </p>
            </div>
            <Link href="/san-xuat/ke-hoach-ngay" className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
              Về danh sách
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <Info label="Ngày kế hoạch" value={formatDate(detail.plan.ngay_ke_hoach)} />
            <Info label="Trạng thái" value={detail.plan.trang_thai === 'DA_CHOT' ? 'Đã chốt kế hoạch' : 'Nháp'} />
            <Info label="Số dòng" value={formatNumber(detail.lines.length)} />
            <Info
              label="Tổng SL kế hoạch"
              value={formatNumber(detail.lines.reduce((acc, row) => acc + Number(row.so_luong_ke_hoach || 0), 0))}
            />
            <Info label="Ghi chú ngày" value={detail.plan.ghi_chu || '-'} />
          </div>
        </section>
      ) : null}

      {canEditPlan ? (
        <section className="app-surface rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Thêm dòng sản xuất</h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1.1fr_0.8fr_1fr]">
            <Field label="Đơn hàng">
              <select
                value={selectedOrderId}
                onChange={(event) => {
                  setSelectedOrderId(event.target.value)
                  setSelectedDoanKey('')
                  setSoLuongKeHoach(0)
                }}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="">-- chọn đơn hàng --</option>
                {orderOptions.map((row) => (
                  <option key={row.orderId} value={row.orderId}>
                    {row.maOrder} · {row.khachHang} · {row.duAn}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Đoạn">
              <select
                value={selectedDoanKey}
                onChange={(event) => {
                  setSelectedDoanKey(event.target.value)
                  const next = segmentOptions.find((row) => row.doanKey === event.target.value)
                  setSoLuongKeHoach(Math.max(0, Number(next?.soLuongConLaiTam || 0)))
                }}
                disabled={!selectedOrderId}
                className="app-input w-full rounded-xl px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">-- chọn đoạn --</option>
                {segmentOptions.map((row) => (
                  <option key={`${row.orderId}-${row.doanKey}`} value={row.doanKey}>
                    {row.tenDoan} · {formatNumber(row.chieuDaiM)}m
                  </option>
                ))}
              </select>
            </Field>

            <Field label="SL kế hoạch hôm nay">
              <input
                type="number"
                min={0}
                value={soLuongKeHoach || ''}
                onChange={(event) => setSoLuongKeHoach(Number(event.target.value || 0))}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Ghi chú dòng">
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
                placeholder="Nếu cần"
              />
            </Field>
          </div>

          {selectedSegment ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.52fr)_minmax(220px,0.44fr)]">
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)' }}>
                <div className="space-y-4">
                  <SummaryRow label="Khách hàng" value={selectedSegment.khachHang} />
                  <SummaryRow label="Dự án" value={selectedSegment.duAn} />
                  <SummaryRow label="Loại cọc" value={selectedSegment.loaiCoc} />
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)' }}>
                <div className="space-y-4">
                  <SummaryRow label="SL đặt" value={formatNumber(selectedSegment.soLuongDat)} />
                  <SummaryRow label="Đã lên KH" value={formatNumber(selectedSegment.soLuongDaLenKeHoach)} />
                  <SummaryRow label="Đã QC" value={formatNumber(selectedSegment.soLuongDaQc)} />
                </div>
              </div>

              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)' }}>
                <div className="space-y-4">
                  <SummaryRow label="Tồn kho" value={formatNumber(selectedSegment.tonKho)} />
                  <SummaryRow label="SL còn lại" value={formatNumber(selectedSegment.soLuongConLaiTam)} />
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <button
              type="button"
              onClick={() => void addLine()}
              disabled={pending}
              className="app-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? 'Đang thêm...' : 'Thêm dòng sản xuất'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="app-surface rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Các dòng sản xuất trong ngày</h2>
        <p className="app-muted mt-2 text-sm">
          {canUseWarehouseFlow
            ? 'Thủ kho chỉ nhập `Thực SX` theo từng dòng. Phần NVL phía dưới sẽ được tổng hợp chung cho cả ngày.'
            : 'Mỗi dòng là một đoạn cụ thể của một đơn hàng. QLSX chỉ nhìn lớp kế hoạch và không thấy phần xác nhận thực sản xuất / xuất NVL.'}
        </p>

        <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đơn hàng</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Mã bóc tách</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Loại cọc</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đoạn</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Chiều dài</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL đặt</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Đã lên KH</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL còn lại</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Sản xuất</th>
                {canUseWarehouseFlow ? (
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Thực SX</th>
                ) : (
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Ghi chú</th>
                )}
                {canEditPlan ? (
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Xóa</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((row) => (
                <tr key={row.line_id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.ma_order || row.order_id}</div>
                    <div className="text-xs text-[var(--color-muted)]">{row.khach_hang || '-'} · {row.du_an || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.boc_id ? (
                      <Link
                        href={`/boc-tach/boc-tach-nvl/${row.boc_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {row.ma_boc_tach_hien_thi || row.boc_id}
                      </Link>
                    ) : (
                      row.ma_boc_tach_hien_thi || row.boc_id || '-'
                    )}
                  </td>
                  <td className="px-4 py-3">{row.loai_coc || '-'}</td>
                  <td className="px-4 py-3">{row.ten_doan}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.chieu_dai_m)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.so_luong_dat)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.so_luong_da_len_ke_hoach)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.so_luong_con_lai_tam)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatNumber(row.so_luong_ke_hoach)}</td>
                  {canUseWarehouseFlow ? (
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        max={Number(row.so_luong_ke_hoach || 0)}
                        value={actualQtyByLine[row.line_id] ?? String(Number(row.so_luong_da_san_xuat || 0))}
                        disabled={warehouseIssueLocked}
                        onChange={(event) =>
                          setActualQtyByLine((current) => ({
                            ...current,
                            [row.line_id]: event.target.value,
                          }))
                        }
                        className="app-input w-24 rounded-xl px-2 py-1 text-right text-sm"
                      />
                    </td>
                  ) : (
                    <td className="px-4 py-3">{row.ghi_chu || '-'}</td>
                  )}
                  {canEditPlan ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void deleteLine(row.line_id)}
                        disabled={pending}
                        className="text-sm font-semibold text-[var(--color-danger,#dc2626)] underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {detail.lines.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                    Chưa có dòng sản xuất nào trong ngày này.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {adminCanReopenWarehouseIssue ? (
        <section className="app-surface rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)',
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
                color: 'var(--color-primary)',
              }}
            >
              Phiếu thực sản xuất và xuất NVL của ngày này đã được xác nhận. Nếu cần làm lại, Admin mở lại phiếu để Thủ kho nhập lại từ đầu theo dự toán.
            </div>
            <button
              type="button"
              onClick={() => void reopenWarehouseIssue()}
              disabled={pending}
              className="app-outline rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? 'Đang mở lại...' : 'Mở lại phiếu'}
            </button>
          </div>
        </section>
      ) : null}

      {canUseWarehouseFlow ? (
        <section className="app-surface rounded-2xl p-6">
          {detail.generatedLots.length > 0 ? (
            <div className="mb-5 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Lô và serial đã sinh</h3>
                  <p className="app-muted mt-1 text-sm">
                    Từ xác nhận thực sản xuất, hệ thống đã sinh serial cho từng cây. Bước tiếp theo có thể dùng để in tem và dán lên cọc.
                  </p>
                </div>
                <Link
                  href={`/san-xuat/tem-serial?plan_id=${detail.plan.plan_id}`}
                  className="app-outline rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Xem & in tem
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {detail.generatedLots.map((lot) => (
                  <div
                    key={lot.lotId}
                    className="rounded-xl border px-4 py-3"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
                  >
                    <div className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--color-muted)]">Lô</div>
                    <div className="mt-1 font-semibold">{lot.lotCode}</div>
                    <div className="mt-2 text-sm text-[var(--color-muted)]">
                      {lot.loaiCoc} | {lot.tenDoan} | {formatNumber(lot.chieuDaiM)}m
                    </div>
                    <div className="mt-2 text-sm">
                      {formatDateLabel(lot.productionDate)} · {lot.serialCount} serial
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Bê tông thực tế theo ngày</h2>
              <p className="app-muted mt-2 text-sm">
                Nhập nhanh theo 3 cột: `Mác bê tông`, `Cấp phối`, `Khối lượng`.
              </p>
            </div>
            {!warehouseIssueLocked ? (
              <button
                type="button"
                onClick={() =>
                  setConcreteAllocationRows((current) => [
                    ...current,
                    {
                      id: createAllocationRowId(),
                      concreteGrade: concreteGradeOptions[0]?.value || '',
                      variant: concreteRequirements[0]?.variantOptions[0]?.value || 'FULL_TRO_XI_XI',
                      volumeM3: 0,
                    },
                  ])
                }
                className="app-outline rounded-xl px-4 py-2 text-sm font-semibold"
              >
                + Thêm cấp phối
              </button>
            ) : null}
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Mác bê tông</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Cấp phối</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Khối lượng</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {concreteAllocationRows.map((allocationRow) => {
                  const gradeSummary = concreteRequirementMap.get(normalizeGrade(allocationRow.concreteGrade))
                  const variantOptions = gradeSummary?.variantOptions || []
                  return (
                    <tr
                      key={allocationRow.id}
                      className="border-t"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <td className="px-4 py-3">
                        <select
                          value={allocationRow.concreteGrade}
                          onChange={(event) => {
                            const nextGrade = event.target.value
                            const nextSummary = concreteRequirementMap.get(normalizeGrade(nextGrade))
                            setConcreteAllocationRows((current) =>
                              current.map((item) =>
                                item.id === allocationRow.id
                                  ? {
                                      ...item,
                                      concreteGrade: nextGrade,
                                      variant: nextSummary?.variantOptions[0]?.value || 'FULL_TRO_XI_XI',
                                    }
                                  : item
                              )
                            )
                          }}
                          disabled={warehouseIssueLocked}
                          className="app-input w-full min-w-[180px] rounded-xl px-3 py-2 text-sm"
                        >
                          {concreteGradeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={allocationRow.variant}
                          onChange={(event) =>
                            setConcreteAllocationRows((current) =>
                              current.map((item) =>
                                item.id === allocationRow.id ? { ...item, variant: event.target.value } : item
                              )
                            )
                          }
                          disabled={warehouseIssueLocked}
                          className="app-input w-full min-w-[240px] rounded-xl px-3 py-2 text-sm"
                        >
                          {variantOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          value={String(allocationRow.volumeM3 ?? 0)}
                          onChange={(event) =>
                            setConcreteAllocationRows((current) =>
                              current.map((item) =>
                                item.id === allocationRow.id
                                  ? { ...item, volumeM3: Number(event.target.value || 0) }
                                  : item
                              )
                            )
                          }
                          disabled={warehouseIssueLocked}
                          className="app-input w-36 rounded-xl px-3 py-2 text-right text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {!warehouseIssueLocked ? (
                          <button
                            type="button"
                            onClick={() => setConcreteAllocationRows((current) => current.filter((item) => item.id !== allocationRow.id))}
                            className="app-outline rounded-xl px-3 py-2 text-sm font-semibold"
                          >
                            Xóa
                          </button>
                        ) : (
                          <span className="text-sm text-[var(--color-muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {concreteAllocationRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                      Ngày này hiện chưa phát sinh bê tông theo `Thực SX`.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {concreteRequirements.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {concreteRequirements.map((summary) => {
                const gradeKey = normalizeGrade(summary.concreteGrade)
                const allocated = concreteAllocatedByGrade.get(gradeKey) ?? 0
                return (
                  <div
                    key={summary.concreteGrade}
                    className="rounded-xl border px-4 py-3 text-sm"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)',
                    }}
                  >
                    <div className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--color-muted)]">
                      Mác {summary.concreteGrade}
                    </div>
                    <div className="mt-1 font-semibold">
                      {formatNumber(allocated)} / {formatNumber(summary.requiredM3)} m3
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {canUseWarehouseFlow ? (
        <section className="app-surface rounded-2xl p-6">
          <h2 className="text-lg font-semibold">NVL thực xuất tổng hợp cả ngày</h2>
          <p className="app-muted mt-2 text-sm">
            Bảng này cộng gộp toàn bộ NVL thực xuất của cả ngày. Nếu cùng một NVL xuất hiện ở nhiều mác hoặc nhiều cấp phối bê tông khác nhau thì hệ thống sẽ cộng thành một dòng duy nhất.
          </p>
          {warehouseIssueLocked ? (
            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)',
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
                color: 'var(--color-primary)',
              }}
            >
              Phiếu thực sản xuất và xuất NVL của ngày này đã được xác nhận, hiện chỉ còn xem.
            </div>
          ) : null}
          <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Nhóm</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">NVL</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">ĐVT</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL theo dự toán</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL thực xuất</th>
                </tr>
              </thead>
              <tbody>
                {groupedMaterialSummaries.flatMap((group) => [
                  <tr
                    key={`group-${group.nhom}`}
                    className="border-t"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor:
                        group.nhom === 'BETONG'
                          ? 'color-mix(in srgb, var(--color-primary) 6%, white)'
                          : 'color-mix(in srgb, var(--color-background) 45%, white)',
                    }}
                  >
                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase">
                      {group.nhom === 'BETONG'
                        ? 'Cốt liệu bê tông'
                        : group.nhom === 'THEP'
                          ? 'Thép'
                          : group.nhom === 'PHU_KIEN'
                            ? 'Phụ kiện'
                            : 'Phụ gia khác'}
                    </td>
                  </tr>,
                  ...group.items.map((material) => (
                    <tr key={material.key} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-4 py-3">{material.nhom}</td>
                      <td className="px-4 py-3">{material.label}</td>
                      <td className="px-4 py-3">{material.dvt}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatNumber(material.estimateQty)}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          value={materialActuals[material.key] ?? String(material.actualQty)}
                          disabled={warehouseIssueLocked}
                          onChange={(event) => {
                            setMaterialActualTouched((current) => ({
                              ...current,
                              [material.key]: true,
                            }))
                            setMaterialActuals((current) => ({
                              ...current,
                              [material.key]: event.target.value,
                            }))
                          }}
                          className="app-input w-28 rounded-xl px-2 py-1 text-right text-sm"
                        />
                      </td>
                    </tr>
                  )),
                ])}
                {groupedMaterialSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                      Chưa có NVL tổng hợp cho ngày này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {!warehouseIssueLocked ? (
            <div className="mt-5 space-y-4">
              <Field label="Ghi chú xuất NVL">
                <input
                  value={issueNote}
                  onChange={(event) => setIssueNote(event.target.value)}
                  placeholder="Ghi chú nội bộ nếu có chênh lệch hoặc xuất bù"
                  className="app-input w-full rounded-xl px-3 py-2 text-sm"
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveWarehouseIssue()}
                  disabled={pending}
                  className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {pending ? 'Đang lưu...' : 'Xác nhận thực sản xuất & Xuất NVL'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold">{props.label}</span>
      {props.children}
    </label>
  )
}

function Info(props: { label: string; value: string }) {
  return (
    <div className="app-surface rounded-xl p-4">
      <p className="app-muted text-xs">{props.label}</p>
      <p className="mt-1 text-sm font-semibold">{props.value}</p>
    </div>
  )
}

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--color-border)' }}>
      <p className="app-muted text-sm">{props.label}</p>
      <p className="text-right text-base font-normal">{props.value}</p>
    </div>
  )
}

function buildInitialActualQtyState(lines: KeHoachNgayDetail['lines']) {
  return Object.fromEntries(lines.map((row) => [row.line_id, String(Number(row.so_luong_da_san_xuat || 0))]))
}

function buildInitialConcreteAllocationRows(summaries: WarehouseConcreteGradeSummary[]) {
  return summaries.flatMap((summary, summaryIndex) =>
    summary.allocations.map((allocation, allocationIndex) => ({
      id: `${normalizeGrade(summary.concreteGrade)}-${summaryIndex}-${allocationIndex}`,
      concreteGrade: summary.concreteGrade,
      variant: allocation.variant,
      volumeM3: Number(allocation.volumeM3 || 0),
    }))
  )
}

function buildInitialMaterialActualState(materials: WarehouseIssueMaterialSummary[]) {
  return Object.fromEntries(materials.map((material) => [material.key, String(Number(material.actualQty || 0))]))
}

function buildInitialMaterialTouchedState(materials: WarehouseIssueMaterialSummary[], hasSavedVoucher: boolean) {
  return Object.fromEntries(materials.map((material) => [material.key, hasSavedVoucher]))
}

function mergeMaterialSummaries(materials: WarehouseIssueMaterialSummary[]) {
  const bucket = new Map<string, WarehouseIssueMaterialSummary>()

  for (const material of materials) {
    const current = bucket.get(material.key)
    if (current) {
      current.estimateQty = round3(current.estimateQty + Number(material.estimateQty || 0))
      current.actualQty = round3(current.actualQty + Number(material.actualQty || material.estimateQty || 0))
      continue
    }
    bucket.set(material.key, { ...material })
  }

  return Array.from(bucket.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function buildConcreteMaterialsFromSummary(summary: WarehouseConcreteGradeSummary): WarehouseIssueMaterialSummary[] {
  const bucket = new Map<string, WarehouseIssueMaterialSummary>()

  for (const allocation of summary.allocations) {
    const recipe = summary.variantRecipes.find((item) => item.variant === allocation.variant)
    if (!recipe) continue
    for (const material of recipe.materials) {
      const key = `BETONG::${material.key}`
      const estimateQty = round3(material.ratePerM3 * Number(allocation.volumeM3 || 0))
      const current = bucket.get(key)
      if (current) {
        current.estimateQty = round3(current.estimateQty + estimateQty)
        continue
      }
      bucket.set(key, {
        key,
        nhom: 'BETONG',
        label: material.label,
        dvt: material.dvt,
        estimateQty,
        actualQty: estimateQty,
      })
    }
  }

  return Array.from(bucket.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function round3(value: number) {
  const rounded = Math.round(Number(value || 0) * 1000) / 1000
  return Number.isFinite(rounded) ? rounded : 0
}

function formatDateLabel(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeGrade(value: string) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

function createAllocationRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
