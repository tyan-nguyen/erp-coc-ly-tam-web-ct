'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AvailableSegmentOption, KeHoachNgayDetail, KeHoachNgayListItem, KeHoachScheduleSummary } from '@/lib/san-xuat/types'
import { KeHoachNgayDetailClient } from '@/components/san-xuat/ke-hoach-ngay-detail-client'
import { isAdminRole, isSalesAccountingRole, isWarehouseRole } from '@/lib/auth/roles'
import {
  fetchKeHoachNgayDetail,
  fetchKeHoachNgayDraftSegments,
  submitChotKeHoachNgay,
  submitCreateKeHoachNgay,
  submitMoLaiKeHoachNgay,
} from '@/lib/san-xuat/client-api'

type DraftPlanLine = {
  id: string
  orderId: string
  doanKey: string
  maOrder: string
  khachHang: string
  duAn: string
  loaiCoc: string
  tenDoan: string
  chieuDaiM: number
  soLuongDat: number
  soLuongDaLenKeHoach: number
  soLuongDaQc: number
  tonKho: number
  soLuongConLaiTam: number
  soLuongKeHoach: number
  note: string
}

const PLAN_DETAIL_CACHE_LIMIT = 20

const DraftCreateSection = dynamic(async () => ({ default: DraftCreateSectionInner }), {
  ssr: false,
})

