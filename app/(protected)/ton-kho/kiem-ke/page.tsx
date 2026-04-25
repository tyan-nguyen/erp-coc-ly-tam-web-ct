import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessInventoryCount } from '@/lib/auth/roles'
import { loadInventoryCountingPageData } from '@/lib/inventory-counting/page-data'
import { InventoryCountPageClient } from '@/components/inventory-counting/inventory-count-page-client'

export const dynamic = 'force-dynamic'

export default async function InventoryCountPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessInventoryCount(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadInventoryCountingPageData(supabase)

  return <InventoryCountPageClient pageData={pageData} currentRole={profile.role} />
}
