import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canManageWarehouseLocation } from '@/lib/auth/roles'
import { WarehouseLocationInternalScanPageClient } from '@/components/ton-kho/location-internal-scan-page-client'
import { loadWarehouseLocationAssignmentPageData } from '@/lib/ton-kho-thanh-pham/location-assignment-page-data'
import { loadSerialReprintSearchOptions } from '@/lib/pile-serial/repository'

export const dynamic = 'force-dynamic'

export default async function WarehouseLocationInternalScanPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canManageWarehouseLocation(profile.role)) {
    redirect('/dashboard')
  }

  const [pageData, reprintOptions] = await Promise.all([
    loadWarehouseLocationAssignmentPageData(supabase),
    loadSerialReprintSearchOptions(supabase),
  ])

  return <WarehouseLocationInternalScanPageClient pageData={pageData} reprintOptions={reprintOptions} />
}
