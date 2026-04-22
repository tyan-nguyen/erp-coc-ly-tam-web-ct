import { redirect } from 'next/navigation'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlProcurement } from '@/lib/auth/roles'
import { NvlProcurementFlowPageClient } from '@/components/nvl-procurement/procurement-flow-page-client'
import { loadNvlProcurementFlowPageData } from '@/lib/nvl-procurement/page-data'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NvlProcurementFlowPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessNvlProcurement(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadNvlProcurementFlowPageData(supabase)

  return (
    <section className="app-surface overflow-hidden rounded-2xl">
      <div className="px-6 py-4">
        <h1 className="text-2xl font-semibold">Đề xuất NVL</h1>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        <NvlProcurementFlowPageClient pageData={pageData} currentRole={profile.role} />
      </div>
    </section>
  )
}