export function KeHoachNgayListClient(props: {
  rows: KeHoachNgayListItem[]
  selectedPlanId?: string | null
  selectedPlanDetail?: KeHoachNgayDetail | null
  scheduleSummary?: KeHoachScheduleSummary
  draftSegments?: AvailableSegmentOption[]
  viewerRole: string
}) {
  const router = useRouter()
  const warehouseViewer = isWarehouseRole(props.viewerRole)
  const adminViewer = isAdminRole(props.viewerRole)
  const salesAccountingViewer = isSalesAccountingRole(props.viewerRole)
  const canApprovePlans = salesAccountingViewer || adminViewer
  const detailCacheRef = useRef<Map<string, KeHoachNgayDetail>>(new Map())
  const [rowsState, setRowsState] = useState(props.rows)
  const [selectedPlanIdState, setSelectedPlanIdState] = useState(props.selectedPlanId || null)
  const [selectedPlanDetailState, setSelectedPlanDetailState] = useState(props.selectedPlanDetail || null)
  const [scheduleSummaryState, setScheduleSummaryState] = useState(props.scheduleSummary)
  const [draftSegmentsState, setDraftSegmentsState] = useState(props.draftSegments || [])
  const safeScheduleSummary =
    scheduleSummaryState ||
    ({
      fromDate: '',
      toDate: '',
      dates: [],
      rows: [],
      totalQtyByDate: [],
      totalMdByDate: [],
    } satisfies KeHoachScheduleSummary)
  const [ngayKeHoach, setNgayKeHoach] = useState(safeScheduleSummary.fromDate)
  const [planNote, setPlanNote] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [selectedDoanKey, setSelectedDoanKey] = useState('')
  const [draftQty, setDraftQty] = useState<number>(0)
  const [draftLineNote, setDraftLineNote] = useState('')
  const [draftLines, setDraftLines] = useState<DraftPlanLine[]>([])
  const [draftSegmentsFallback, setDraftSegmentsFallback] = useState<AvailableSegmentOption[]>([])
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState(safeScheduleSummary.fromDate)
  const [toDate, setToDate] = useState(safeScheduleSummary.toDate)
  const [createSectionCollapsed, setCreateSectionCollapsed] = useState(false)
  const [scheduleListCollapsed, setScheduleListCollapsed] = useState(false)
  const [planListCollapsed, setPlanListCollapsed] = useState(false)
  const [planPage, setPlanPage] = useState(1)
  const [planPageInput, setPlanPageInput] = useState('1')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setRowsState(props.rows)
  }, [props.rows])

  useEffect(() => {
    setSelectedPlanIdState(props.selectedPlanId || null)
  }, [props.selectedPlanId])

  useEffect(() => {
    setSelectedPlanDetailState(props.selectedPlanDetail || null)
    if (props.selectedPlanDetail?.plan.plan_id) {
      cachePlanDetail(props.selectedPlanDetail)
    }
  }, [props.selectedPlanDetail])

  useEffect(() => {
    setScheduleSummaryState(props.scheduleSummary)
  }, [props.scheduleSummary])

  useEffect(() => {
    setDraftSegmentsState(props.draftSegments || [])
  }, [props.draftSegments])

  const filteredRows = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    if (!q) return rowsState
    return rowsState.filter((row) =>
      [row.plan.ngay_ke_hoach, row.plan.trang_thai, row.plan.ghi_chu]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [rowsState, query])

  const effectiveDraftSegments = useMemo(
    () =>
      draftSegmentsFallback.length > 0
        ? draftSegmentsFallback
        : draftSegmentsState && draftSegmentsState.length > 0
          ? draftSegmentsState
          : selectedPlanDetailState?.availableSegments || [],
    [draftSegmentsFallback, draftSegmentsState, selectedPlanDetailState]
  )

  const draftOrderOptions = useMemo(() => {
    const map = new Map<string, AvailableSegmentOption>()
    for (const row of effectiveDraftSegments) {
      if (!map.has(row.orderId)) map.set(row.orderId, row)
    }
    return Array.from(map.values())
  }, [effectiveDraftSegments])

  const draftAllocatedBySegment = useMemo(() => {
    const bucket = new Map<string, number>()
    for (const row of draftLines) {
      const key = `${row.orderId}::${row.doanKey}`
      bucket.set(key, (bucket.get(key) ?? 0) + row.soLuongKeHoach)
    }
    return bucket
  }, [draftLines])

  const draftSegmentOptions = useMemo(
    () => effectiveDraftSegments.filter((row) => row.orderId === selectedOrderId),
    [effectiveDraftSegments, selectedOrderId]
  )

  const selectedDraftSegment = useMemo(
    () => draftSegmentOptions.find((row) => row.doanKey === selectedDoanKey) || null,
    [draftSegmentOptions, selectedDoanKey]
  )

  const selectedDraftSegmentRemaining = useMemo(() => {
    if (!selectedDraftSegment) return 0
    const reservedQty = draftAllocatedBySegment.get(`${selectedDraftSegment.orderId}::${selectedDraftSegment.doanKey}`) ?? 0
    return Math.max(Number(selectedDraftSegment.soLuongConLaiTam || 0) - reservedQty, 0)
  }, [draftAllocatedBySegment, selectedDraftSegment])

  const totalPlanPages = Math.max(1, Math.ceil(filteredRows.length / 10))
  const safePlanPage = Math.min(planPage, totalPlanPages)
  const pagedRows = filteredRows.slice((safePlanPage - 1) * 10, safePlanPage * 10)

  useEffect(() => {
    setPlanPage((current) => Math.min(current, totalPlanPages))
  }, [totalPlanPages])

  useEffect(() => {
    setPlanPageInput(String(safePlanPage))
  }, [safePlanPage])

  useEffect(() => {
    if (warehouseViewer || salesAccountingViewer) return
    if (draftSegmentsState.length > 0) return
    if (draftSegmentsFallback.length > 0) return

    let cancelled = false
    void fetchKeHoachNgayDraftSegments()
      .then((result) => {
        if (cancelled || !result.data) return
        setDraftSegmentsFallback(result.data)
      })
      .catch(() => {
        if (cancelled) return
        setDraftSegmentsFallback([])
      })

    return () => {
      cancelled = true
    }
  }, [draftSegmentsFallback.length, draftSegmentsState.length, salesAccountingViewer, warehouseViewer])

  function replaceCurrentPlanInUrl(planId: string | null) {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (planId) {
      params.set('plan_id', planId)
    } else {
      params.delete('plan_id')
    }
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    const queryString = params.toString()
    window.history.replaceState(null, '', queryString ? `/san-xuat/ke-hoach-ngay?${queryString}` : '/san-xuat/ke-hoach-ngay')
  }

  function buildListItemFromDetail(detail: KeHoachNgayDetail): KeHoachNgayListItem {
    const orderIds = new Set(detail.lines.map((line) => line.order_id).filter(Boolean))
    const totalPlannedQty = detail.lines.reduce((sum, line) => sum + Number(line.so_luong_ke_hoach || 0), 0)
    return {
      plan: detail.plan,
      lineCount: detail.lines.length,
      orderCount: orderIds.size,
      totalPlannedQty,
    }
  }

  function cachePlanDetail(detail: KeHoachNgayDetail) {
    const cache = detailCacheRef.current
    const planId = detail.plan.plan_id
    if (cache.has(planId)) {
      cache.delete(planId)
    }
    cache.set(planId, detail)
    while (cache.size > PLAN_DETAIL_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value
      if (!oldestKey) break
      cache.delete(oldestKey)
    }
  }

  function upsertPlanRow(detail: KeHoachNgayDetail) {
    const nextItem = buildListItemFromDetail(detail)
    cachePlanDetail(detail)
    setRowsState((current) => {
      const withoutCurrent = current.filter((row) => row.plan.plan_id !== detail.plan.plan_id)
      return [nextItem, ...withoutCurrent].sort((a, b) => String(b.plan.ngay_ke_hoach).localeCompare(String(a.plan.ngay_ke_hoach)))
    })
  }

  function applyDraftLinesToScheduleSummary(lines: DraftPlanLine[], ngay: string) {
    if (!safeScheduleSummary.dates.includes(ngay) || lines.length === 0) return
    const targetIndex = safeScheduleSummary.dates.indexOf(ngay)
    if (targetIndex < 0) return

    setScheduleSummaryState((current) => {
      const base =
        current ||
        ({
          fromDate,
          toDate,
          dates: [],
          rows: [],
          totalQtyByDate: [],
          totalMdByDate: [],
        } satisfies KeHoachScheduleSummary)
      if (!base.dates.includes(ngay)) return base

      const rowMap = new Map(base.rows.map((row) => [row.rowKey, row]))
      const totalQtyByDate = [...base.totalQtyByDate]
      const totalMdByDate = [...base.totalMdByDate]

      for (const line of lines) {
        const rowKey = `${line.khachHang}::${line.duAn}::${line.loaiCoc}::${line.tenDoan}::${line.chieuDaiM}`
        const existingRow = rowMap.get(rowKey)
        const nextCells = existingRow
          ? existingRow.cells.map((cell) => ({ ...cell }))
          : base.dates.map((date) => ({ ngay: date, qty: 0, md: 0 }))
        nextCells[targetIndex].qty += line.soLuongKeHoach
        nextCells[targetIndex].md += line.soLuongKeHoach * line.chieuDaiM
        rowMap.set(rowKey, {
          rowKey,
          khachHang: line.khachHang,
          duAn: line.duAn,
          loaiCoc: line.loaiCoc,
          tenDoan: line.tenDoan,
          chieuDaiM: line.chieuDaiM,
          cells: nextCells,
        })
        totalQtyByDate[targetIndex] = (totalQtyByDate[targetIndex] ?? 0) + line.soLuongKeHoach
        totalMdByDate[targetIndex] = (totalMdByDate[targetIndex] ?? 0) + line.soLuongKeHoach * line.chieuDaiM
      }

      return {
        ...base,
        rows: Array.from(rowMap.values()),
        totalQtyByDate,
        totalMdByDate,
      }
    })
  }

  async function createPlan() {
    setError('')
    setMessage('')
    if (draftLines.length === 0) {
      setError('Cần thêm ít nhất 1 dòng sản xuất trước khi tạo kế hoạch ngày.')
      return
    }
    setPending(true)
    try {
      const result = await submitCreateKeHoachNgay({
        ngayKeHoach,
        note: planNote,
        lines: draftLines.map((line) => ({
          orderId: line.orderId,
          doanKey: line.doanKey,
          soLuongKeHoach: line.soLuongKeHoach,
          note: line.note,
        })),
      })
      if (!result.data) {
        throw new Error('Không tạo được kế hoạch ngày.')
      }
      if (result.data.existed) {
        setMessage('Ngày này đã có kế hoạch. Mình đã cộng các dòng mới vào đúng kế hoạch của ngày đó.')
      }
      const createdLines = [...draftLines]
      applyDraftLinesToScheduleSummary(createdLines, ngayKeHoach)
      const [refreshedDetail, refreshedDraftSegments] = await Promise.all([
        fetchKeHoachNgayDetail(result.data.planId).catch(() => null),
        fetchKeHoachNgayDraftSegments().catch(() => null),
      ])
      if (refreshedDetail?.data) {
        setSelectedPlanDetailState(refreshedDetail.data)
        setSelectedPlanIdState(refreshedDetail.data.plan.plan_id)
        upsertPlanRow(refreshedDetail.data)
        replaceCurrentPlanInUrl(refreshedDetail.data.plan.plan_id)
      }
      if (refreshedDraftSegments?.data) {
        setDraftSegmentsState(refreshedDraftSegments.data)
        setDraftSegmentsFallback(refreshedDraftSegments.data)
      }
      setDraftLines([])
      setSelectedOrderId('')
      setSelectedDoanKey('')
      setDraftQty(0)
      setDraftLineNote('')
      setPlanNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được kế hoạch ngày.')
    } finally {
      setPending(false)
    }
  }

  function addDraftLine() {
    setError('')
    setMessage('')
    if (!selectedDraftSegment) {
      setError('Cần chọn đơn hàng và đoạn.')
      return
    }
    if (draftQty <= 0) {
      setError('SL kế hoạch hôm nay phải lớn hơn 0.')
      return
    }
    if (draftQty > selectedDraftSegmentRemaining) {
      setError('SL kế hoạch vượt quá số còn lại của đoạn này.')
      return
    }

    const segmentKey = `${selectedDraftSegment.orderId}::${selectedDraftSegment.doanKey}`
    setDraftLines((current) => {
      const existingIndex = current.findIndex((line) => `${line.orderId}::${line.doanKey}` === segmentKey)
      if (existingIndex === -1) {
        return [
          ...current,
          {
            id: `${segmentKey}::${Date.now()}`,
            orderId: selectedDraftSegment.orderId,
            doanKey: selectedDraftSegment.doanKey,
            maOrder: selectedDraftSegment.maOrder,
            khachHang: selectedDraftSegment.khachHang,
            duAn: selectedDraftSegment.duAn,
            loaiCoc: selectedDraftSegment.loaiCoc,
            tenDoan: selectedDraftSegment.tenDoan,
            chieuDaiM: Number(selectedDraftSegment.chieuDaiM || 0),
            soLuongDat: Number(selectedDraftSegment.soLuongDat || 0),
            soLuongDaLenKeHoach: Number(selectedDraftSegment.soLuongDaLenKeHoach || 0),
            soLuongDaQc: Number(selectedDraftSegment.soLuongDaQc || 0),
            tonKho: Number(selectedDraftSegment.tonKho || 0),
            soLuongConLaiTam: Number(selectedDraftSegment.soLuongConLaiTam || 0),
            soLuongKeHoach: draftQty,
            note: draftLineNote.trim(),
          },
        ]
      }

      return current.map((line, index) =>
        index === existingIndex
          ? {
              ...line,
              soLuongKeHoach: line.soLuongKeHoach + draftQty,
              note: draftLineNote.trim() || line.note,
            }
          : line
      )
    })

    setSelectedDoanKey('')
    setDraftQty(0)
    setDraftLineNote('')
  }

  function removeDraftLine(lineId: string) {
    setDraftLines((current) => current.filter((line) => line.id !== lineId))
  }

  function applyDateFilter() {
    const params = new URLSearchParams()
    if (selectedPlanIdState) params.set('plan_id', selectedPlanIdState)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    router.push(`/san-xuat/ke-hoach-ngay?${params.toString()}`)
  }

  async function togglePlan(planId: string) {
    if (selectedPlanIdState === planId) {
      setSelectedPlanIdState(null)
      setSelectedPlanDetailState(null)
      replaceCurrentPlanInUrl(null)
      return
    }

    const cachedDetail = detailCacheRef.current.get(planId)
    if (cachedDetail) {
      setSelectedPlanIdState(planId)
      setSelectedPlanDetailState(cachedDetail)
      replaceCurrentPlanInUrl(planId)
      return
    }

    setError('')
    try {
      const result = await fetchKeHoachNgayDetail(planId)
      if (!result.data) {
        throw new Error('Không tải được chi tiết kế hoạch ngày.')
      }
      cachePlanDetail(result.data)
      setSelectedPlanIdState(planId)
      setSelectedPlanDetailState(result.data)
      replaceCurrentPlanInUrl(planId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết kế hoạch ngày.')
    }
  }

  async function chotPlan() {
    if (!selectedPlanDetailState) return
    setError('')
    setMessage('')
    setPending(true)
    try {
      await submitChotKeHoachNgay({
        planId: selectedPlanDetailState.plan.plan_id,
      })
      setSelectedPlanDetailState((current) =>
        current
          ? {
              ...current,
              plan: {
                ...current.plan,
                trang_thai: 'DA_CHOT',
              },
            }
          : current
      )
      setRowsState((current) =>
        current.map((row) =>
          row.plan.plan_id === selectedPlanDetailState.plan.plan_id
            ? {
                ...row,
                plan: {
                  ...row.plan,
                  trang_thai: 'DA_CHOT',
                },
              }
            : row
        )
      )
      setMessage('Đã chốt kế hoạch ngày. Thủ kho có thể nhìn thấy kế hoạch này để làm bước tiếp theo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không chốt được kế hoạch ngày.')
    } finally {
      setPending(false)
    }
  }

  async function moLaiPlan() {
    if (!selectedPlanDetailState) return
    setError('')
    setMessage('')
    setPending(true)
    try {
      await submitMoLaiKeHoachNgay({
        planId: selectedPlanDetailState.plan.plan_id,
      })
      setSelectedPlanDetailState((current) =>
        current
          ? {
              ...current,
              plan: {
                ...current.plan,
                trang_thai: 'NHAP',
              },
            }
          : current
      )
      setRowsState((current) =>
        current.map((row) =>
          row.plan.plan_id === selectedPlanDetailState.plan.plan_id
            ? {
                ...row,
                plan: {
                  ...row.plan,
                  trang_thai: 'NHAP',
                },
              }
            : row
        )
      )
      setMessage('Đã mở chốt kế hoạch ngày. QLSX có thể chỉnh sửa lại các dòng kế hoạch.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không mở chốt được kế hoạch ngày.')
    } finally {
      setPending(false)
    }
  }

  const approvalReviewRows = useMemo(() => {
    if (!selectedPlanDetailState) return []
    const segmentSummaryByKey = new Map(
      selectedPlanDetailState.availableSegments.map((segment) => [
        `${segment.orderId}::${segment.doanKey}`,
        segment,
      ])
    )
    return selectedPlanDetailState.lines.map((line) => {
      const segmentSummary = segmentSummaryByKey.get(`${line.order_id}::${line.doan_key}`)
      const currentPlanQty = Number(line.so_luong_ke_hoach || 0)
      const plannedQty = Number(segmentSummary?.soLuongDaLenKeHoach ?? line.so_luong_da_len_ke_hoach ?? 0)
      const varianceVsOrder = plannedQty - Number(line.so_luong_dat || 0)
      return {
        lineId: line.line_id,
        maOrder: line.ma_order || '-',
        khachHang: line.khach_hang || '',
        duAn: line.du_an || '',
        tenDoan: line.ten_doan || line.doan_key || '-',
        orderedQty: Number(line.so_luong_dat || 0),
        plannedQty,
        qcQty: Number(segmentSummary?.soLuongDaQc ?? 0),
        stockQty: Number(segmentSummary?.tonKho ?? 0),
        remainingQty: Number(segmentSummary?.soLuongConLaiTam ?? line.so_luong_con_lai_tam ?? 0),
        currentPlanQty,
        varianceVsOrder,
      }
    })
  }, [selectedPlanDetailState])

  const hasOverrun = approvalReviewRows.some((row) => row.varianceVsOrder > 0.0001)
  const warehouseLockedPlan = Boolean(selectedPlanDetailState?.warehouseIssue?.locked)

  return (
    <div className="space-y-6">
      {message ? (
        <section className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)', color: 'var(--color-primary)' }}>
          {message}
        </section>
      ) : null}
      {error ? <section className="app-accent-soft rounded-2xl px-4 py-3 text-sm">{error}</section> : null}

      <div className="app-surface overflow-hidden rounded-[28px]">
      {!warehouseViewer && !salesAccountingViewer ? (
        <DraftCreateSection
          pending={pending}
          draftLines={draftLines}
          ngayKeHoach={ngayKeHoach}
          planNote={planNote}
          selectedOrderId={selectedOrderId}
          selectedDoanKey={selectedDoanKey}
          draftQty={draftQty}
          draftLineNote={draftLineNote}
          draftOrderOptions={draftOrderOptions}
          draftSegmentOptions={draftSegmentOptions}
          selectedDraftSegment={selectedDraftSegment}
          selectedDraftSegmentRemaining={selectedDraftSegmentRemaining}
          collapsed={createSectionCollapsed}
          onToggleCollapsed={() => setCreateSectionCollapsed((current) => !current)}
          onCreatePlan={() => void createPlan()}
          onNgayKeHoachChange={setNgayKeHoach}
          onPlanNoteChange={setPlanNote}
          onOrderChange={(orderId) => {
            setSelectedOrderId(orderId)
            setSelectedDoanKey('')
            setDraftQty(0)
          }}
          onDoanChange={(doanKey) => {
            setSelectedDoanKey(doanKey)
            const next = draftSegmentOptions.find((row) => row.doanKey === doanKey)
            if (!next) {
              setDraftQty(0)
              return
            }
            const reservedQty = draftAllocatedBySegment.get(`${next.orderId}::${next.doanKey}`) ?? 0
            setDraftQty(Math.max(Number(next.soLuongConLaiTam || 0) - reservedQty, 0))
          }}
          onDraftQtyChange={setDraftQty}
          onDraftLineNoteChange={setDraftLineNote}
          onAddDraftLine={addDraftLine}
          onRemoveDraftLine={removeDraftLine}
        />
      ) : null}

      <section className="border-t px-6 py-6 first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Thời khóa biểu kế hoạch sản xuất</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[180px_180px_auto_auto]">
            <Field label="Từ ngày">
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Đến ngày">
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                onClick={applyDateFilter}
                className="app-outline w-full rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Áp dụng bộ lọc
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setScheduleListCollapsed((current) => !current)}
                className="w-full px-2 py-2 text-[var(--color-primary)]"
                aria-label={scheduleListCollapsed ? 'Mở rộng danh sách thời khóa biểu' : 'Thu hẹp danh sách thời khóa biểu'}
              >
                <span
                  style={{
                    display: 'inline-block',
                    transform: scheduleListCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                    transition: 'transform 180ms ease',
                    lineHeight: 1,
                  }}
                >
                  v
                </span>
              </button>
            </div>
          </div>
        </div>

        {!scheduleListCollapsed ? (
        <div className="mt-5 max-h-[520px] overflow-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Dự án</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Khách hàng</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Loại cọc</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đoạn</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Chiều dài</th>
                {safeScheduleSummary.dates.map((date) => (
                  <th key={date} className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">
                    {formatShortDate(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeScheduleSummary.rows.map((row) => (
                <tr key={row.rowKey} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 font-semibold">{row.duAn}</td>
                  <td className="px-4 py-3">{row.khachHang}</td>
                  <td className="px-4 py-3">{row.loaiCoc}</td>
                  <td className="px-4 py-3">{row.tenDoan}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.chieuDaiM)}</td>
                  {row.cells.map((cell) => (
                    <td key={cell.ngay} className="px-4 py-3 text-right">
                      {cell.qty > 0 ? formatNumber(cell.qty) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
              {safeScheduleSummary.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + safeScheduleSummary.dates.length}
                    className="px-4 py-8 text-center text-sm text-[var(--color-muted)]"
                  >
                    Chưa có dữ liệu kế hoạch trong khoảng ngày đã chọn.
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              {safeScheduleSummary.dates.length > 0 ? (
                <>
                  <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td colSpan={5} className="px-4 py-3 font-semibold">
                      Tổng số đoạn
                    </td>
                    {safeScheduleSummary.totalQtyByDate.map((value, index) => (
                      <td key={`qty-${safeScheduleSummary.dates[index]}`} className="px-4 py-3 text-right font-semibold">
                        {value > 0 ? formatNumber(value) : '-'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td colSpan={5} className="px-4 py-3 font-semibold">
                      Tổng số md
                    </td>
                    {safeScheduleSummary.totalMdByDate.map((value, index) => (
                      <td key={`md-${safeScheduleSummary.dates[index]}`} className="px-4 py-3 text-right font-semibold">
                        {value > 0 ? formatNumber(value) : '-'}
                      </td>
                    ))}
                  </tr>
                </>
              ) : null}
            </tfoot>
          </table>
        </div>
        ) : null}
      </section>

      <section className="border-t px-6 py-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Danh sách kế hoạch sản xuất ngày</h2>
            <p className="app-muted mt-2 text-sm">{filteredRows.length} kế hoạch</p>
          </div>
          <div className="flex w-full max-w-2xl flex-wrap justify-end gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo ngày, trạng thái, ghi chú..."
              className="app-input w-full max-w-md rounded-xl px-4 py-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setPlanListCollapsed((current) => !current)}
              className="px-2 py-3 text-[var(--color-primary)]"
              aria-label={planListCollapsed ? 'Mở rộng danh sách kế hoạch' : 'Thu hẹp danh sách kế hoạch'}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: planListCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                  transition: 'transform 180ms ease',
                  lineHeight: 1,
                }}
              >
                v
              </span>
            </button>
          </div>
        </div>

        {!planListCollapsed ? (
        <div className="mt-5 max-h-[520px] overflow-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Ngày</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Số đơn</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Số dòng</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL kế hoạch</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr
                  key={row.plan.plan_id}
                  onClick={() => void togglePlan(row.plan.plan_id)}
                  className="cursor-pointer border-t transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_4%,white)]"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor:
                      selectedPlanIdState === row.plan.plan_id
                        ? 'color-mix(in srgb, var(--color-primary) 7%, white)'
                        : undefined,
                  }}
                >
                  <td className="px-4 py-3 font-semibold">{formatDate(row.plan.ngay_ke_hoach)}</td>
                  <td className="px-4 py-3">{row.plan.trang_thai === 'DA_CHOT' ? 'Đã chốt kế hoạch' : 'Nháp'}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.orderCount)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.lineCount)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.totalPlannedQty)}</td>
                  <td className="px-4 py-3">{row.plan.ghi_chu || '-'}</td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                    Chưa có kế hoạch sản xuất ngày nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        ) : null}

        {!planListCollapsed && totalPlanPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setPlanPage((current) => Math.max(current - 1, 1))}
              disabled={safePlanPage <= 1}
              className="app-outline rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Trang trước
            </button>
            <button
              type="button"
              onClick={() => setPlanPage((current) => Math.min(current + 1, totalPlanPages))}
              disabled={safePlanPage >= totalPlanPages}
              className="app-outline rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Trang sau
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--color-muted)]">Đi tới trang</span>
              <input
                type="number"
                min={1}
                max={totalPlanPages}
                value={planPageInput}
                onChange={(event) => setPlanPageInput(event.target.value)}
                onBlur={() => {
                  const nextPage = Math.min(Math.max(Number(planPageInput || safePlanPage), 1), totalPlanPages)
                  setPlanPage(nextPage)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const nextPage = Math.min(Math.max(Number(planPageInput || safePlanPage), 1), totalPlanPages)
                    setPlanPage(nextPage)
                  }
                }}
                className="app-input w-20 rounded-xl px-3 py-2 text-center text-sm"
              />
            </div>
          </div>
        ) : null}
      </section>
      </div>

      {selectedPlanDetailState ? (
        <section className="space-y-4">
          {canApprovePlans ? (
            <section className="app-surface rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Review trước khi chốt kế hoạch</h3>
                  <p className="app-muted mt-2 text-sm">KTBH/Admin dùng bảng này để so số khách đặt, tiến độ nội bộ và số còn lại trước khi chốt.</p>
                </div>
                <div className="text-sm">
                  <div>
                    <span className="app-muted">Trạng thái hiện tại:</span>{' '}
                    <span className="font-semibold">
                      {selectedPlanDetailState.plan.trang_thai === 'DA_CHOT' ? 'Đã chốt kế hoạch' : 'Nháp'}
                    </span>
                  </div>
                  {warehouseLockedPlan ? (
                    <div className="mt-2 app-accent-soft rounded-xl px-3 py-2 text-xs">
                      Kế hoạch này đã được Thủ kho xác nhận thực sản xuất & xuất NVL, nên không được mở chốt để chỉnh sửa nữa.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                      <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đơn hàng</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đoạn</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Khách đặt</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Đã lên KH</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Đã QC</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Tồn kho</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL còn lại</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">KH lần này</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalReviewRows.map((row) => (
                      <tr key={row.lineId} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="font-semibold">{row.maOrder}</div>
                            {row.khachHang ? <div className="app-muted text-xs">{row.khachHang}</div> : null}
                            {row.duAn ? <div className="app-muted text-xs">{row.duAn}</div> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">{row.tenDoan}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.orderedQty)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.plannedQty)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.qcQty)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.stockQty)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.remainingQty)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.currentPlanQty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasOverrun ? (
                <div className="mt-4 app-accent-soft rounded-2xl px-4 py-3 text-sm">
                  Kế hoạch hiện đang vượt số lượng đơn hàng ở ít nhất một dòng. Hệ thống sẽ không cho chốt cho tới khi QLSX chỉnh lại số lượng.
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap justify-end gap-3">
                {selectedPlanDetailState.plan.trang_thai !== 'DA_CHOT' ? (
                  <button
                    type="button"
                    onClick={() => void chotPlan()}
                    disabled={pending || hasOverrun}
                    className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {pending ? 'Đang chốt...' : 'Chốt kế hoạch ngày'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void moLaiPlan()}
                    disabled={pending || warehouseLockedPlan}
                    className="app-outline rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {pending ? 'Đang mở chốt...' : 'Mở chốt kế hoạch'}
                  </button>
                )}
              </div>
            </section>
          ) : null}
          {!salesAccountingViewer ? (
            <KeHoachNgayDetailClient detail={selectedPlanDetailState} embedded viewerRole={props.viewerRole} />
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

function DraftCreateSectionInner(props: {
  pending: boolean
  draftLines: DraftPlanLine[]
  ngayKeHoach: string
  planNote: string
  selectedOrderId: string
  selectedDoanKey: string
  draftQty: number
  draftLineNote: string
  draftOrderOptions: AvailableSegmentOption[]
  draftSegmentOptions: AvailableSegmentOption[]
  selectedDraftSegment: AvailableSegmentOption | null
  selectedDraftSegmentRemaining: number
  collapsed: boolean
  onToggleCollapsed: () => void
  onCreatePlan: () => void
  onNgayKeHoachChange: (value: string) => void
  onPlanNoteChange: (value: string) => void
  onOrderChange: (value: string) => void
  onDoanChange: (value: string) => void
  onDraftQtyChange: (value: number) => void
  onDraftLineNoteChange: (value: string) => void
  onAddDraftLine: () => void
  onRemoveDraftLine: (lineId: string) => void
}) {
  return (
    <>
      <section className="px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[220px] flex-1">
            <h2 className="text-lg font-semibold">Tạo kế hoạch ngày</h2>
          </div>
          <button
            type="button"
            onClick={props.onToggleCollapsed}
            className="px-2 py-1 text-[var(--color-primary)]"
            aria-label={props.collapsed ? 'Mở rộng phần tạo kế hoạch ngày' : 'Thu gọn phần tạo kế hoạch ngày'}
          >
            <span
              style={{
                display: 'inline-block',
                transform: props.collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 180ms ease',
                lineHeight: 1,
              }}
            >
              v
            </span>
          </button>
        </div>

        {!props.collapsed ? (
        <>
        <div className="pt-4">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <Field label="Ngày kế hoạch">
              <input
                type="date"
                value={props.ngayKeHoach}
                onChange={(event) => props.onNgayKeHoachChange(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Ghi chú ngày">
              <input
                value={props.planNote}
                onChange={(event) => props.onPlanNoteChange(event.target.value)}
                placeholder="Ví dụ: ưu tiên đơn gấp / khuôn đặc biệt..."
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </div>

        <div className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1.1fr_0.8fr_auto]">
            <Field label="Đơn hàng">
              <select
                value={props.selectedOrderId}
                onChange={(event) => props.onOrderChange(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="">-- chọn đơn hàng --</option>
                {props.draftOrderOptions.map((row) => (
                  <option key={row.orderId} value={row.orderId}>
                    {row.maOrder} · {row.khachHang} · {row.duAn}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Đoạn">
              <select
                value={props.selectedDoanKey}
                onChange={(event) => props.onDoanChange(event.target.value)}
                disabled={!props.selectedOrderId}
                className="app-input w-full rounded-xl px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">-- chọn đoạn --</option>
                {props.draftSegmentOptions.map((row) => (
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
                value={props.draftQty || ''}
                onChange={(event) => props.onDraftQtyChange(Number(event.target.value || 0))}
                className="app-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                onClick={props.onAddDraftLine}
                className="inline-flex h-11 items-center justify-center px-1 text-sm font-semibold text-[var(--color-primary)]"
                aria-label="Thêm dòng sản xuất"
              >
                +
              </button>
            </div>
          </div>

          {props.selectedDraftSegment ? (
            <div className="mt-5 border-y py-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-4">
                  <SummaryRow label="Khách hàng" value={props.selectedDraftSegment.khachHang} />
                  <SummaryRow label="Dự án" value={props.selectedDraftSegment.duAn} />
                  <SummaryRow label="Loại cọc" value={props.selectedDraftSegment.loaiCoc} />
                </div>

                <div className="space-y-4">
                  <SummaryRow label="SL đặt" value={formatNumber(props.selectedDraftSegment.soLuongDat)} />
                  <SummaryRow label="Đã lên KH" value={formatNumber(props.selectedDraftSegment.soLuongDaLenKeHoach)} />
                  <SummaryRow label="Đã QC" value={formatNumber(props.selectedDraftSegment.soLuongDaQc)} />
                </div>

                <div className="space-y-4">
                  <SummaryRow label="Tồn kho" value={formatNumber(props.selectedDraftSegment.tonKho)} />
                  <SummaryRow label="SL còn lại" value={formatNumber(props.selectedDraftSegmentRemaining)} />
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đơn hàng</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đoạn</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Loại cọc</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL đặt</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Đã lên KH</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Đã QC</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Tồn kho</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL còn lại</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">KH lần này</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Ghi chú</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {props.draftLines.map((line) => (
                  <tr key={line.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="font-semibold">{line.maOrder}</div>
                        <div className="app-muted text-xs">{line.khachHang}</div>
                        <div className="app-muted text-xs">{line.duAn}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{line.tenDoan}</td>
                    <td className="px-4 py-3">{line.loaiCoc}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(line.soLuongDat)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(line.soLuongDaLenKeHoach)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(line.soLuongDaQc)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(line.tonKho)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(line.soLuongConLaiTam)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(line.soLuongKeHoach)}</td>
                    <td className="px-4 py-3">{line.note || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => props.onRemoveDraftLine(line.id)}
                        className="text-sm font-semibold text-[var(--color-danger,#dc2626)] underline-offset-2 hover:underline"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
                {props.draftLines.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                      Chưa có dòng sản xuất nào trong kế hoạch nháp này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={props.onCreatePlan}
              disabled={props.pending || props.draftLines.length === 0}
              className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {props.pending ? 'Đang tạo...' : 'Tạo kế hoạch ngày'}
            </button>
          </div>
        </div>
        </>
        ) : null}
      </section>
    </>
  )
}

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--color-border)' }}>
      <span className="text-sm text-[var(--color-muted)]">{props.label}</span>
      <span className="text-base">{props.value}</span>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}
