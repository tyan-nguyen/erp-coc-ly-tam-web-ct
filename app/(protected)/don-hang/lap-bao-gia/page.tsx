import { redirect } from 'next/navigation'
import { BaoGiaBuilderClient } from '@/components/don-hang/bao-gia-builder-client'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isCommercialRole } from '@/lib/auth/roles'
import { loadLapBaoGiaPageData } from '@/lib/bao-gia/page-data'

type SearchParams = Promise<{
  ids?: string
}>
export default async function LapBaoGiaPage(props: {
  searchParams: SearchParams
}) {
  const searchParams = await props.searchParams
  const { profile } = await getCurrentSessionProfile()
  if (isCommercialRole(profile.role)) {
    redirect('/don-hang/bao-gia')
  }
  const ids = Array.from(
    new Set(
      String(searchParams.ids || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )

  const supabase = await createClient()
  const {
    refs,
    estimates,
    sameScope,
    customerName,
    projectName,
    sourceEstimateIds,
    transportCopy,
    accessoryOptions,
  } = await loadLapBaoGiaPageData(supabase, ids)

  return (
    <div className="space-y-6">
      <BaoGiaBuilderClient
        key={`${ids.join(',')}`}
        estimates={estimates}
        sameScope={sameScope}
        customerName={customerName}
        projectName={projectName}
        sourceEstimateIds={sourceEstimateIds}
        transportCopy={transportCopy}
        accessoryOptions={accessoryOptions}
        vatConfig={refs.vatConfig}
      />
    </div>
  )
}
