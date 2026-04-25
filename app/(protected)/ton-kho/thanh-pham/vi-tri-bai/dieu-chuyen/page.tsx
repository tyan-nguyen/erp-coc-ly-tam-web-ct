import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canManageWarehouseLocation } from '@/lib/auth/roles'
import { WarehouseLocationTransferPageClient } from '@/components/ton-kho/location-transfer-page-client'
import { loadWarehouseLocationAssignmentPageData } from '@/lib/ton-kho-thanh-pham/location-assignment-page-data'

export const dynamic = 'force-dynamic'

export default async function WarehouseLocationTransferPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canManageWarehouseLocation(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadWarehouseLocationAssignmentPageData(supabase)

  return <WarehouseLocationTransferPageClient pageData={pageData} />
}
