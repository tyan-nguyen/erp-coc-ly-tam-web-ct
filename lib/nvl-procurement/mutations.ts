import { createPurchaseRequestDraft } from '@/lib/nvl-procurement/purchase-request-repository'
import {
  createPurchaseOrderDraftFromRequest,
  createPurchaseOrderDraftFromSelection,
  finalizePurchaseOrder,
  finishPurchaseOrderReceiving,
} from '@/lib/nvl-procurement/purchase-order-repository'
import {
  confirmReceiptAndCreateStockMovements,
  createReceiptDraftFromPurchaseOrder,
  finalizeReceiptForPurchase,
} from '@/lib/nvl-procurement/receipt-repository'
import type { NvlProposalRow, NvlProposalSourceMode } from '@/lib/nvl-procurement/types'

type AnySupabase = Parameters<typeof createPurchaseRequestDraft>[0]['supabase']

export type CreatePurchaseRequestDraftBody = {
  note?: string
  sourceMode?: NvlProposalSourceMode
  rows?: Array<{
    id?: string
    materialCode?: string
    materialName?: string
    windowLabel?: string
    proposedQty?: number
    unit?: string
    planCount?: number
    sourceMode?: NvlProposalSourceMode
    basisLabel?: string
    urgencyLabel?: string
    status?: NvlProposalRow['status']
    reason?: string
    explanation?: string
  }>
}

export async function executeCreatePurchaseRequestDraftMutation(input: {
  supabase: AnySupabase
  userId: string
  body: CreatePurchaseRequestDraftBody
}) {
  const rows: NvlProposalRow[] = Array.isArray(input.body.rows)
    ? input.body.rows.map((row, index) => ({
        id: String(row.id || `${row.materialCode || 'line'}-${index + 1}`),
        materialCode: String(row.materialCode || '').trim(),
        materialName: String(row.materialName || '').trim(),
        windowLabel: String(row.windowLabel || '').trim(),
        proposedQty: Number(row.proposedQty || 0),
        unit: String(row.unit || '').trim(),
        planCount: Number(row.planCount || 0),
        sourceMode: row.sourceMode === 'FULL' ? 'FULL' : 'LIVE_DEMAND_ONLY',
        basisLabel: String(row.basisLabel || '').trim(),
        urgencyLabel: String(row.urgencyLabel || '').trim(),
        status:
          row.status === 'CHO_DUYET' ||
          row.status === 'DA_DUYET' ||
          row.status === 'TU_CHOI' ||
          row.status === 'DA_CHUYEN_DAT_HANG'
            ? row.status
            : 'DRAFT',
        reason: String(row.reason || '').trim(),
        explanation: String(row.explanation || '').trim(),
      }))
    : []

  return createPurchaseRequestDraft({
    supabase: input.supabase,
    userId: input.userId,
    note: input.body.note,
    sourceMode: input.body.sourceMode === 'FULL' ? 'FULL' : 'LIVE_DEMAND_ONLY',
    rows,
  })
}

export type CreatePurchaseOrderDraftBody = {
  requestId?: string
  vendorName?: string
  expectedDate?: string
  note?: string
  lines?: Array<{
    requestId?: string
    requestLineId?: string
    orderedQty?: number
  }>
}

export async function executeCreatePurchaseOrderDraftMutation(input: {
  supabase: AnySupabase
  userId: string
  body: CreatePurchaseOrderDraftBody
}) {
  const requestId = String(input.body.requestId || '').trim()

  const selectedLines = Array.isArray(input.body.lines)
    ? input.body.lines
        .map((line) => ({
          requestId: String(line.requestId || '').trim(),
          requestLineId: String(line.requestLineId || '').trim(),
          orderedQty: Number(line.orderedQty || 0),
        }))
        .filter((line) => line.requestLineId)
    : []

  if (selectedLines.length > 0 || String(input.body.vendorName || '').trim()) {
    return createPurchaseOrderDraftFromSelection({
      supabase: input.supabase,
      userId: input.userId,
      requestId,
      vendorName: String(input.body.vendorName || '').trim(),
      expectedDate: String(input.body.expectedDate || '').trim(),
      note: String(input.body.note || '').trim(),
      lines: selectedLines,
    })
  }

  if (!requestId) {
    throw new Error('Thiếu requestId để tạo draft PO NVL.')
  }

  return createPurchaseOrderDraftFromRequest({
    supabase: input.supabase,
    userId: input.userId,
    requestId,
  })
}

export type FinishPurchaseOrderBody = {
  poId?: string
}

