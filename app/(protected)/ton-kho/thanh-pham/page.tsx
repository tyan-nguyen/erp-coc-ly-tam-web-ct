import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewFinishedGoodsInventory } from '@/lib/auth/roles'
import { loadFinishedGoodsInventoryPageData } from '@/lib/ton-kho-thanh-pham/page-data'
import { ThanhPhamInventoryPageClient } from '@/components/ton-kho/thanh-pham-page-client'

type SearchParams = Promise<{
  q?: string
  scope?: string
  page?: string
  item?: string
  serial_page?: string
}>

export const dynamic = 'force-dynamic'

export default async function ThanhPhamInventoryPage(props: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const searchParams = await props.searchParams

  if (!canViewFinishedGoodsInventory(profile.role)) {
    redirect('/dashboard')
  }

  const pageData = await loadFinishedGoodsInventoryPageData(supabase, searchParams)

  return <ThanhPhamInventoryPageClient pageData={pageData} />
}
