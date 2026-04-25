import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlStockTruth } from '@/lib/auth/roles'
import { NvlStockTruthPageClient } from '@/components/nvl-stock/stock-truth-page-client'
import { loadNvlStockTruthPageData } from '@/lib/nvl-stock/page-data'

export const dynamic = 'force-dynamic'

export default async function NvlStockTruthPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessNvlStockTruth(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadNvlStockTruthPageData(supabase)

  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <section className="px-4 py-4 sm:px-6 sm:py-5">
        <h1 className="text-2xl font-semibold sm:text-3xl">Tồn thực NVL</h1>
      </section>
      <NvlStockTruthPageClient pageData={pageData} />
    </div>
  )
}
