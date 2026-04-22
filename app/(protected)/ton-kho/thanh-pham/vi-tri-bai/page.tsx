import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { WarehouseLocationPageClient } from '@/components/ton-kho/location-page-client'
import { canViewFinishedGoodsInventory } from '@/lib/auth/roles'
import { loadWarehouseLocationPageData } from '@/lib/ton-kho-thanh-pham/location-page-data'

type LocationSearchParams = Partial<Record<'q' | 'page' | 'location' | 'serial_page' | 'quality', string | string[] | undefined>>

export default async function ThanhPhamLocationPage({
  searchParams,
}: {
  searchParams: Promise<LocationSearchParams>
}) {
  const supabase = await createClient()
  const [{ profile }, resolvedSearchParams] = await Promise.all([getCurrentSessionProfile(), searchParams])

  if (!canViewFinishedGoodsInventory(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadWarehouseLocationPageData(supabase, resolvedSearchParams)

  return (
    <div className="space-y-6">
      <WarehouseLocationPageClient pageData={pageData} />
    </div>
  )
}
