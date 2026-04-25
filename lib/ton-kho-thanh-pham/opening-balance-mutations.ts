import { createOpeningBalanceLotAndSerials } from '@/lib/pile-serial/repository'

type AnySupabase = Parameters<typeof createOpeningBalanceLotAndSerials>[0]

export type CreateFinishedGoodsOpeningBalanceBody = {
  openingDate?: string
  templateId?: string
  maCoc?: string
  loaiCoc?: string
  tenDoan?: string
  chieuDaiM?: number
  quantity?: number
  qualityStatus?: 'DAT' | 'LOI'
  locationId?: string
  note?: string
}

export async function executeCreateFinishedGoodsOpeningBalanceMutation(input: {
  supabase: AnySupabase
  userId: string
  body: CreateFinishedGoodsOpeningBalanceBody
}) {
  return createOpeningBalanceLotAndSerials(input.supabase, {
    openingDate: String(input.body.openingDate || '').trim(),
    templateId: String(input.body.templateId || '').trim(),
    maCoc: String(input.body.maCoc || '').trim(),
    loaiCoc: String(input.body.loaiCoc || '').trim(),
    tenDoan: String(input.body.tenDoan || '').trim(),
    chieuDaiM: Number(input.body.chieuDaiM || 0),
    quantity: Number(input.body.quantity || 0),
    qualityStatus: input.body.qualityStatus === 'LOI' ? 'LOI' : 'DAT',
    locationId: String(input.body.locationId || '').trim() || null,
    note: String(input.body.note || '').trim(),
    createdBy: input.userId,
  })
}
