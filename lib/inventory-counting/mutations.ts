import {
  approveInventoryCountAndPostMovements,
  confirmInventoryCountByWarehouse,
  createInventoryCountSheetDraft,
  saveInventoryCountDraft,
} from '@/lib/inventory-counting/repository'
import type { InventoryCountDraftLine, InventoryCountType } from '@/lib/inventory-counting/types'

type AnySupabase = Parameters<typeof createInventoryCountSheetDraft>[0]['supabase']

export type CreateInventoryCountSheetBody = {
  countType?: InventoryCountType
  countDate?: string
  note?: string
  rows?: Array<{
    id?: string
    itemType?: InventoryCountDraftLine['itemType']
    itemId?: string
    itemCode?: string
    itemName?: string
    itemGroup?: string
    unit?: string
    systemQty?: number
    countedQty?: number
    allowedLossPct?: number
    note?: string
  }>
}

export type SaveInventoryCountDraftBody = {
  note?: string
  lines?: Array<{
    countLineId?: string
    countedQty?: number
    note?: string
  }>
}

export type ConfirmInventoryCountBody = {
  countSheetId?: string
}

export type ApproveInventoryCountBody = {
  countSheetId?: string
}

export async function executeCreateInventoryCountSheetMutation(input: {
  supabase: AnySupabase
  userId: string
  body: CreateInventoryCountSheetBody
}) {
  const rows: InventoryCountDraftLine[] = Array.isArray(input.body.rows)
    ? input.body.rows.map((row, index) => {
        const systemQty = Number(row.systemQty || 0)
        const countedQty = Number(row.countedQty || 0)
        const varianceQty = countedQty - systemQty
        const variancePct = systemQty === 0 ? 0 : (varianceQty / systemQty) * 100
        return {
          id: String(row.id || `count-line-${index + 1}`),
          itemType:
            row.itemType === 'FINISHED_GOOD' || row.itemType === 'TOOL' || row.itemType === 'ASSET'
              ? row.itemType
              : 'NVL',
          itemId: String(row.itemId || '').trim(),
          itemCode: String(row.itemCode || '').trim(),
          itemName: String(row.itemName || '').trim(),
          itemGroup: String(row.itemGroup || '').trim(),
          unit: String(row.unit || '').trim(),
          systemQty: Number.isFinite(systemQty) ? systemQty : 0,
          countedQty: Number.isFinite(countedQty) ? countedQty : 0,
          varianceQty: Number.isFinite(varianceQty) ? varianceQty : 0,
          variancePct: Number.isFinite(variancePct) ? variancePct : 0,
          allowedLossPct: Number(row.allowedLossPct || 0),
          note: String(row.note || '').trim(),
        }
      })
    : []

  return createInventoryCountSheetDraft({
    supabase: input.supabase,
    userId: input.userId,
    countType: input.body.countType === 'OPENING_BALANCE' ? 'OPENING_BALANCE' : 'OPERATIONAL',
    countDate: String(input.body.countDate || '').trim(),
    note: String(input.body.note || '').trim(),
    rows,
  })
}

export async function executeSaveInventoryCountDraftMutation(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
  body: SaveInventoryCountDraftBody
}) {
  return saveInventoryCountDraft({
    supabase: input.supabase,
    userId: input.userId,
    countSheetId: input.countSheetId,
    note: String(input.body.note || '').trim(),
    lines: Array.isArray(input.body.lines)
      ? input.body.lines.map((line) => ({
          countLineId: String(line.countLineId || '').trim(),
          countedQty: Number(line.countedQty || 0),
          note: String(line.note || '').trim(),
        }))
      : [],
  })
}

export async function executeConfirmInventoryCountMutation(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
  body: ConfirmInventoryCountBody
}) {
  return confirmInventoryCountByWarehouse({
    supabase: input.supabase,
    userId: input.userId,
    countSheetId: input.countSheetId,
  })
}

export async function executeApproveInventoryCountMutation(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
  body: ApproveInventoryCountBody
}) {
  return approveInventoryCountAndPostMovements({
    supabase: input.supabase,
    userId: input.userId,
    countSheetId: input.countSheetId,
  })
}
