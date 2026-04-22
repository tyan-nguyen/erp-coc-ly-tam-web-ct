import { redirect } from 'next/navigation'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessNvlDemand } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NvlDemandCockpitPage() {
  await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessNvlDemand(profile.role)) {
    redirect('/dashboard')
  }

  redirect('/ton-kho/nvl/mua-hang')
}
