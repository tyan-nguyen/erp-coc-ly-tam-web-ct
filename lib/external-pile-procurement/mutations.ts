import {
  approveExternalPilePurchaseRequest,
  createExternalPilePurchaseRequest,
  receiveExternalPilePurchaseOrder,
} from '@/lib/external-pile-procurement/repository'
import type { ExternalPileLineDraft } from '@/lib/external-pile-procurement/types'

type AnySupabase = Parameters<typeof createExternalPilePurchaseRequest>[0]['supabase']

export type CreateExternalPileRequestBody = {
  note?: string
  lines?: ExternalPileLineDraft[]
}

export type ApproveExternalPileRequestBody = {
  vendorId?: string
  vendorName?: string
  expectedDate?: string
  note?: string
  lines?: Array<{ requestLineId?: string; orderedQty?: number }>
}

export type ReceiveExternalPileOrderBody = {
  receiveDate?: string
  note?: string
  items?: Array<{ poLineId?: string; receiveQty?: number }>
}

export async function executeCreateExternalPileRequestMutation(input: {
  supabase: AnySupabase
  userId: string
  body: CreateExternalPileRequestBody
}) {
  return createExternalPilePurchaseRequest({
    supabase: input.supabase,
    userId: input.userId,
    note: input.body.note,
    lines: Array.isArray(input.body.lines) ? input.body.lines : [],
  })
}

export async function executeApproveExternalPileRequestMutation(input: {
  supabase: AnySupabase
  userId: string
  requestId: string
  body: ApproveExternalPileRequestBody
}) {
  return approveExternalPilePurchaseRequest({
    supabase: input.supabase,
    userId: input.userId,
    requestId: input.requestId,
    vendorId: String(input.body.vendorId || ''),
    vendorName: String(input.body.vendorName || ''),
    expectedDate: input.body.expectedDate,
    note: input.body.note,
    lines: Array.isArray(input.body.lines)
      ? input.body.lines.map((line) => ({
          requestLineId: String(line.requestLineId || ''),
          orderedQty: Number(line.orderedQty || 0),
        }))
      : [],
  })
}

export async function executeReceiveExternalPileOrderMutation(input: {
  supabase: AnySupabase
  userId: string
  poId: string
  body: ReceiveExternalPileOrderBody
}) {
  return receiveExternalPilePurchaseOrder({
    supabase: input.supabase,
    userId: input.userId,
    poId: input.poId,
    receiveDate: String(input.body.receiveDate || ''),
    note: input.body.note,
    items: Array.isArray(input.body.items)
      ? input.body.items.map((item) => ({
          poLineId: String(item.poLineId || ''),
          receiveQty: Number(item.receiveQty || 0),
        }))
      : [],
  })
}
