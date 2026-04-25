import {
  approveBaoGiaProduction,
  transitionBaoGiaStatus,
  type BaoGiaStatus,
} from '@/lib/bao-gia/repository'

type AnySupabase = Parameters<typeof transitionBaoGiaStatus>[0]

export type BaoGiaStatusMutationBody = {
  status?: BaoGiaStatus
  action?: 'APPROVE_PRODUCTION'
  note?: string
}

export async function executeBaoGiaStatusMutation(input: {
  supabase: AnySupabase
  quoteId: string
  userId: string
  body: BaoGiaStatusMutationBody
}) {
  return input.body.action === 'APPROVE_PRODUCTION'
    ? approveBaoGiaProduction(input.supabase, {
        quoteId: input.quoteId,
        userId: input.userId,
        note: input.body.note,
      })
    : transitionBaoGiaStatus(input.supabase, {
        quoteId: input.quoteId,
        userId: input.userId,
        status: String(input.body.status || '') as BaoGiaStatus,
        note: input.body.note,
      })
}
