import { saveBocTach, deleteBocTachHeaders, reopenBocTach } from '@/lib/boc-tach/repository'
import type { BocTachDetailPayload } from '@/lib/boc-tach/types'

type AnySupabase = Parameters<typeof saveBocTach>[0]

export type BocTachMutationAction = 'save' | 'send' | 'cancel' | 'approve' | 'return'

export type SaveBocTachMutationBody = {
  action: BocTachMutationAction
  payload: BocTachDetailPayload
}

export function normalizeBocTachMutationBody(input: {
  routeBocId: string
  body: SaveBocTachMutationBody
}) {
  return {
    action: input.body.action,
    payload: {
      ...input.body.payload,
      bocId:
        input.routeBocId === 'new'
          ? undefined
          : input.body.payload.bocId || input.routeBocId,
    } satisfies BocTachDetailPayload,
  }
}

export async function executeSaveBocTachMutation(input: {
  supabase: AnySupabase
  userId: string
  routeBocId: string
  body: SaveBocTachMutationBody
}) {
  const normalized = normalizeBocTachMutationBody({
    routeBocId: input.routeBocId,
    body: input.body,
  })

  return saveBocTach(input.supabase, input.userId, normalized.payload, normalized.action)
}

export async function executeBulkDeleteBocTachMutation(input: {
  supabase: AnySupabase
  ids: string[]
}) {
  if (input.ids.length === 0) {
    throw new Error('Chưa chọn hồ sơ để xóa.')
  }

  return deleteBocTachHeaders(input.supabase, input.ids)
}

export async function executeReopenBocTachMutation(input: {
  supabase: AnySupabase
  bocId: string
  userId: string
  userRole: string
}) {
  return reopenBocTach(input.supabase, {
    bocId: input.bocId,
    userId: input.userId,
    userRole: input.userRole,
  })
}
