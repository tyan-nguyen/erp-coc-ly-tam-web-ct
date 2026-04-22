import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessFinishedGoodsCount } from '@/lib/auth/roles'
import { loadFinishedGoodsCountDetail } from '@/lib/finished-goods-counting/repository'
import { FinishedGoodsCountDetailClient } from '@/components/ton-kho/finished-goods-count-detail-client'

export const dynamic = 'force-dynamic'

export default async function FinishedGoodsCountDetailPage(props: {
  params: Promise<{ count_sheet_id: string }>
}) {
  const { count_sheet_id: countSheetId } = await props.params
  const { profile } = await getCurrentSessionProfile()
  if (!canAccessFinishedGoodsCount(profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  let detail

  try {
    detail = await loadFinishedGoodsCountDetail({ supabase, countSheetId })
    if (!detail) redirect('/ton-kho/thanh-pham/kiem-ke')
  } catch (error) {
    const payload =
      error && typeof error === 'object'
        ? {
            code: 'code' in error ? (error as { code?: unknown }).code : undefined,
            message: 'message' in error ? (error as { message?: unknown }).message : String(error),
            hint: 'hint' in error ? (error as { hint?: unknown }).hint : undefined,
            details: 'details' in error ? (error as { details?: unknown }).details : undefined,
          }
        : { message: String(error) }
    console.error('Finished goods count detail load failed', payload)
    throw new Error(`Finished goods count detail load failed: ${JSON.stringify(payload)}`)
  }

  return (
    <div className="space-y-6">
      <FinishedGoodsCountDetailClient key={countSheetId} detail={detail} currentRole={profile.role} />
    </div>
  )
}
