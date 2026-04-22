import { redirect } from 'next/navigation'
import { ExternalPileProcurementOrderDetailClient } from '@/components/san-xuat/mua-coc-ngoai-order-detail-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessExternalPileProcurement } from '@/lib/auth/roles'
import { loadExternalPileProcurementOrderDetailPageData } from '@/lib/external-pile-procurement/page-data'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{ from?: string }>

export const dynamic = 'force-dynamic'

export default async function ExternalPileProcurementOrderDetailPage(props: {
  params: Promise<{ po_id: string }>
  searchParams: SearchParams
}) {
  const { po_id: poId } = await props.params
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessExternalPileProcurement(profile.role)) {
    redirect('/dashboard')
  }

  const { detail } = await loadExternalPileProcurementOrderDetailPageData(supabase, { poId })

  return (
    <div className="space-y-6">
      <ExternalPileProcurementOrderDetailClient
        detail={detail}
        viewerRole={profile.role}
        fastBackToList={searchParams.from === 'list'}
      />
    </div>
  )
}
