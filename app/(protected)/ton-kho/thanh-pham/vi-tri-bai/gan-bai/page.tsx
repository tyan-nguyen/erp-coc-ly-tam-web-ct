import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canManageWarehouseLocation } from '@/lib/auth/roles'
import { WarehouseLocationAssignmentPageClient } from '@/components/ton-kho/location-assignment-page-client'
import { loadWarehouseLocationAssignmentPageData } from '@/lib/ton-kho-thanh-pham/location-assignment-page-data'

export const dynamic = 'force-dynamic'

export default async function WarehouseLocationAssignmentPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canManageWarehouseLocation(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadWarehouseLocationAssignmentPageData(supabase)

  return (
    <WarehouseLocationAssignmentPageClient pageData={pageData} />
  )
}
