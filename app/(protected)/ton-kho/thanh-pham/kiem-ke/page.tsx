import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessFinishedGoodsCount } from '@/lib/auth/roles'
import { FinishedGoodsCountPageClient } from '@/components/ton-kho/finished-goods-count-page-client'
import { loadFinishedGoodsCountingPageData } from '@/lib/finished-goods-counting/page-data'
import { loadFinishedGoodsOpeningBalancePageData } from '@/lib/ton-kho-thanh-pham/opening-balance-page-data'

export const dynamic = 'force-dynamic'

export default async function FinishedGoodsCountPage() {
  const { profile } = await getCurrentSessionProfile()
  if (!canAccessFinishedGoodsCount(profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const [pageData, openingBalancePageData] = await Promise.all([
    loadFinishedGoodsCountingPageData(supabase),
    loadFinishedGoodsOpeningBalancePageData(supabase),
  ])

  return (
    <div className="space-y-6">
      <FinishedGoodsCountPageClient
        pageData={pageData}
        openingBalancePageData={openingBalancePageData}
        currentRole={profile.role}
      />
    </div>
  )
}
