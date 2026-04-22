import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessInventoryCount } from '@/lib/auth/roles'
import { loadInventoryCountDetail } from '@/lib/inventory-counting/repository'
import { InventoryCountDetailClient } from '@/components/inventory-counting/inventory-count-detail-client'

export const dynamic = 'force-dynamic'

export default async function InventoryCountDetailPage(props: {
  params: Promise<{ count_sheet_id: string }>
}) {
  const { count_sheet_id: countSheetId } = await props.params
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessInventoryCount(profile.role)) {
    redirect('/dashboard')
  }

  const detail = await loadInventoryCountDetail({ supabase, countSheetId })
  if (!detail) {
    redirect('/ton-kho/kiem-ke')
  }

  return (
    <InventoryCountDetailClient detail={detail} currentRole={profile.role} />
  )
}
