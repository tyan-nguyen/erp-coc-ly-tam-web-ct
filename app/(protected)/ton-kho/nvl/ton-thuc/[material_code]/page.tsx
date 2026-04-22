import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlStockTruth } from '@/lib/auth/roles'
import { NvlStockMovementHistoryPageClient } from '@/components/nvl-stock/stock-movement-history-page-client'
import { loadNvlStockMovementHistoryPageData } from '@/lib/nvl-stock/page-data'

export const dynamic = 'force-dynamic'

export default async function NvlStockMovementHistoryPage(props: {
  params: Promise<{ material_code: string }>
}) {
  const { material_code: materialCode } = await props.params
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessNvlStockTruth(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadNvlStockMovementHistoryPageData({
    supabase,
    materialCode: decodeURIComponent(materialCode),
  })

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/ton-kho/nvl/ton-thuc"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg"
            style={{ borderColor: 'var(--color-border)' }}
            aria-label="Về tồn thực NVL"
          >
            ←
          </Link>
          <h1 className="text-3xl font-semibold">Lịch sử NVL</h1>
        </div>
      </section>

      <NvlStockMovementHistoryPageClient pageData={pageData} />
    </div>
  )
}
