import { transitionDonHang } from '@/lib/don-hang/repository'

type AnySupabase = Parameters<typeof transitionDonHang>[0]

export type DonHangTransitionRequestBody = {
  toState: string
  note?: string
}

export async function executeDonHangTransitionMutation(input: {
  supabase: AnySupabase
  orderId: string
  userId: string
  userRole: string
  body: DonHangTransitionRequestBody
}) {
  return transitionDonHang(input.supabase, {
    orderId: input.orderId,
    userId: input.userId,
    userRole: input.userRole,
    toState: String(input.body.toState || ''),
    note: input.body.note,
  })
}
