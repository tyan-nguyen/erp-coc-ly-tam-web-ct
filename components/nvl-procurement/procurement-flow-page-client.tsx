'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  NvlDemandDecisionRow,
  NvlProcurementFlowPageData,
  NvlProposalRow,
} from '@/lib/nvl-procurement/types'
import {
  fetchReceiptDetail,
  submitCreatePurchaseOrderDraft,
  submitCreatePurchaseRequestDraft,
  submitCreateReceiptDraft,
  submitConfirmReceiptMovement,
  submitFinishPurchaseOrder,
  submitFinalizeReceipt,
  submitFinalizePurchaseOrder,
  submitSaveReceiptDraft,
} from '@/lib/nvl-procurement/client-api'

type EditableProposalRow = NvlProposalRow & {
  isManual?: boolean
}

type EditablePurchaseOrderLine = {
  requestId: string
  requestCode: string
  requestLineId: string
  createdAt: string
  materialCode: string
  materialName: string
  unit: string
  proposedQty: number
  orderedQty: number
  planCount: number
  windowLabel: string
  reason: string
  status: 'DRAFT' | 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI' | 'DA_CHUYEN_DAT_HANG'
  checked: boolean
}

type EditableFinalizeLine = {
  poLineId: string
  materialCode: string
  materialName: string
  unit: string
  orderedQty: number
  actualReceivedQty: number
  acceptedQty: number
  billedQty: number
  unitPrice: number
  haoHutPct: number
}

type InlineReceiptLineState = Record<
  string,
  {
    receivedQty: string
    acceptedQty: string
    defectiveQty: string
  }
>

type InlineReceiptFinalizeLineState = Record<
  string,
  {
    billedQty: string
    unitPrice: string
  }
>

type WorkspaceKey = 'proposal' | 'purchasing' | 'warehouse' | 'accounting'

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function formatDateLabel(value: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function buildPlanDisplayCode(value: string, sequence: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return `KH-${String(sequence).padStart(2, '0')}`
  return `KH-${match[1]}${match[2]}${match[3]}-${String(sequence).padStart(2, '0')}`
}

function buildFriendlyMaterialCode(materialCode: string, materialName: string) {
  const normalizedCode = String(materialCode || '').trim()
  const normalizedName = String(materialName || '').trim()

  if (normalizedCode.includes('::')) {
    const [, tail = ''] = normalizedCode.split('::')
    if (tail && !/^[0-9a-f]{8}-/i.test(tail)) return tail
  }

  if (!normalizedName) return normalizedCode || '-'

  const asciiName = normalizedName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9.]+/g, '')

  return asciiName || normalizedCode || '-'
}

function buildProposalRowFromDemand(row: NvlDemandDecisionRow, sourceMode: 'LIVE_DEMAND_ONLY' | 'FULL'): EditableProposalRow {
  return {
    id: row.id,
    materialCode: row.materialCode,
    materialName: row.materialName,
    category: '',
    windowLabel: row.windowLabel,
    proposedQty: row.demandQty,
    unit: row.unit,
    planCount: row.planCount,
    sourceMode,
    basisLabel: 'Theo nhu cầu từ kế hoạch sản xuất',
    urgencyLabel: row.windowLabel === '-' ? 'Chưa xác định kỳ' : `Kỳ ${row.windowLabel}`,
    status: 'DRAFT',
    reason: 'Lấy trực tiếp từ nhu cầu NVL của kế hoạch đang mở.',
    explanation: row.explanation,
  }
}

function buildEmptyManualProposalRow(sourceMode: 'LIVE_DEMAND_ONLY' | 'FULL'): EditableProposalRow {
  const uniqueId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id: uniqueId,
    materialCode: '',
    materialName: '',
    category: '',
    windowLabel: 'Bổ sung thủ công',
    proposedQty: 0,
    unit: '',
    planCount: 0,
    sourceMode,
    basisLabel: 'Bổ sung thủ công',
    urgencyLabel: 'Bổ sung ngoài kế hoạch',
    status: 'DRAFT',
    reason: 'Bổ sung thủ công trước khi gửi đề xuất mua.',
    explanation: 'Dòng này được thêm tay để phục vụ mua hàng ngoài định mức sản xuất.',
    isManual: true,
  }
}

function isPurchaseLikeRole(role: string) {
  const normalized = String(role || '').trim().toLowerCase()
  return ['ktmh', 'ke toan mua hang', 'ketoan mua hang', 'mua hang', 'purchasing'].includes(normalized)
}

function isWarehouseLikeRole(role: string) {
  const normalized = String(role || '').trim().toLowerCase()
  return ['thu kho', 'kho', 'warehouse'].includes(normalized)
}

function isAdminLikeRole(role: string) {
  return String(role || '').trim().toLowerCase() === 'admin'
}

function formatPurchaseRequestStatus(status: string) {
  switch (String(status || '').trim().toUpperCase()) {
    case 'CHO_DUYET':
      return 'Chờ duyệt'
    case 'DA_DUYET':
      return 'Đã duyệt'
    case 'TU_CHOI':
      return 'Từ chối'
    case 'DA_CHUYEN_DAT_HANG':
      return 'Đã chuyển đặt hàng'
    default:
      return 'Nháp'
  }
}

function formatReceiptStatus(status: string) {
  switch (String(status || '').trim().toUpperCase()) {
    case 'DA_NHAN':
      return 'Đã nhận'
    case 'DA_NHAN_MOT_PHAN':
      return 'Đã nhận một phần'
    case 'DA_XU_LY_LOI':
      return 'Đã xử lý lỗi'
    default:
      return 'Nháp'
  }
}

