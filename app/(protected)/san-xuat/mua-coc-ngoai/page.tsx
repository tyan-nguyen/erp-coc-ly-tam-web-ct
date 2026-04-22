import { redirect } from 'next/navigation'
import { ExternalPileProcurementPageClient } from '@/components/san-xuat/mua-coc-ngoai-page-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessExternalPileProcurement } from '@/lib/auth/roles'
import { loadExternalPileProcurementScreenData } from '@/lib/external-pile-procurement/page-data'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ExternalPileProcurementPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessExternalPileProcurement(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadExternalPileProcurementScreenData(supabase)

  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <section className="px-6 py-5">
        <h1 className="text-2xl font-bold">Cọc thành phẩm</h1>
      </section>
      <ExternalPileProcurementPageClient pageData={pageData} viewerRole={profile.role} />
    </div>
  )
}