export async function executeFinishPurchaseOrderMutation(input: {
  supabase: AnySupabase
  userId: string
  body: FinishPurchaseOrderBody
}) {
  const poId = String(input.body.poId || '').trim()
  if (!poId) {
    throw new Error('Thiếu poId để kết thúc nhập phiếu mua NVL.')
  }

  return finishPurchaseOrderReceiving({
    supabase: input.supabase,
    userId: input.userId,
    poId,
  })
}

export type FinalizePurchaseOrderBody = {
  poId?: string
  vendorName?: string
  lines?: Array<{
    poLineId?: string
    billedQty?: number
    unitPrice?: number
  }>
}

export async function executeFinalizePurchaseOrderMutation(input: {
  supabase: AnySupabase
  userId: string
  body: FinalizePurchaseOrderBody
}) {
  const poId = String(input.body.poId || '').trim()
  if (!poId) {
    throw new Error('Thiếu poId để KTMH xác nhận cuối phiếu mua NVL.')
  }

  return finalizePurchaseOrder({
    supabase: input.supabase,
    userId: input.userId,
    poId,
    vendorName: String(input.body.vendorName || '').trim(),
    lines: Array.isArray(input.body.lines)
      ? input.body.lines.map((line) => ({
          poLineId: String(line.poLineId || ''),
          billedQty: Number(line.billedQty || 0),
          unitPrice: Number(line.unitPrice || 0),
        }))
      : [],
  })
}

export type CreateReceiptDraftBody = {
  poId?: string
}

export async function executeCreateReceiptDraftMutation(input: {
  supabase: AnySupabase
  userId: string
  body: CreateReceiptDraftBody
}) {
  const poId = String(input.body.poId || '').trim()
  if (!poId) {
    throw new Error('Thiếu poId để tạo draft receipt NVL.')
  }

  return createReceiptDraftFromPurchaseOrder({
    supabase: input.supabase,
    userId: input.userId,
    poId,
  })
}

export type ConfirmReceiptMovementBody = {
  receiptId?: string
}

export async function executeConfirmReceiptMovementMutation(input: {
  supabase: AnySupabase
  userId: string
  body: ConfirmReceiptMovementBody
}) {
  const receiptId = String(input.body.receiptId || '').trim()
  if (!receiptId) {
    throw new Error('Thiếu receiptId để ghi stock movement NVL.')
  }

  return confirmReceiptAndCreateStockMovements({
    supabase: input.supabase,
    userId: input.userId,
    receiptId,
  })
}

export type FinalizeReceiptBody = {
  receiptId?: string
  vendorName?: string
  lines?: Array<{
    receiptLineId?: string
    billedQty?: number
    unitPrice?: number
  }>
}

export async function executeFinalizeReceiptMutation(input: {
  supabase: AnySupabase
  userId: string
  body: FinalizeReceiptBody
}) {
  const receiptId = String(input.body.receiptId || '').trim()
  if (!receiptId) {
    throw new Error('Thiếu receiptId để KTMH chốt đợt nhập.')
  }

  return finalizeReceiptForPurchase({
    supabase: input.supabase,
    userId: input.userId,
    receiptId,
    vendorName: String(input.body.vendorName || '').trim(),
    lines: Array.isArray(input.body.lines)
      ? input.body.lines.map((line) => ({
          receiptLineId: String(line.receiptLineId || ''),
          billedQty: Number(line.billedQty || 0),
          unitPrice: Number(line.unitPrice || 0),
        }))
      : [],
  })
}

export type SaveReceiptDraftBody = {
  note?: string
  lines?: Array<{
    receiptLineId?: string
    receivedQty?: number
    acceptedQty?: number
    defectiveQty?: number
    rejectedQty?: number
  }>
}

export async function executeSaveReceiptDraftMutation(input: {
  supabase: AnySupabase
  userId: string
  receiptId: string
  body: SaveReceiptDraftBody
}) {
  const { saveReceiptDraft } = await import('@/lib/nvl-procurement/receipt-repository')
  return saveReceiptDraft({
    supabase: input.supabase,
    userId: input.userId,
    receiptId: input.receiptId,
    note: input.body.note,
    lines: Array.isArray(input.body.lines)
      ? input.body.lines.map((line) => ({
          receiptLineId: String(line.receiptLineId || ''),
          receivedQty: Number(line.receivedQty || 0),
          acceptedQty: Number(line.acceptedQty || 0),
          defectiveQty: Number(line.defectiveQty || 0),
          rejectedQty: Number(line.rejectedQty || 0),
        }))
      : [],
  })
}