export function NvlProcurementFlowPageClient(props: { pageData: NvlProcurementFlowPageData; currentRole: string }) {
  const router = useRouter()
  const vendorOptions = useMemo(() => props.pageData.vendorOptions ?? [], [props.pageData.vendorOptions])
  const isAdminRole = useMemo(() => isAdminLikeRole(props.currentRole), [props.currentRole])
  const isPurchaseRole = useMemo(() => isPurchaseLikeRole(props.currentRole), [props.currentRole])
  const isWarehouseRole = useMemo(() => isWarehouseLikeRole(props.currentRole), [props.currentRole])
  const showPlanningSections = isAdminRole || !isWarehouseRole
  const showProposalEditorSection = isAdminRole || (!isPurchaseRole && !isWarehouseRole)
  const showRequestTrackingSection = isAdminRole || isPurchaseRole || (!isPurchaseRole && !isWarehouseRole)
  const showPurchaseSections = isAdminRole || isPurchaseRole
  const showWarehouseSections = isAdminRole || isWarehouseRole
  const showExecutionSections = isAdminRole || isPurchaseRole || isWarehouseRole
  const [proposalRows, setProposalRows] = useState<EditableProposalRow[]>([])
  const [requestSearch, setRequestSearch] = useState('')
  const [requestStatusFilter, setRequestStatusFilter] = useState('ALL')
  const [purchaseOrderSearch, setPurchaseOrderSearch] = useState('')
  const [purchaseOrderStatusFilter, setPurchaseOrderStatusFilter] = useState('ALL')
  const [onlyOverrunRisk, setOnlyOverrunRisk] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [purchaseVendorId, setPurchaseVendorId] = useState('')
  const [purchaseExpectedDate, setPurchaseExpectedDate] = useState('')
  const [purchaseNote, setPurchaseNote] = useState('')
  const [purchaseLines, setPurchaseLines] = useState<EditablePurchaseOrderLine[]>([])
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [purchaseError, setPurchaseError] = useState('')
  const [isCreatingPurchaseOrder, setIsCreatingPurchaseOrder] = useState(false)
  const [poMessage, setPoMessage] = useState('')
  const [poError, setPoError] = useState('')
  const [pendingPoId, setPendingPoId] = useState('')
  const [activePurchaseOrderId, setActivePurchaseOrderId] = useState('')
  const [purchaseOrderMenuId, setPurchaseOrderMenuId] = useState('')
  const [activeReceiptId, setActiveReceiptId] = useState('')
  const [activeReceiptDetail, setActiveReceiptDetail] = useState<Awaited<ReturnType<typeof fetchReceiptDetail>>['data'] | null>(null)
  const [activeReceiptLines, setActiveReceiptLines] = useState<InlineReceiptLineState>({})
  const [activeReceiptLoading, setActiveReceiptLoading] = useState(false)
  const [activeReceiptSaving, setActiveReceiptSaving] = useState(false)
  const [activeReceiptMessage, setActiveReceiptMessage] = useState('')
  const [activeReceiptError, setActiveReceiptError] = useState('')
  const [recordedReceiptIds, setRecordedReceiptIds] = useState<string[]>([])
  const [activeReceiptFinalizeVendorName, setActiveReceiptFinalizeVendorName] = useState('')
  const [activeReceiptFinalizeLines, setActiveReceiptFinalizeLines] = useState<InlineReceiptFinalizeLineState>({})
  const [activeReceiptFinalizing, setActiveReceiptFinalizing] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKey>('proposal')
  const [finalizePoId, setFinalizePoId] = useState('')
  const [finalizeVendorId, setFinalizeVendorId] = useState('')
  const [finalizeLines, setFinalizeLines] = useState<EditableFinalizeLine[]>([])
  const [expandedDemandPlanIds, setExpandedDemandPlanIds] = useState<string[]>([])
  const [showDemandTable, setShowDemandTable] = useState(true)
  const [showDemandSourcePlans, setShowDemandSourcePlans] = useState(false)
  const deferredRequestSearch = useDeferredValue(requestSearch)
  const deferredPurchaseOrderSearch = useDeferredValue(purchaseOrderSearch)
  const purchaseOrderMenuRef = useRef<HTMLDivElement | null>(null)

  const selectedVendor = useMemo(
    () => vendorOptions.find((item) => item.value === purchaseVendorId) || null,
    [vendorOptions, purchaseVendorId]
  )
  const availableWorkspaces = useMemo(() => {
    const items: Array<{ key: WorkspaceKey; label: string; description: string }> = []
    if (showPlanningSections) {
      items.push({
        key: 'proposal',
        label: 'Đề xuất',
        description: 'Rà nhu cầu và gửi đề xuất vật tư.',
      })
    }
    if (showRequestTrackingSection) {
      items.push({
        key: 'purchasing',
        label: 'Mua hàng',
        description: 'Duyệt đề xuất và lập phiếu mua.',
      })
    }
    if (showWarehouseSections) {
      items.push({
        key: 'warehouse',
        label: 'Nhận hàng',
        description: 'Thủ kho tạo đợt nhận, ghi sổ và kết thúc đơn.',
      })
    }
    if (showPurchaseSections) {
      items.push({
        key: 'accounting',
        label: 'KTMH chốt',
        description: 'Chốt từng đợt và khóa PO cuối.',
      })
    }
    return items
  }, [showPlanningSections, showPurchaseSections, showRequestTrackingSection, showWarehouseSections])
  const showWorkspaceSwitcher = availableWorkspaces.length > 1
  const isProposalWorkspace = activeWorkspace === 'proposal'
  const isPurchasingWorkspace = activeWorkspace === 'purchasing'
  const isWarehouseWorkspace = activeWorkspace === 'warehouse'
  const isAccountingWorkspace = activeWorkspace === 'accounting'
  const materialCatalogOptionByValue = useMemo(
    () => new Map(props.pageData.materialCatalogOptions.map((item) => [item.value, item])),
    [props.pageData.materialCatalogOptions]
  )
  const categoryByMaterialCode = useMemo(
    () =>
      new Map(
        props.pageData.materialCatalogOptions.map((item) => [String(item.code || '').trim().toUpperCase(), item.category || ''])
      ),
    [props.pageData.materialCatalogOptions]
  )

  const draftableRows = useMemo(
    () =>
      proposalRows.filter(
        (row) =>
          Number(row.proposedQty || 0) > 0 && String(row.materialCode || '').trim() && String(row.materialName || '').trim()
      ),
    [proposalRows]
  )
  const visibleDemandRows = useMemo(
    () => (onlyOverrunRisk ? props.pageData.demandRows.filter((row) => row.hasOverrunRisk) : props.pageData.demandRows),
    [onlyOverrunRisk, props.pageData.demandRows]
  )
  const visibleDemandSourcePlans = useMemo(
    () =>
      onlyOverrunRisk
        ? props.pageData.demandSourcePlans.filter((plan) => plan.hasOverrunRisk)
        : props.pageData.demandSourcePlans,
    [onlyOverrunRisk, props.pageData.demandSourcePlans]
  )
  const demandPlanDisplayCodeById = useMemo(
    () =>
      new Map(
        visibleDemandSourcePlans.map((plan, index) => [plan.planId, buildPlanDisplayCode(plan.ngayKeHoach, index + 1)])
      ),
    [visibleDemandSourcePlans]
  )
  const draftablePurchaseLines = useMemo(
    () =>
      purchaseLines.filter(
        (line) => line.checked && Number(line.orderedQty || 0) > 0 && String(line.requestLineId || '').trim()
      ),
    [purchaseLines]
  )
  const selectedPurchaseLines = useMemo(() => purchaseLines.filter((line) => line.checked), [purchaseLines])
  const purchaseOrderLineByRequestLineId = useMemo(() => {
    const map = new Map<
      string,
      {
        poCode: string
        vendorName: string
        workflowLabel: string
        status: string
        orderedQty: number
        actualReceivedQty: number
        acceptedQty: number
      }
    >()

    props.pageData.savedPurchaseOrderRows.forEach((po) => {
      po.lines.forEach((line) => {
        if (!line.requestLineId) return
        map.set(line.requestLineId, {
          poCode: po.poCode,
          vendorName: po.vendorName,
          workflowLabel: po.workflowLabel,
          status: po.status,
          orderedQty: line.orderedQty,
          actualReceivedQty: line.actualReceivedQty,
          acceptedQty: line.acceptedQty,
        })
      })
    })

    return map
  }, [props.pageData.savedPurchaseOrderRows])
  const finalizeTotals = useMemo(
    () =>
      finalizeLines.reduce(
        (acc, line) => {
          acc.actualReceivedQty += line.actualReceivedQty
          acc.billedQty += line.billedQty
          acc.totalAmount += line.billedQty * line.unitPrice
          return acc
        },
        { actualReceivedQty: 0, billedQty: 0, totalAmount: 0 }
      ),
    [finalizeLines]
  )
  const availablePurchaseLines = useMemo(
    () =>
      props.pageData.savedRequestRows.flatMap((request) =>
        request.lines
          .filter((line) => line.status !== 'DA_CHUYEN_DAT_HANG')
          .map((line) => ({
            requestId: request.requestId,
            requestCode: request.requestCode,
            requestLineId: line.requestLineId,
            createdAt: request.createdAt,
            materialCode: line.materialCode,
            materialName: line.materialName,
            unit: line.unit,
            proposedQty: line.proposedQty,
            orderedQty: line.proposedQty,
            planCount: line.planCount,
            windowLabel: line.windowLabel,
            reason: line.reason,
            status: line.status,
            checked: false,
          }))
      ),
    [props.pageData.savedRequestRows]
  )
  const trackedRequestLines = useMemo(
    () =>
      [...purchaseLines]
        .map((line) => {
          const poInfo = purchaseOrderLineByRequestLineId.get(line.requestLineId)
          return {
            ...line,
            poInfo,
            lineStatus:
              poInfo?.workflowLabel ||
              (line.status === 'DA_CHUYEN_DAT_HANG' ? 'Đã chuyển đặt hàng' : formatPurchaseRequestStatus(line.status)),
          }
        })
        .filter((line) => {
          if (requestStatusFilter !== 'ALL' && line.status !== requestStatusFilter) {
            return false
          }
          const keyword = String(deferredRequestSearch || '').trim().toLowerCase()
          if (!keyword) return true
          const haystack = [
            line.requestCode,
            line.materialName,
            line.materialCode,
            line.windowLabel,
            line.lineStatus,
            line.poInfo?.poCode,
            line.poInfo?.vendorName,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return haystack.includes(keyword)
        })
        .sort((left, right) => {
          const rightTime = new Date(right.createdAt || 0).getTime()
          const leftTime = new Date(left.createdAt || 0).getTime()
          if (rightTime !== leftTime) return rightTime - leftTime
          return String(right.requestCode || '').localeCompare(String(left.requestCode || ''))
        }),
    [purchaseLines, purchaseOrderLineByRequestLineId, deferredRequestSearch, requestStatusFilter]
  )
  const purchaseOrderReceiptMetaByPoId = useMemo(() => {
    const map = new Map<string, { receiptCount: number; allSettled: boolean }>()
    props.pageData.savedPurchaseOrderRows.forEach((row) => {
      const receipts = props.pageData.savedReceiptRows.filter((receipt) => receipt.poId === row.poId)
      map.set(row.poId, {
        receiptCount: receipts.length,
        allSettled: receipts.length > 0 && receipts.every((receipt) => receipt.settlementStatus === 'DA_CHOT'),
      })
    })
    return map
  }, [props.pageData.savedPurchaseOrderRows, props.pageData.savedReceiptRows])
  const filteredPurchaseOrders = useMemo(
    () =>
      props.pageData.savedPurchaseOrderRows.filter((row) => {
        if (purchaseOrderStatusFilter !== 'ALL' && row.status !== purchaseOrderStatusFilter) {
          return false
        }
        const keyword = String(deferredPurchaseOrderSearch || '').trim().toLowerCase()
        if (!keyword) return true
        const haystack = [
          row.poCode,
          row.requestCode,
          row.vendorName,
          row.workflowLabel,
          row.status,
          ...row.lines.flatMap((line) => [line.materialName, line.materialCode]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(keyword)
      }),
    [deferredPurchaseOrderSearch, props.pageData.savedPurchaseOrderRows, purchaseOrderStatusFilter]
  )
  const activePurchaseOrder = useMemo(
    () => props.pageData.savedPurchaseOrderRows.find((row) => row.poId === activePurchaseOrderId) || null,
    [activePurchaseOrderId, props.pageData.savedPurchaseOrderRows]
  )
  const activePurchaseOrderReceipts = useMemo(
    () =>
      activePurchaseOrder
        ? props.pageData.savedReceiptRows.filter((row) => row.poId === activePurchaseOrder.poId)
        : [],
    [activePurchaseOrder, props.pageData.savedReceiptRows]
  )
  const activeReceiptSummary = useMemo(
    () => activePurchaseOrderReceipts.find((row) => row.receiptId === activeReceiptId) || null,
    [activePurchaseOrderReceipts, activeReceiptId]
  )
  const activePurchaseOrderAllReceiptsSettled = useMemo(
    () => activePurchaseOrderReceipts.length > 0 && activePurchaseOrderReceipts.every((row) => row.settlementStatus === 'DA_CHOT'),
    [activePurchaseOrderReceipts]
  )
  const activeReceiptMovementRecorded = Boolean(
    activeReceiptSummary?.movementRecorded || (activeReceiptId && recordedReceiptIds.includes(activeReceiptId))
  )
  const activeReceiptSettlementLocked = Boolean(activeReceiptDetail?.settlementStatus === 'DA_CHOT')
  const activeReceiptSettlementLines = useMemo(() => {
    if (!activeReceiptDetail) return []
    const visibleLines = activeReceiptDetail.lines.filter(
      (line) =>
        Number(line.receivedQty || 0) > 0 ||
        Number(line.acceptedQty || 0) > 0 ||
        Number(line.defectiveQty || 0) > 0 ||
        Number(line.rejectedQty || 0) > 0 ||
        Number(line.billedQty || 0) > 0
    )
    return visibleLines.length ? visibleLines : activeReceiptDetail.lines
  }, [activeReceiptDetail])
  const activeReceiptFinalizeTotals = useMemo(() => {
    return activeReceiptSettlementLines.reduce(
      (acc, line) => {
        const current = activeReceiptFinalizeLines[line.receiptLineId] || {
          billedQty: String(line.billedQty || line.receivedQty || 0),
          unitPrice: String(line.unitPrice || 0),
        }
        const billedQty = Number(current.billedQty || 0)
        const unitPrice = Number(current.unitPrice || 0)
        acc.billedQty += billedQty
        acc.totalAmount += billedQty * unitPrice
        return acc
      },
      { billedQty: 0, totalAmount: 0 }
    )
  }, [activeReceiptFinalizeLines, activeReceiptSettlementLines])
  const activeReceiptHasPersistedData = useMemo(() => {
    if (!activeReceiptDetail) return false
    if (activeReceiptDetail.status !== 'DRAFT') return true
    return activeReceiptDetail.lines.some(
      (line) =>
        Number(line.receivedQty || 0) > 0 ||
        Number(line.acceptedQty || 0) > 0 ||
        Number(line.defectiveQty || 0) > 0 ||
        Number(line.rejectedQty || 0) > 0
    )
  }, [activeReceiptDetail])
  const activeReceiptIsDirty = useMemo(() => {
    if (!activeReceiptDetail) return false
    return activeReceiptDetail.lines.some((line) => {
      const current = activeReceiptLines[line.receiptLineId] || {
        receivedQty: String(line.receivedQty || 0),
        acceptedQty: String(line.acceptedQty || 0),
        defectiveQty: String(line.defectiveQty || 0),
      }
      return (
        Number(current.receivedQty || 0) !== Number(line.receivedQty || 0) ||
        Number(current.acceptedQty || 0) !== Number(line.acceptedQty || 0)
      )
    })
  }, [activeReceiptDetail, activeReceiptLines])
  const activeReceiptPrimaryAction = useMemo(() => {
    if (!activeReceiptDetail) {
      return { label: 'Lưu nháp', disabled: true, mode: 'save' as const }
    }
    if (activeReceiptMovementRecorded) {
      return { label: 'Đã ghi sổ', disabled: true, mode: 'posted' as const }
    }
    if (activeReceiptIsDirty || !activeReceiptHasPersistedData) {
      return { label: activeReceiptSaving ? 'Đang lưu...' : 'Lưu nháp', disabled: activeReceiptSaving, mode: 'save' as const }
    }
    return {
      label: pendingPoId === activeReceiptDetail.receiptId ? 'Đang ghi sổ...' : 'Ghi sổ',
      disabled: pendingPoId === activeReceiptDetail.receiptId,
      mode: 'post' as const,
    }
  }, [activeReceiptDetail, activeReceiptHasPersistedData, activeReceiptIsDirty, activeReceiptMovementRecorded, activeReceiptSaving, pendingPoId])
  const activeReceiptSyncState = useMemo(
    () => ({
      activeReceiptId,
      activeReceiptDetail,
      activePurchaseOrder,
      activePurchaseOrderReceipts,
    }),
    [activePurchaseOrder, activePurchaseOrderReceipts, activeReceiptDetail, activeReceiptId]
  )
  useEffect(() => {
    setPurchaseLines(availablePurchaseLines)
  }, [availablePurchaseLines])

  useEffect(() => {
    if (!filteredPurchaseOrders.length) {
      setActivePurchaseOrderId('')
      return
    }

    setActivePurchaseOrderId((current) => {
      if (current && filteredPurchaseOrders.some((row) => row.poId === current)) {
        return current
      }
      return filteredPurchaseOrders[0]?.poId || ''
    })
  }, [filteredPurchaseOrders])

  useEffect(() => {
    if (!availableWorkspaces.length) return
    setActiveWorkspace((current) => {
      if (availableWorkspaces.some((item) => item.key === current)) return current
      return availableWorkspaces[0].key
    })
  }, [availableWorkspaces])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!purchaseOrderMenuRef.current) return
      if (purchaseOrderMenuRef.current.contains(event.target as Node)) return
      setPurchaseOrderMenuId('')
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload()
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  useEffect(() => {
    if (!activeReceiptSyncState.activeReceiptId) {
      setActiveReceiptDetail(null)
      setActiveReceiptLines({})
      setActiveReceiptFinalizeVendorName('')
      setActiveReceiptFinalizeLines({})
      setActiveReceiptMessage('')
      setActiveReceiptError('')
      return
    }

    if (
      !activeReceiptSyncState.activeReceiptDetail &&
      activeReceiptSyncState.activePurchaseOrder &&
      activeReceiptSyncState.activePurchaseOrderReceipts.length > 0 &&
      !activeReceiptSyncState.activePurchaseOrderReceipts.some(
        (row) => row.receiptId === activeReceiptSyncState.activeReceiptId
      )
    ) {
      setActiveReceiptId('')
    }
  }, [activeReceiptSyncState])

  useEffect(() => {
    if (!finalizePoId) {
      setFinalizeVendorId('')
      setFinalizeLines([])
      return
    }
    const selectedPo = props.pageData.savedPurchaseOrderRows.find((row) => row.poId === finalizePoId)
    if (!selectedPo) {
      setFinalizeVendorId('')
      setFinalizeLines([])
      return
    }
    const matchedVendor = vendorOptions.find((item) => item.label === selectedPo.vendorName)
    setFinalizeVendorId(matchedVendor?.value || '')
    setFinalizeLines(
      selectedPo.lines.map((line) => ({
        poLineId: line.poLineId,
        materialCode: line.materialCode,
        materialName: line.materialName,
        unit: line.unit,
        orderedQty: line.orderedQty,
        actualReceivedQty: line.actualReceivedQty,
        acceptedQty: line.acceptedQty,
        billedQty: line.billedQty || line.orderedQty,
        unitPrice: line.unitPrice || 0,
        haoHutPct: line.haoHutPct,
      }))
    )
  }, [finalizePoId, props.pageData.savedPurchaseOrderRows, vendorOptions])

  function toggleDemandRowSelected(row: NvlDemandDecisionRow, checked: boolean) {
    const normalizedMaterialCode = String(row.materialCode || '').trim()
    setProposalRows((current) => {
      const alreadyExists = current.some((item) => String(item.materialCode || '').trim() === normalizedMaterialCode)
      if (checked) {
        if (alreadyExists) return current
        return [
          ...current,
          {
            ...buildProposalRowFromDemand(row, props.pageData.proposalMode),
            category: categoryByMaterialCode.get(normalizedMaterialCode.toUpperCase()) || '',
          },
        ]
      }
      return current.filter(
        (item) => item.isManual || String(item.materialCode || '').trim() !== normalizedMaterialCode
      )
    })
  }

  function toggleAllVisibleDemandRows(checked: boolean) {
    if (checked) {
      setProposalRows((current) => {
        const existingCodes = new Set(current.map((item) => String(item.materialCode || '').trim()))
        const nextRows = visibleDemandRows
          .filter((row) => !existingCodes.has(String(row.materialCode || '').trim()))
          .map((row) => ({
            ...buildProposalRowFromDemand(row, props.pageData.proposalMode),
            category:
              categoryByMaterialCode.get(String(row.materialCode || '').trim().toUpperCase()) || '',
          }))
        return [...current, ...nextRows]
      })
      return
    }

    const visibleCodes = new Set(visibleDemandRows.map((row) => String(row.materialCode || '').trim()))
    setProposalRows((current) =>
      current.filter((item) => !visibleCodes.has(String(item.materialCode || '').trim()) || item.isManual)
    )
  }

  function toggleDemandPlanExpanded(planId: string) {
    setExpandedDemandPlanIds((current) =>
      current.includes(planId) ? current.filter((item) => item !== planId) : [...current, planId]
    )
  }

  function handleQtyChange(rowId: string, nextValue: string) {
    const parsed = Number(nextValue.replace(/,/g, '.'))
    setProposalRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              proposedQty: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
            }
          : row
      )
    )
  }

  function handleRemoveRow(rowId: string) {
    setProposalRows((current) => current.filter((row) => row.id !== rowId))
  }

  function handleAddManualRow() {
    setProposalRows((current) => [...current, buildEmptyManualProposalRow(props.pageData.proposalMode)])
  }

  function handleManualMaterialChange(rowId: string, optionValue: string) {
    const option = materialCatalogOptionByValue.get(optionValue)
    if (!option) return

    setProposalRows((current) => {
      const duplicateExists = current.some(
        (row) => row.id !== rowId && String(row.materialCode || '').trim() === String(option.code || '').trim()
      )
      if (duplicateExists) {
        setSaveError(`NVL ${option.label} đã có trong đề xuất.`)
        return current
      }
      setSaveError('')
      return current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              materialCode: option.code,
              materialName: option.label,
              category: option.category,
              unit: option.unit,
              reason: 'Bổ sung thủ công trước khi gửi đề xuất mua.',
              explanation: 'Dòng này được thêm tay để phục vụ mua hàng ngoài định mức sản xuất.',
            }
          : row
      )
    })
  }

  function handlePurchaseLineChecked(lineId: string, checked: boolean) {
    setPurchaseLines((current) =>
      current.map((line) => (line.requestLineId === lineId ? { ...line, checked } : line))
    )
  }

  function handlePurchaseLineQty(lineId: string, nextValue: string) {
    const parsed = Number(nextValue.replace(/,/g, '.'))
    setPurchaseLines((current) =>
      current.map((line) =>
        line.requestLineId === lineId
          ? {
              ...line,
              orderedQty: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
            }
          : line
      )
    )
  }

  async function handleCreatePurchaseOrder() {
    if (!draftablePurchaseLines.length) {
      setPurchaseError('Chưa chọn dòng nào để duyệt.')
      return
    }

    setPurchaseMessage('')
    setPurchaseError('')
    setIsCreatingPurchaseOrder(true)
    try {
      const result = await submitCreatePurchaseOrderDraft({
        vendorName: selectedVendor?.label || '',
        expectedDate: purchaseExpectedDate,
        note: purchaseNote,
        lines: draftablePurchaseLines.map((line) => ({
          requestId: line.requestId,
          requestLineId: line.requestLineId,
          orderedQty: line.orderedQty,
        })),
      })
      setPurchaseMessage(
        selectedVendor
          ? `Đã duyệt ${result.data?.lineCount || 0} dòng và tạo phiếu mua ${result.data?.poCode || ''} cho NCC ${selectedVendor.label}.`.trim()
          : `Đã duyệt ${result.data?.lineCount || 0} dòng và tạo phiếu mua ${result.data?.poCode || ''}.`.trim()
      )
      setPurchaseVendorId('')
      setPurchaseExpectedDate('')
      setPurchaseNote('')
      setPurchaseLines((current) => current.map((line) => ({ ...line, checked: false })))
      router.refresh()
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'Không lập được phiếu mua NVL.')
    } finally {
      setIsCreatingPurchaseOrder(false)
    }
  }

  async function handleSubmitProposal() {
    setSaveMessage('')
    setSaveError('')
    setIsSaving(true)
    try {
      const result = await submitCreatePurchaseRequestDraft({
        sourceMode: props.pageData.proposalMode,
        rows: draftableRows,
        note: `Bản đề xuất mua do QLSX rà lại từ nhu cầu kế hoạch, gồm ${draftableRows.length} dòng.`,
      })
      setSaveMessage(`Đã gửi đề xuất ${result.data?.requestCode || ''} với ${result.data?.lineCount || 0} dòng.`.trim())
      setProposalRows([])
      router.refresh()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Không gửi được đề xuất mua NVL.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateReceipt(poId: string) {
    setPoMessage('')
    setPoError('')
    setPendingPoId(poId)
    try {
      const result = await submitCreateReceiptDraft({ poId })
      setPoMessage(`Đã tạo phiếu nhập ${result.data?.receiptCode || ''}, đợt ${result.data?.batchNo || 1}.`.trim())
      if (result.data?.receiptId) {
        await openInlineReceipt(result.data.receiptId)
      }
      router.refresh()
    } catch (error) {
      setPoError(error instanceof Error ? error.message : 'Không tạo được phiếu nhập NVL.')
    } finally {
      setPendingPoId('')
    }
  }

  async function handleFinishReceiving(poId: string) {
    setPoMessage('')
    setPoError('')
    setPendingPoId(poId)
    try {
      const result = await submitFinishPurchaseOrder({ poId })
      setPoMessage(`Đã kết thúc nhập cho phiếu mua ${result.data?.poCode || ''}.`.trim())
      router.refresh()
    } catch (error) {
      setPoError(error instanceof Error ? error.message : 'Không kết thúc được phiếu mua NVL.')
    } finally {
      setPendingPoId('')
    }
  }

  async function handleConfirmReceiptMovement(receiptId: string) {
    setPoMessage('')
    setPoError('')
    setPendingPoId(receiptId)
    try {
      const result = await submitConfirmReceiptMovement({ receiptId })
      setRecordedReceiptIds((current) => (current.includes(receiptId) ? current : [...current, receiptId]))
      setPoMessage(`Đã ghi nhập kho ${result.data?.receiptCode || ''} với ${result.data?.movementCount || 0} movement.`.trim())
      if (activeReceiptId === receiptId) {
        setActiveReceiptMessage(`Đã ghi sổ phiếu nhập ${result.data?.receiptCode || ''}.`.trim())
        setActiveReceiptError('')
      }
      router.refresh()
    } catch (error) {
      setPoError(error instanceof Error ? error.message : 'Không ghi nhập kho được cho phiếu nhập NVL.')
    } finally {
      setPendingPoId('')
    }
  }

  async function openInlineReceipt(receiptId: string) {
    if (activeReceiptId === receiptId) {
      setActiveReceiptId('')
      setActiveReceiptDetail(null)
      setActiveReceiptLines({})
      setActiveReceiptMessage('')
      setActiveReceiptError('')
      return
    }

    setActiveReceiptLoading(true)
    setActiveReceiptError('')
    setActiveReceiptMessage('')
    try {
      const result = await fetchReceiptDetail(receiptId)
      const detail = result.data || null
      setActiveReceiptId(receiptId)
      setActiveReceiptDetail(detail)
      setActiveReceiptLines(
        detail
          ? Object.fromEntries(
              detail.lines.map((line) => [
                line.receiptLineId,
                {
                  receivedQty: String(line.receivedQty || 0),
                  acceptedQty: String(line.acceptedQty || 0),
                  defectiveQty: String(line.defectiveQty || 0),
                },
              ])
            )
          : {}
      )
      setActiveReceiptFinalizeVendorName(detail?.vendorName && detail.vendorName !== 'Chưa chọn NCC' ? detail.vendorName : '')
      setActiveReceiptFinalizeLines(
        detail
          ? Object.fromEntries(
              detail.lines.map((line) => [
                line.receiptLineId,
                {
                  billedQty: String(line.billedQty || line.receivedQty || 0),
                  unitPrice: String(line.unitPrice || 0),
                },
              ])
            )
          : {}
      )
    } catch (error) {
      setActiveReceiptError(error instanceof Error ? error.message : 'Không mở được phiếu nhập.')
    } finally {
      setActiveReceiptLoading(false)
    }
  }

  async function handleSaveInlineReceipt() {
    if (!activeReceiptDetail) return

    setActiveReceiptSaving(true)
    setActiveReceiptError('')
    setActiveReceiptMessage('')
    try {
      const result = await submitSaveReceiptDraft({
        receiptId: activeReceiptDetail.receiptId,
        note: activeReceiptDetail.note || '',
        lines: activeReceiptDetail.lines.map((line) => {
          const current = activeReceiptLines[line.receiptLineId] || {
            receivedQty: String(line.receivedQty || 0),
            acceptedQty: String(line.acceptedQty || 0),
            defectiveQty: String(line.defectiveQty || 0),
          }
          const receivedQty = Number(current.receivedQty || 0)
          const acceptedQty = Number(current.acceptedQty || 0)
          return {
            receiptLineId: line.receiptLineId,
            receivedQty,
            acceptedQty,
            defectiveQty: Math.max(receivedQty - acceptedQty, 0),
            rejectedQty: 0,
          }
        }),
      })

      if (result.data) {
        setActiveReceiptDetail(result.data)
        setActiveReceiptLines(
          Object.fromEntries(
            result.data.lines.map((line) => [
              line.receiptLineId,
              {
                receivedQty: String(line.receivedQty || 0),
                acceptedQty: String(line.acceptedQty || 0),
                defectiveQty: String(line.defectiveQty || 0),
              },
            ])
          )
        )
      }

      setActiveReceiptMessage(`Đã lưu phiếu nhập ${result.data?.receiptCode || activeReceiptDetail.receiptCode}.`)
      router.refresh()
    } catch (error) {
      setActiveReceiptError(error instanceof Error ? error.message : 'Không lưu được phiếu nhập.')
    } finally {
      setActiveReceiptSaving(false)
    }
  }

  async function handleActiveReceiptPrimaryAction() {
    if (!activeReceiptDetail) return
    if (activeReceiptPrimaryAction.mode === 'save') {
      await handleSaveInlineReceipt()
      return
    }
    if (activeReceiptPrimaryAction.mode === 'post') {
      await handleConfirmReceiptMovement(activeReceiptDetail.receiptId)
    }
  }

  async function handleFinalizeActiveReceipt() {
    if (!activeReceiptDetail) return

    setActiveReceiptFinalizing(true)
    setActiveReceiptError('')
    setActiveReceiptMessage('')
    try {
      const result = await submitFinalizeReceipt({
        receiptId: activeReceiptDetail.receiptId,
        vendorName: activeReceiptFinalizeVendorName,
        lines: activeReceiptDetail.lines.map((line) => {
          const current = activeReceiptFinalizeLines[line.receiptLineId] || {
            billedQty: String(line.billedQty || line.receivedQty || 0),
            unitPrice: String(line.unitPrice || 0),
          }
          return {
            receiptLineId: line.receiptLineId,
            billedQty: Number(current.billedQty || 0),
            unitPrice: Number(current.unitPrice || 0),
          }
        }),
      })

      const refreshed = await fetchReceiptDetail(activeReceiptDetail.receiptId)
      setActiveReceiptDetail(refreshed.data || null)
      setActiveReceiptFinalizeVendorName(
        refreshed.data?.vendorName && refreshed.data.vendorName !== 'Chưa chọn NCC'
          ? refreshed.data.vendorName
          : activeReceiptFinalizeVendorName
      )
      setActiveReceiptFinalizeLines(
        refreshed.data
          ? Object.fromEntries(
              refreshed.data.lines.map((line) => [
                line.receiptLineId,
                {
                  billedQty: String(line.billedQty || line.receivedQty || 0),
                  unitPrice: String(line.unitPrice || 0),
                },
              ])
            )
          : {}
      )
      setActiveReceiptMessage(
        `Đã chốt đợt ${result.data?.receiptCode || activeReceiptDetail.receiptCode} với giá trị ${formatNumber(
          result.data?.totalAmount || 0
        )}.`
      )
      router.refresh()
    } catch (error) {
      setActiveReceiptError(error instanceof Error ? error.message : 'Không chốt được đợt nhập hàng.')
    } finally {
      setActiveReceiptFinalizing(false)
    }
  }

  function handleFinalizeLineChange(poLineId: string, field: 'billedQty' | 'unitPrice', value: string) {
    const parsed = Number(value.replace(/,/g, '.'))
    setFinalizeLines((current) =>
      current.map((line) =>
        line.poLineId === poLineId
          ? {
              ...line,
              [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
            }
          : line
      )
    )
  }

  async function handleFinalizePurchaseOrder() {
    if (!finalizePoId) return
    setPoMessage('')
    setPoError('')
    setPendingPoId(finalizePoId)
    try {
      const result = await submitFinalizePurchaseOrder({
        poId: finalizePoId,
        vendorName: vendorOptions.find((item) => item.value === finalizeVendorId)?.label || '',
        lines: finalizeLines.map((line) => ({
          poLineId: line.poLineId,
          billedQty: line.billedQty,
          unitPrice: line.unitPrice,
        })),
      })
      setPoMessage(`Đã xác nhận cuối phiếu mua ${result.data?.poCode || ''}.`.trim())
      setFinalizePoId('')
      router.refresh()
    } catch (error) {
      setPoError(error instanceof Error ? error.message : 'Không xác nhận cuối được phiếu mua NVL.')
    } finally {
      setPendingPoId('')
    }
  }

  return (
    <div>
      {showWorkspaceSwitcher ? (
        <section className="border-b px-6 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex flex-wrap items-center justify-end gap-2">
              {availableWorkspaces.map((workspace) => (
                <button
                  key={workspace.key}
                  type="button"
                  className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                  style={{
                    borderColor: activeWorkspace === workspace.key ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor:
                      activeWorkspace === workspace.key
                        ? 'color-mix(in srgb, var(--color-primary) 10%, white)'
                        : 'white',
                    color: activeWorkspace === workspace.key ? 'var(--color-primary)' : 'inherit',
                  }}
                  onClick={() => setActiveWorkspace(workspace.key)}
                  title={workspace.description}
                >
                  {workspace.label}
                </button>
              ))}
          </div>
        </section>
      ) : null}

      {showPlanningSections && isProposalWorkspace ? (
      <section className="overflow-hidden p-6">
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-lg font-semibold">Nhu cầu vật tư</div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={onlyOverrunRisk}
                  onChange={(event) => setOnlyOverrunRisk(event.target.checked)}
                />
                Chỉ hiện dòng có cảnh báo vượt
              </label>
              <button
                type="button"
                aria-label={showDemandTable ? 'Ẩn bảng nhu cầu vật tư' : 'Hiện bảng nhu cầu vật tư'}
                className="inline-flex items-center justify-center px-1 py-1 text-base font-semibold leading-none"
                onClick={() => setShowDemandTable((current) => !current)}
              >
                {showDemandTable ? '⌃' : '⌄'}
              </button>
            </div>
          </div>
          {showDemandTable ? (
            <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead style={{ backgroundColor: '#f6f8fb' }}>
                    <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                      <th
                        className="sticky top-0 z-20 w-12 px-4 py-3 text-center shadow-[inset_0_-1px_0_var(--color-border)]"
                        style={{ backgroundColor: '#f6f8fb' }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            visibleDemandRows.length > 0 &&
                            visibleDemandRows.every((row) =>
                              proposalRows.some(
                                (item) => String(item.materialCode || '').trim() === String(row.materialCode || '').trim()
                              )
                            )
                          }
                          disabled={!showProposalEditorSection || !visibleDemandRows.length}
                          onChange={(event) => toggleAllVisibleDemandRows(event.target.checked)}
                        />
                      </th>
                      <th className="sticky top-0 z-20 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>NVL</th>
                      <th className="sticky top-0 z-20 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Kỳ nhu cầu</th>
                      <th className="sticky top-0 z-20 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>KHSX</th>
                      <th className="sticky top-0 z-20 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Nhu cầu</th>
                      <th className="sticky top-0 z-20 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Tồn hiện tại</th>
                      <th className="sticky top-0 z-20 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Khả dụng</th>
                      <th className="sticky top-0 z-20 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Đang mua</th>
                      <th className="sticky top-0 z-20 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Coverage</th>
                      <th className="sticky top-0 z-20 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: '#f6f8fb' }}>Thiếu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDemandRows.map((row) => {
                      const isChecked = proposalRows.some(
                        (item) => String(item.materialCode || '').trim() === String(row.materialCode || '').trim()
                      )
                      return (
                        <tr key={row.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                          <td className="px-4 py-4 align-middle text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!showProposalEditorSection}
                              onChange={(event) => toggleDemandRowSelected(row, event.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold">{row.materialName}</div>
                          </td>
                          <td className="px-4 py-4">{row.windowLabel}</td>
                          <td className="px-4 py-4 text-right">{formatNumber(row.planCount)}</td>
                          <td className="px-4 py-4 text-right font-semibold">{formatNumber(row.demandQty)}</td>
                          <td className="px-4 py-4 text-right">{formatNumber(row.stockQty)}</td>
                          <td className="px-4 py-4 text-right">{formatNumber(row.availableQty)}</td>
                          <td className="px-4 py-4 text-right">{formatNumber(row.openInboundQty)}</td>
                          <td className="px-4 py-4 text-right">{formatNumber(row.reusableCoverageQty)}</td>
                          <td className="px-4 py-4 text-right font-semibold">{formatNumber(row.shortageQty)}</td>
                        </tr>
                      )
                    })}
                    {!visibleDemandRows.length ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-6 text-center app-muted">
                          Không có dòng nào phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {showPlanningSections ? (
          <div className="border-t p-6" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Nguồn demand theo kế hoạch</h3>
              <button
                type="button"
                aria-label={showDemandSourcePlans ? 'Ẩn nguồn demand' : 'Hiện nguồn demand'}
                className="inline-flex items-center justify-center px-1 py-1 text-base font-semibold leading-none"
                onClick={() => setShowDemandSourcePlans((current) => !current)}
              >
                {showDemandSourcePlans ? '⌃' : '⌄'}
              </button>
            </div>

            {showDemandSourcePlans ? (
              <div className="mt-4 divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {visibleDemandSourcePlans.length ? (
                  visibleDemandSourcePlans.map((plan) => {
                    const displayCode = demandPlanDisplayCodeById.get(plan.planId) || plan.planId
                    const expanded = expandedDemandPlanIds.includes(plan.planId)
                    return (
                      <article key={plan.planId} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              type="button"
                              aria-label={expanded ? 'Thu gọn kế hoạch' : 'Mở kế hoạch'}
                              className="inline-flex items-center justify-center px-1 py-1 text-lg font-semibold leading-none"
                              onClick={() => toggleDemandPlanExpanded(plan.planId)}
                            >
                              {expanded ? '-' : '+'}
                            </button>
                            <div>
                              <div className="font-semibold">{displayCode}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {plan.hasOverrunRisk ? (
                              <div className="text-sm font-semibold" style={{ color: '#b91c1c' }}>
                                Kế hoạch này đang vượt đơn hàng ở {formatNumber(plan.overrunLineCount)} dòng.
                              </div>
                            ) : null}
                            <div className="text-sm app-muted">{plan.materialRows.length} dòng NVL</div>
                          </div>
                        </div>

                        {expanded ? (
                          <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                            <table className="min-w-full text-sm">
                              <thead style={{ backgroundColor: '#f6f8fb' }}>
                                <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                                  <th className="px-4 py-3">Mã</th>
                                  <th className="px-4 py-3">Tên NVL</th>
                                  <th className="px-4 py-3">ĐVT</th>
                                  <th className="px-4 py-3 text-right">Nhu cầu</th>
                                </tr>
                              </thead>
                              <tbody>
                                {plan.materialRows.map((item) => (
                                  <tr key={`${plan.planId}-${item.materialCode}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                                    <td className="px-4 py-3">{buildFriendlyMaterialCode(item.materialCode, item.materialName)}</td>
                                    <td className="px-4 py-3 font-medium">{item.materialName}</td>
                                    <td className="px-4 py-3">{item.unit || '-'}</td>
                                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(item.demandQty)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </article>
                    )
                  })
                ) : (
                  <div className="py-4 text-sm app-muted">Hiện chưa có kế hoạch mở nào góp demand NVL.</div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {showProposalEditorSection ? (
          <div className="border-t p-6" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Đề xuất NVL</h3>
              <button
                type="button"
                aria-label="Thêm dòng ngoài kế hoạch"
                className="inline-flex items-center justify-center px-1 py-1 text-xl font-semibold leading-none"
                onClick={handleAddManualRow}
              >
                +
              </button>
            </div>
            {saveMessage ? (
              <div
                className="mt-3 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'color-mix(in srgb, #16a34a 10%, white)',
                  color: '#166534',
                }}
              >
                {saveMessage}
              </div>
            ) : null}
            {saveError ? (
              <div
                className="mt-3 rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'color-mix(in srgb, #dc2626 10%, white)',
                  color: '#991b1b',
                }}
              >
                {saveError}
              </div>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                  <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                    <th className="px-4 py-3">NVL</th>
                    <th className="px-4 py-3">Nhóm hàng</th>
                    <th className="px-4 py-3 text-right">Số lượng</th>
                    <th className="px-4 py-3">ĐVT</th>
                    <th className="w-14 px-4 py-3 text-center" />
                  </tr>
                </thead>
                <tbody>
                  {proposalRows.length ? (
                    proposalRows.map((row) => (
                      <tr key={row.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td className="px-4 py-4">
                          {row.isManual && !row.materialCode ? (
                            <select
                              value=""
                              onChange={(event) => handleManualMaterialChange(row.id, event.target.value)}
                              className="w-full rounded-xl border px-3 py-2 text-sm"
                              style={{ borderColor: 'var(--color-border)' }}
                            >
                              <option value="">Chọn NVL từ danh mục</option>
                              {props.pageData.materialCatalogOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <div className="font-semibold">{row.materialName || 'Chưa chọn NVL'}</div>
                              <div className="app-muted mt-1 font-mono text-xs">{row.materialCode || '-'}</div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-4">{row.category || '-'}</td>
                        <td className="px-4 py-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={String(row.proposedQty)}
                            onChange={(event) => handleQtyChange(row.id, event.target.value)}
                            className="w-32 rounded-xl border px-3 py-2 text-right text-sm"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="px-4 py-4">{row.unit || '-'}</td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            aria-label="Xóa dòng"
                            className="inline-flex items-center justify-center px-1 py-1 text-base leading-none"
                            onClick={() => handleRemoveRow(row.id)}
                          >
                            x
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center app-muted">
                        Chưa có dòng nào trong đề xuất. Chọn NVL từ bảng demand ở trên hoặc thêm tay từ danh mục.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary)' }}
                disabled={isSaving || !draftableRows.length}
                onClick={handleSubmitProposal}
              >
                {isSaving ? 'Đang gửi...' : 'Gửi đề xuất'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      {showRequestTrackingSection && isPurchasingWorkspace ? (
      <section className="border-t bg-white px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Danh mục đề xuất</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={requestStatusFilter}
              onChange={(event) => setRequestStatusFilter(event.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="CHO_DUYET">Chờ duyệt</option>
              <option value="DA_DUYET">Đã duyệt</option>
              <option value="TU_CHOI">Từ chối</option>
              <option value="DA_CHUYEN_DAT_HANG">Đã chuyển đặt hàng</option>
            </select>
            <input
              type="search"
              value={requestSearch}
              onChange={(event) => setRequestSearch(event.target.value)}
              placeholder="Tìm mã đề xuất, NVL, kỳ, trạng thái..."
              className="w-80 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <div className="max-h-[30rem] overflow-auto" style={{ scrollbarGutter: 'stable both-edges' }}>
            <table className="min-w-full text-sm">
              <thead
                className="sticky top-0 z-10"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
              >
                <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                  {showPurchaseSections ? <th className="px-4 py-3 text-center">Chọn</th> : null}
                  <th className="px-4 py-3">Đề xuất</th>
                  <th className="px-4 py-3">Ngày đề xuất</th>
                  <th className="px-4 py-3">NVL</th>
                  <th className="px-4 py-3">Kỳ</th>
                  <th className="px-4 py-3 text-right">KHSX</th>
                  <th className="px-4 py-3 text-right">SL đề xuất</th>
                  <th className="px-4 py-3 text-right">SL đặt</th>
                  <th className="px-4 py-3 text-right">Đã nhập</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {trackedRequestLines.length ? (
                  trackedRequestLines.map((line) => (
                    <tr key={line.requestLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                      {showPurchaseSections ? (
                        <td className="px-4 py-4 text-center align-top">
                          {line.status !== 'DA_CHUYEN_DAT_HANG' ? (
                            <input
                              type="checkbox"
                              checked={line.checked}
                              onChange={(event) => handlePurchaseLineChecked(line.requestLineId, event.target.checked)}
                            />
                          ) : (
                            <span className="app-muted">-</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium">{line.requestCode}</div>
                      </td>
                      <td className="px-4 py-4 align-top">{formatDateLabel(line.createdAt)}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium">{line.materialName || '-'}</div>
                        <div className="app-muted mt-1 font-mono text-xs">{line.materialCode || '-'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">{line.windowLabel || '-'}</td>
                      <td className="px-4 py-4 text-right align-top">{formatNumber(line.planCount)}</td>
                      <td className="px-4 py-4 text-right align-top">{formatNumber(line.proposedQty)}</td>
                      <td className="px-4 py-4 text-right align-top">
                        {line.checked || line.poInfo
                          ? formatNumber(line.poInfo?.orderedQty || line.orderedQty || 0)
                          : '-'}
                      </td>
                      <td className="px-4 py-4 text-right align-top">{formatNumber(line.poInfo?.actualReceivedQty || 0)}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium">{line.lineStatus}</div>
                        {line.poInfo ? (
                          <div className="app-muted mt-1 text-xs">
                            {line.poInfo.poCode}
                            {line.poInfo.vendorName ? ` · ${line.poInfo.vendorName}` : ''}
                          </div>
                        ) : (
                          <div className="app-muted mt-1 text-xs">Chưa lập phiếu mua</div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={showPurchaseSections ? 10 : 9} className="px-4 py-6 text-center app-muted">
                      {purchaseLines.length
                        ? 'Không có dòng nào khớp với bộ lọc tìm kiếm.'
                        : 'Chưa có dòng NVL nào đã gửi để KTMH xử lý.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showPurchaseSections ? (
          <div
            className="mt-5 rounded-2xl border p-4"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)',
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold">Phiếu mua đang soạn</h4>
              </div>
              <div className="app-muted text-sm">{selectedPurchaseLines.length} dòng đang chọn</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                  <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                    <th className="px-4 py-3">NVL</th>
                    <th className="px-4 py-3">Nhóm hàng</th>
                    <th className="px-4 py-3 text-right">SL đề xuất</th>
                    <th className="px-4 py-3 text-right">SL đặt</th>
                    <th className="px-4 py-3">ĐVT</th>
                    <th className="px-4 py-3 text-center">X</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchaseLines.length ? (
                    selectedPurchaseLines.map((line) => (
                      <tr key={line.requestLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td className="px-4 py-4">
                          <div className="font-medium">{line.materialName || '-'}</div>
                          <div className="app-muted mt-1 font-mono text-xs">{line.materialCode || '-'}</div>
                          <div className="app-muted mt-1 text-xs">{line.requestCode}</div>
                        </td>
                        <td className="px-4 py-4">{categoryByMaterialCode.get(String(line.materialCode || '').trim().toUpperCase()) || '-'}</td>
                        <td className="px-4 py-4 text-right">{formatNumber(line.proposedQty)}</td>
                        <td className="px-4 py-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={String(line.orderedQty)}
                            onChange={(event) => handlePurchaseLineQty(line.requestLineId, event.target.value)}
                            className="w-28 rounded-xl border px-3 py-2 text-right text-sm"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="px-4 py-4">{line.unit || '-'}</td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            className="text-lg font-semibold leading-none"
                            onClick={() => handlePurchaseLineChecked(line.requestLineId, false)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center app-muted">
                        Chưa chọn dòng nào để đưa vào phiếu mua.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <select
                value={purchaseVendorId}
                onChange={(event) => setPurchaseVendorId(event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="">Chọn nhà cung cấp</option>
                {vendorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                value={purchaseNote}
                onChange={(event) => setPurchaseNote(event.target.value)}
                placeholder="Ghi chú phiếu mua"
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary)' }}
                disabled={isCreatingPurchaseOrder || !draftablePurchaseLines.length}
                onClick={() => handleCreatePurchaseOrder()}
              >
                {isCreatingPurchaseOrder ? 'Đang duyệt...' : 'Duyệt'}
              </button>
            </div>
          </div>
        ) : null}

        {purchaseMessage ? (
          <div
            className="mt-3 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, #16a34a 10%, white)',
              color: '#166534',
            }}
          >
            {purchaseMessage}
          </div>
        ) : null}
        {purchaseError ? (
          <div
            className="mt-3 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, #dc2626 10%, white)',
              color: '#991b1b',
            }}
          >
            {purchaseError}
          </div>
        ) : null}
      </section>
      ) : null}

      {showExecutionSections && (isWarehouseWorkspace || isAccountingWorkspace) ? (
      <section className="border-t p-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Phiếu mua hàng</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={purchaseOrderStatusFilter}
              onChange={(event) => setPurchaseOrderStatusFilter(event.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="DA_GUI_NCC">Đã gửi NCC</option>
              <option value="DA_NHAN_MOT_PHAN">Đang nhập hàng</option>
              <option value="XAC_NHAN_MOT_PHAN">Chờ khóa</option>
              <option value="DA_NHAN_DU">Đã xác nhận cuối</option>
              <option value="HUY">Hủy</option>
            </select>
            <input
              type="search"
              value={purchaseOrderSearch}
              onChange={(event) => setPurchaseOrderSearch(event.target.value)}
              placeholder="Tìm phiếu mua, NCC, NVL, trạng thái..."
              className="w-80 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--color-border)' }}
            />
          </div>
        </div>

        <div className="mt-5 max-h-[28rem] overflow-auto border-y" style={{ borderColor: 'var(--color-border)', scrollbarGutter: 'stable both-edges' }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
              <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>Phiếu mua</th>
                <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>NCC</th>
                <th className="sticky top-0 z-10 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>SL duyệt mua</th>
                <th className="sticky top-0 z-10 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>SL thực nhập</th>
                <th className="sticky top-0 z-10 px-4 py-3 text-right shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>Đợt nhập</th>
                <th className="sticky top-0 z-10 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>Trạng thái</th>
                <th className="sticky top-0 z-10 w-14 px-4 py-3 shadow-[inset_0_-1px_0_var(--color-border)]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }} />
              </tr>
            </thead>
            <tbody>
              {filteredPurchaseOrders.length ? (
                filteredPurchaseOrders.map((row, index) => {
                  const poReceiptMeta = purchaseOrderReceiptMetaByPoId.get(row.poId) || {
                    receiptCount: 0,
                    allSettled: false,
                  }

                  return (
                    <tr
                      key={row.poId}
                    onClick={() =>
                      setActivePurchaseOrderId((current) => (current === row.poId ? '' : row.poId))
                    }
                    className="cursor-pointer transition"
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      backgroundColor:
                        row.poId === activePurchaseOrderId
                          ? 'color-mix(in srgb, var(--color-primary) 7%, white)'
                          : undefined,
                    }}
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold">{row.poCode}</div>
                      <div className="app-muted mt-1 text-xs">{row.lineCount} dòng</div>
                    </td>
                    <td className="px-4 py-4">{row.vendorName || 'Chưa chọn NCC'}</td>
                    <td className="px-4 py-4 text-right font-semibold">{formatNumber(row.totalOrderedQty)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(row.totalReceivedQty)}</td>
                    <td className="px-4 py-4 text-right">{formatNumber(row.receiptBatchCount)}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold">{row.workflowLabel}</div>
                    </td>
                    <td className="px-4 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                      {isWarehouseWorkspace || isAccountingWorkspace ? (
                        <div className="relative inline-flex" ref={purchaseOrderMenuId === row.poId ? purchaseOrderMenuRef : null}>
                          <button
                            type="button"
                            aria-label="Mở thao tác phiếu mua"
                            className="inline-flex h-9 items-center justify-center px-2 text-lg leading-none app-muted hover:text-slate-900"
                            onClick={() =>
                              setPurchaseOrderMenuId((current) => (current === row.poId ? '' : row.poId))
                            }
                          >
                            ...
                          </button>

                          {purchaseOrderMenuId === row.poId ? (
                            <div
                              className={`absolute right-0 z-20 min-w-48 overflow-hidden rounded-xl border bg-white shadow-lg ${
                                index >= filteredPurchaseOrders.length - 2 ? 'bottom-11' : 'top-11'
                              }`}
                              style={{ borderColor: 'var(--color-border)' }}
                            >
                              {isWarehouseWorkspace && row.status !== 'XAC_NHAN_MOT_PHAN' && row.status !== 'DA_NHAN_DU' ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-slate-50"
                                  onClick={async () => {
                                    setPurchaseOrderMenuId('')
                                    await handleCreateReceipt(row.poId)
                                  }}
                                >
                                  Tạo phiếu nhập
                                </button>
                              ) : null}
                              {isAccountingWorkspace && row.status !== 'XAC_NHAN_MOT_PHAN' && row.status !== 'DA_NHAN_DU' ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
                                  disabled={!poReceiptMeta.allSettled}
                                  title={
                                    poReceiptMeta.allSettled
                                      ? 'Kết thúc đơn'
                                      : 'Cần KTMH chốt hết các đợt nhập của phiếu mua trước khi kết thúc đơn.'
                                  }
                                  onClick={async () => {
                                    if (!poReceiptMeta.allSettled) return
                                    setPurchaseOrderMenuId('')
                                    await handleFinishReceiving(row.poId)
                                  }}
                                >
                                  Kết thúc đơn
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center app-muted">
                    {props.pageData.savedPurchaseOrderRows.length
                      ? 'Không có phiếu mua nào khớp với bộ lọc hiện tại.'
                      : 'Chưa có phiếu mua nào được tạo từ đề xuất.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {poMessage ? (
          <div
            className="mt-3 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, #16a34a 10%, white)',
              color: '#166534',
            }}
          >
            {poMessage}
          </div>
        ) : null}
        {poError ? (
          <div
            className="mt-3 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, #dc2626 10%, white)',
              color: '#991b1b',
            }}
          >
            {poError}
          </div>
        ) : null}

        {isWarehouseWorkspace ? (
          <div
            className="mt-5 border-t bg-white"
            style={{
              borderColor: 'var(--color-border)',
            }}
          >
            {activePurchaseOrder ? (
              <>
                <div className="border-b px-4 pb-4 pt-4" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}>
                  <div
                    className="overflow-auto border-y bg-white"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col style={{ width: '52%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                      </colgroup>
                      <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>
                        <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                          <th className="sticky top-0 z-10 px-5 py-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>NVL</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL duyệt</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL thực nhập</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL đạt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePurchaseOrder.lines.map((line) => (
                          <tr key={line.poLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <td className="px-5 py-4">
                              <div className="font-medium">{line.materialName || '-'}</div>
                              <div className="app-muted mt-1 font-mono text-xs">{line.materialCode || '-'}</div>
                            </td>
                            <td className="px-5 py-4 text-right font-semibold">{formatNumber(line.orderedQty)}</td>
                            <td className="px-5 py-4 text-right">{formatNumber(line.actualReceivedQty)}</td>
                            <td className="px-5 py-4 text-right">{formatNumber(line.acceptedQty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-4">
                  <div
                    className="overflow-auto border-y bg-white"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col style={{ width: '52%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                      </colgroup>
                      <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>
                        <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                          <th className="sticky top-0 z-10 px-5 py-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>Phiếu nhập</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>Đợt</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL nhận</th>
                          <th className="sticky top-0 z-10 whitespace-nowrap px-4 py-3 tracking-[0.16em]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePurchaseOrderReceipts.length ? (
                          activePurchaseOrderReceipts.map((row) => (
                            <tr
                              key={row.receiptId}
                              onClick={() => openInlineReceipt(row.receiptId)}
                              className="cursor-pointer transition hover:bg-slate-50"
                              style={{
                                borderTop: '1px solid var(--color-border)',
                                backgroundColor:
                                  row.receiptId === activeReceiptId
                                    ? 'color-mix(in srgb, var(--color-primary) 6%, white)'
                                    : undefined,
                              }}
                            >
                              <td className="px-5 py-4">
                                <div className="font-semibold">{row.receiptCode}</div>
                              </td>
                              <td className="px-5 py-4 text-right">{row.batchNo}</td>
                              <td className="px-5 py-4 text-right">{formatNumber(row.totalReceivedQty)}</td>
                              <td className="px-5 py-4">
                                <div className="font-medium">{formatReceiptStatus(row.status)}</div>
                                <div className="app-muted mt-1 text-xs">
                                  {row.movementRecorded ? 'Đã ghi nhập kho' : 'Chưa ghi nhập kho'}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-5 py-6 text-center app-muted">
                              PO này chưa có đợt nhập nào.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {activeReceiptLoading ? (
                  <div
                    className="border-t px-5 py-5 text-sm app-muted"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}
                  >
                    Đang mở phiếu nhập...
                  </div>
                ) : null}

                {activeReceiptDetail ? (
                  <div style={{ borderTop: '1px solid color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}>
                    {activeReceiptMessage ? (
                      <div
                        className="border-t px-5 py-3 text-sm"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: 'color-mix(in srgb, #16a34a 10%, white)',
                          color: '#166534',
                        }}
                      >
                        {activeReceiptMessage}
                      </div>
                    ) : null}

                    {activeReceiptError ? (
                      <div
                        className="border-t px-5 py-3 text-sm"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: 'color-mix(in srgb, #dc2626 10%, white)',
                          color: '#991b1b',
                        }}
                      >
                        {activeReceiptError}
                      </div>
                    ) : null}

                    <div className="px-4 pb-4 pt-4">
                      <div
                        className="overflow-auto border-y bg-white"
                        style={{
                          borderColor: 'var(--color-border)',
                        }}
                    >
                        <table className="min-w-full table-fixed text-sm">
                        <colgroup>
                          <col style={{ width: '40%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '16%' }} />
                        </colgroup>
                        <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>
                          <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                            <th className="sticky top-0 z-10 px-5 py-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>NVL</th>
                            <th className="sticky top-0 z-10 px-5 py-3 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL ĐVT</th>
                            <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL đặt</th>
                            <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL nhận</th>
                            <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL đạt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeReceiptDetail.lines.map((line) => {
                            const current = activeReceiptLines[line.receiptLineId] || {
                              receivedQty: String(line.receivedQty || 0),
                              acceptedQty: String(line.acceptedQty || 0),
                              defectiveQty: String(line.defectiveQty || 0),
                            }

                            return (
                              <tr key={line.receiptLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                                <td className="px-5 py-4">
                                  <div className="font-semibold">{line.materialName}</div>
                                  <div className="app-muted mt-1 text-xs">
                                    {line.materialCode}
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-center">{line.unit || '-'}</td>
                                <td className="px-5 py-4 text-right">{formatNumber(line.orderedQty)}</td>
                                <td className="px-5 py-4 text-right">
                                  <input
                                    className="w-24 rounded-lg border px-3 py-2 text-right"
                                    style={{ borderColor: 'var(--color-border)' }}
                                    disabled={activeReceiptMovementRecorded}
                                    value={current.receivedQty}
                                    onChange={(event) => {
                                      const nextReceivedQty = event.target.value
                                      const shouldSyncAcceptedQty = current.acceptedQty === current.receivedQty
                                      setActiveReceiptLines((prev) => ({
                                        ...prev,
                                        [line.receiptLineId]: {
                                          ...current,
                                          receivedQty: nextReceivedQty,
                                          acceptedQty: shouldSyncAcceptedQty ? nextReceivedQty : current.acceptedQty,
                                        },
                                      }))
                                    }}
                                  />
                                </td>
                                <td className="px-5 py-4 text-right">
                                  <input
                                    className="w-24 rounded-lg border px-3 py-2 text-right"
                                    style={{ borderColor: 'var(--color-border)' }}
                                    disabled={activeReceiptMovementRecorded}
                                    value={current.acceptedQty}
                                    onChange={(event) =>
                                      setActiveReceiptLines((prev) => ({
                                        ...prev,
                                        [line.receiptLineId]: { ...current, acceptedQty: event.target.value },
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
                    </div>

                    <div
                      className="flex justify-end border-t px-5 py-4"
                      style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}
                    >
                      <button
                        type="button"
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                        disabled={activeReceiptPrimaryAction.disabled}
                        onClick={handleActiveReceiptPrimaryAction}
                      >
                        {activeReceiptPrimaryAction.label}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="px-5 py-5 text-sm app-muted">Chọn một phiếu mua ở bảng trên để xem chi tiết và thao tác.</div>
            )}
          </div>
        ) : isAccountingWorkspace ? (
          <div
            className="mt-5 border-t bg-white"
            style={{
              borderColor: 'var(--color-border)',
            }}
          >
            {activePurchaseOrder ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}>
                  <div className="app-muted text-sm">
                    {activePurchaseOrder.status === 'XAC_NHAN_MOT_PHAN'
                      ? activePurchaseOrderAllReceiptsSettled
                        ? 'PO này đã được kết thúc và mọi đợt nhập đều đã được KTMH chốt.'
                        : 'PO này đã được kết thúc, nhưng KTMH vẫn cần chốt hết các đợt nhập trước khi xác nhận cuối.'
                      : 'KTMH theo dõi các đợt nhận tại đây. Nếu cần dừng nhận thêm cho PO này, dùng menu ba chấm để kết thúc đơn.'}
                  </div>
                  {activePurchaseOrder.status === 'XAC_NHAN_MOT_PHAN' ? (
                    <button
                      type="button"
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                      disabled={pendingPoId === activePurchaseOrder.poId || !activePurchaseOrderAllReceiptsSettled}
                      onClick={() => setFinalizePoId(activePurchaseOrder.poId)}
                    >
                      {pendingPoId === activePurchaseOrder.poId && finalizePoId === activePurchaseOrder.poId
                        ? 'Đang mở...'
                        : 'Xác nhận cuối'}
                    </button>
                  ) : null}
                </div>

                <div className="border-b px-4 pb-4 pt-4" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}>
                  <div
                    className="overflow-auto border-y bg-white"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col style={{ width: '52%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                      </colgroup>
                      <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>
                        <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                          <th className="sticky top-0 z-10 px-5 py-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>NVL</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL duyệt</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL thực nhập</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL đạt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePurchaseOrder.lines.map((line) => (
                          <tr key={line.poLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <td className="px-5 py-4">
                              <div className="font-medium">{line.materialName || '-'}</div>
                              <div className="app-muted mt-1 font-mono text-xs">{line.materialCode || '-'}</div>
                            </td>
                            <td className="px-5 py-4 text-right font-semibold">{formatNumber(line.orderedQty)}</td>
                            <td className="px-5 py-4 text-right">{formatNumber(line.actualReceivedQty)}</td>
                            <td className="px-5 py-4 text-right">{formatNumber(line.acceptedQty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-4">
                  <div
                    className="overflow-auto rounded-[18px] border bg-white"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-border) 92%, white)' }}
                  >
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col style={{ width: '38%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '18%' }} />
                      </colgroup>
                      <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>
                        <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                          <th className="sticky top-0 z-10 px-5 py-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>Phiếu nhập</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>Đợt</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL nhận</th>
                          <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL đạt</th>
                          <th className="sticky top-0 z-10 whitespace-nowrap px-5 py-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePurchaseOrderReceipts.length ? (
                          activePurchaseOrderReceipts.map((row) => (
                            <tr
                              key={row.receiptId}
                              onClick={() => openInlineReceipt(row.receiptId)}
                              className="cursor-pointer transition hover:bg-slate-50"
                              style={{
                                borderTop: '1px solid var(--color-border)',
                                backgroundColor:
                                  row.receiptId === activeReceiptId
                                    ? 'color-mix(in srgb, var(--color-primary) 6%, white)'
                                    : undefined,
                              }}
                            >
                              <td className="px-5 py-4 font-semibold">{row.receiptCode}</td>
                              <td className="px-5 py-4 text-right">{row.batchNo}</td>
                              <td className="px-5 py-4 text-right">{formatNumber(row.totalReceivedQty)}</td>
                              <td className="px-5 py-4 text-right">{formatNumber(row.totalAcceptedQty)}</td>
                              <td className="px-5 py-4">
                                <div className="font-medium">{formatReceiptStatus(row.status)}</div>
                                <div className="app-muted mt-1 text-xs">
                                  {row.settlementStatus === 'DA_CHOT'
                                    ? 'KTMH đã chốt đợt'
                                    : row.movementRecorded
                                      ? 'Chờ KTMH chốt đợt'
                                      : 'Chưa ghi nhập kho'}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-5 py-6 text-center app-muted">
                              PO này chưa có đợt nhập nào.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {activeReceiptLoading ? (
                  <div
                    className="border-t px-5 py-5 text-sm app-muted"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}
                  >
                    Đang mở đợt nhận hàng...
                  </div>
                ) : null}

                {activeReceiptDetail ? (
                  <div style={{ borderTop: '1px solid color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}>
                    {activeReceiptMessage ? (
                      <div
                        className="border-t px-5 py-3 text-sm"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: 'color-mix(in srgb, #16a34a 10%, white)',
                          color: '#166534',
                        }}
                      >
                        {activeReceiptMessage}
                      </div>
                    ) : null}

                    {activeReceiptError ? (
                      <div
                        className="border-t px-5 py-3 text-sm"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: 'color-mix(in srgb, #dc2626 10%, white)',
                          color: '#991b1b',
                        }}
                      >
                        {activeReceiptError}
                      </div>
                    ) : null}

                    <div className="border-b px-4 py-4" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <select
                          value={activeReceiptFinalizeVendorName}
                          onChange={(event) => setActiveReceiptFinalizeVendorName(event.target.value)}
                          className="rounded-xl border px-3 py-2 text-sm"
                          style={{ borderColor: 'var(--color-border)' }}
                          disabled={activeReceiptSettlementLocked}
                        >
                          <option value="">Chọn NCC cho phiếu mua của đợt này</option>
                          {vendorOptions.map((option) => (
                            <option key={option.value} value={option.label}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                          Tổng SL tính tiền: <span className="font-semibold">{formatNumber(activeReceiptFinalizeTotals.billedQty)}</span>
                        </div>
                        <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                          Giá trị đợt: <span className="font-semibold">{formatNumber(activeReceiptFinalizeTotals.totalAmount)}</span>
                        </div>
                      </div>
                      <div className="app-muted mt-3 text-sm">
                        {activeReceiptSettlementLocked
                          ? 'Đợt này đã được KTMH chốt. Số liệu công nợ của đợt đã khóa.'
                          : activeReceiptMovementRecorded
                            ? 'Thủ kho đã ghi sổ. KTMH chọn NCC, nhập SL tính tiền và đơn giá để lập phiếu mua cho riêng đợt này.'
                            : 'Đợt này chưa được Thủ kho ghi sổ, nên KTMH chưa thể chốt công nợ.'}
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-4">
                      <div
                        className="overflow-auto rounded-[18px] border bg-white"
                        style={{
                          borderColor: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-border))',
                          boxShadow: '0 0 0 3px color-mix(in srgb, var(--color-primary) 4%, white)',
                        }}
                      >
                        <table className="min-w-full table-fixed text-sm">
                          <colgroup>
                            <col style={{ width: '34%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '14%' }} />
                            <col style={{ width: '14%' }} />
                          </colgroup>
                          <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>
                            <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                              <th className="sticky top-0 z-10 px-5 py-3" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>NVL</th>
                              <th className="sticky top-0 z-10 px-5 py-3 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>ĐVT</th>
                              <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL nhận</th>
                              <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL đạt</th>
                              <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>SL tính tiền</th>
                              <th className="sticky top-0 z-10 px-5 py-3 text-right" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>Đơn giá</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeReceiptSettlementLines.map((line) => {
                              const current = activeReceiptFinalizeLines[line.receiptLineId] || {
                                billedQty: String(line.billedQty || line.receivedQty || 0),
                                unitPrice: String(line.unitPrice || 0),
                              }

                              return (
                                <tr key={line.receiptLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                                  <td className="px-5 py-4">
                                    <div className="font-semibold">{line.materialName}</div>
                                    <div className="app-muted mt-1 text-xs">{line.materialCode}</div>
                                  </td>
                                  <td className="px-5 py-4 text-center">{line.unit || '-'}</td>
                                  <td className="px-5 py-4 text-right">{formatNumber(line.receivedQty)}</td>
                                  <td className="px-5 py-4 text-right">{formatNumber(line.acceptedQty)}</td>
                                  <td className="px-5 py-4 text-right">
                                    <input
                                      className="w-24 rounded-lg border px-3 py-2 text-right"
                                      style={{ borderColor: 'var(--color-border)' }}
                                      disabled={!activeReceiptMovementRecorded || activeReceiptSettlementLocked}
                                      value={current.billedQty}
                                      onChange={(event) =>
                                        setActiveReceiptFinalizeLines((prev) => ({
                                          ...prev,
                                          [line.receiptLineId]: { ...current, billedQty: event.target.value },
                                        }))
                                      }
                                    />
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <input
                                      className="w-28 rounded-lg border px-3 py-2 text-right"
                                      style={{ borderColor: 'var(--color-border)' }}
                                      disabled={!activeReceiptMovementRecorded || activeReceiptSettlementLocked}
                                      value={current.unitPrice}
                                      onChange={(event) =>
                                        setActiveReceiptFinalizeLines((prev) => ({
                                          ...prev,
                                          [line.receiptLineId]: { ...current, unitPrice: event.target.value },
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
                    </div>

                    <div
                      className="flex justify-end border-t px-5 py-4"
                      style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-border))' }}
                    >
                      <button
                        type="button"
                        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                        disabled={
                          activeReceiptSettlementLocked ||
                          !activeReceiptMovementRecorded ||
                          activeReceiptFinalizing ||
                          !String(activeReceiptFinalizeVendorName || '').trim()
                        }
                        onClick={handleFinalizeActiveReceipt}
                      >
                        {activeReceiptSettlementLocked
                          ? 'Đã chốt đợt'
                          : activeReceiptFinalizing
                            ? 'Đang chốt...'
                            : 'KTMH chốt đợt'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="px-5 py-5 text-sm app-muted">Chọn một phiếu mua ở bảng trên để xem chi tiết và các đợt nhận.</div>
            )}
          </div>
        ) : null}

        {isPurchaseRole && finalizePoId ? (
          <div
            className="mt-5 rounded-2xl border p-4"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">KTMH xác nhận cuối phiếu mua</div>
                <div className="app-muted mt-1 text-sm">
                  Ở bước này KTMH chỉ khóa PO sau khi mọi đợt nhập đã được chốt. Số lượng tính tiền và đơn giá đã lấy từ từng đợt nhập.
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--color-border)' }}
                onClick={() => setFinalizePoId('')}
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                value={finalizeVendorId}
                onChange={(event) => setFinalizeVendorId(event.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="">Chọn nhà cung cấp</option>
                {vendorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                Tổng SL thực nhập: <span className="font-semibold">{formatNumber(finalizeTotals.actualReceivedQty)}</span>
              </div>
              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                Tổng bill tạm tính: <span className="font-semibold">{formatNumber(finalizeTotals.totalAmount)}</span>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                  <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                    <th className="px-4 py-3">NVL</th>
                    <th className="px-4 py-3 text-right">SL duyệt</th>
                    <th className="px-4 py-3 text-right">SL thực nhập</th>
                    <th className="px-4 py-3 text-right">% hao hụt</th>
                    <th className="px-4 py-3 text-right">SL tính tiền</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-4 py-3 text-right">Chênh lệch</th>
                    <th className="px-4 py-3">Phân loại</th>
                  </tr>
                </thead>
                <tbody>
                  {finalizeLines.map((line) => {
                    const varianceQty = line.billedQty - line.actualReceivedQty
                    const variancePct = line.billedQty > 0 ? (Math.abs(varianceQty) / line.billedQty) * 100 : 0
                    const disposition =
                      Math.abs(varianceQty) <= 0.0001
                        ? 'Không chênh lệch'
                        : variancePct <= line.haoHutPct
                          ? 'Chi phí doanh nghiệp'
                          : 'Chi phí thất thoát'

                    return (
                      <tr key={line.poLineId} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td className="px-4 py-4">
                          <div className="font-semibold">{line.materialName}</div>
                          <div className="app-muted mt-1 text-xs">
                            {line.materialCode}
                            {line.unit ? ` · ${line.unit}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">{formatNumber(line.orderedQty)}</td>
                        <td className="px-4 py-4 text-right">{formatNumber(line.actualReceivedQty)}</td>
                        <td className="px-4 py-4 text-right">{formatNumber(line.haoHutPct)}%</td>
                        <td className="px-4 py-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={String(line.billedQty)}
                            disabled
                            onChange={(event) => handleFinalizeLineChange(line.poLineId, 'billedQty', event.target.value)}
                            className="w-28 rounded-xl border px-3 py-2 text-right text-sm"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={String(line.unitPrice)}
                            disabled
                            onChange={(event) => handleFinalizeLineChange(line.poLineId, 'unitPrice', event.target.value)}
                            className="w-28 rounded-xl border px-3 py-2 text-right text-sm"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="px-4 py-4 text-right">
                          {formatNumber(varianceQty)} ({formatNumber(variancePct)}%)
                        </td>
                        <td className="px-4 py-4">{disposition}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary)' }}
                disabled={pendingPoId === finalizePoId}
                onClick={handleFinalizePurchaseOrder}
              >
                {pendingPoId === finalizePoId ? 'Đang xác nhận...' : 'Khóa PO'}
              </button>
              <div className="app-muted self-center text-sm">
                Bước này chỉ khóa tổng PO sau khi các đợt nhập đã được KTMH chốt riêng lẻ.
              </div>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

    </div>
  )
}
