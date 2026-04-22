import {
  approveFinishedGoodsCountAndApply,
  confirmFinishedGoodsCountByWarehouse,
  createFinishedGoodsCountSheetDraft,
  saveFinishedGoodsCountDraft,
} from '@/lib/finished-goods-counting/repository'

type AnySupabase = Parameters<typeof createFinishedGoodsCountSheetDraft>[0]['supabase']

export type CreateFinishedGoodsCountSheetBody = {
  countType?: 'VAN_HANH' | 'TON_DAU_KY'
  countDate?: string
  note?: string
  rows?: Array<{
    id?: string
    itemKey?: string
    itemLabel?: string
    loaiCoc?: string
    tenDoan?: string
    chieuDaiM?: number
    systemQty?: number
    note?: string
    openingQty?: number
    qualityStatus?: 'DAT' | 'LOI'
    locationId?: string
  }>
}

export type SaveFinishedGoodsCountDraftBody = {
  note?: string
  lines?: Array<{
    countLineId?: string
    note?: string
    unexpectedFoundDatQty?: number
    unexpectedFoundLoiQty?: number
    serialRows?: Array<{
      countSerialId?: string
      countStatus?: 'COUNTED' | 'MISSING_IN_COUNT' | 'UNEXPECTED_FOUND' | 'WRONG_LOCATION'
      qualityProposal?: 'DAT' | 'LOI' | 'HUY'
      note?: string
    }>
  }>
}

export async function executeCreateFinishedGoodsCountSheetMutation(input: {
  supabase: AnySupabase
  userId: string
  body: CreateFinishedGoodsCountSheetBody
}) {
  return createFinishedGoodsCountSheetDraft({
    supabase: input.supabase,
    userId: input.userId,
    countType: input.body.countType === 'TON_DAU_KY' ? 'TON_DAU_KY' : 'VAN_HANH',
    countDate: String(input.body.countDate || '').trim(),
    note: String(input.body.note || '').trim(),
    rows: Array.isArray(input.body.rows)
      ? input.body.rows.map((row, index) => ({
          id: String(row.id || `fg-count-line-${index + 1}`),
          itemKey: String(row.itemKey || '').trim(),
          itemLabel: String(row.itemLabel || '').trim(),
          loaiCoc: String(row.loaiCoc || '').trim(),
          tenDoan: String(row.tenDoan || '').trim(),
          chieuDaiM: Number(row.chieuDaiM || 0),
          systemQty: Number(row.systemQty || 0),
          note: String(row.note || '').trim(),
          openingQty: Number(row.openingQty || 0),
          qualityStatus: row.qualityStatus === 'LOI' ? 'LOI' : 'DAT',
          locationId: String(row.locationId || '').trim(),
        }))
      : [],
  })
}

export async function executeSaveFinishedGoodsCountDraftMutation(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
  body: SaveFinishedGoodsCountDraftBody
}) {
  return saveFinishedGoodsCountDraft({
    supabase: input.supabase,
    userId: input.userId,
    countSheetId: input.countSheetId,
    note: String(input.body.note || '').trim(),
    lines: Array.isArray(input.body.lines)
      ? input.body.lines.map((line) => ({
          countLineId: String(line.countLineId || '').trim(),
          note: String(line.note || '').trim(),
          unexpectedFoundDatQty: Number(line.unexpectedFoundDatQty || 0),
          unexpectedFoundLoiQty: Number(line.unexpectedFoundLoiQty || 0),
          serialRows: Array.isArray(line.serialRows)
            ? line.serialRows.map((serialRow) => ({
                countSerialId: String(serialRow.countSerialId || '').trim(),
                countStatus:
                  serialRow.countStatus === 'MISSING_IN_COUNT' ||
                  serialRow.countStatus === 'UNEXPECTED_FOUND' ||
                  serialRow.countStatus === 'WRONG_LOCATION'
                    ? serialRow.countStatus
                    : 'COUNTED',
                qualityProposal: serialRow.qualityProposal === 'LOI' || serialRow.qualityProposal === 'HUY' ? serialRow.qualityProposal : 'DAT',
                note: String(serialRow.note || '').trim(),
              }))
            : [],
        }))
      : [],
  })
}

export async function executeConfirmFinishedGoodsCountMutation(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
}) {
  return confirmFinishedGoodsCountByWarehouse({
    supabase: input.supabase,
    userId: input.userId,
    countSheetId: input.countSheetId,
  })
}

export async function executeApproveFinishedGoodsCountMutation(input: {
  supabase: AnySupabase
  userId: string
  countSheetId: string
}) {
  return approveFinishedGoodsCountAndApply({
    supabase: input.supabase,
    userId: input.userId,
    countSheetId: input.countSheetId,
  })
}
