import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isAdminRole, isQcRole, isQlsxRole, isWarehouseRole } from '@/lib/auth/roles'
import { loadPrintableSerialLabelsByPlan } from '@/lib/pile-serial/repository'
import { TemSerialPrintPageClient } from '@/components/san-xuat/tem-serial-print-page-client'

type SearchParams = Promise<{ plan_id?: string }>

export default async function TemSerialPage(props: { searchParams: SearchParams }) {
  const { profile } = await getCurrentSessionProfile()
  if (!isWarehouseRole(profile.role) && !isAdminRole(profile.role) && !isQcRole(profile.role) && !isQlsxRole(profile.role)) {
    redirect('/dashboard')
  }

  const searchParams = await props.searchParams
  const planId = String(searchParams.plan_id || '').trim()
  if (!planId) {
    redirect('/san-xuat/ke-hoach-ngay')
  }

  const supabase = await createClient()
  const labels = await loadPrintableSerialLabelsByPlan(supabase, planId)
  const labelsWithQr = await Promise.all(
    labels.map(async (label) => ({
      ...label,
      qrDataUrl: await QRCode.toDataURL(label.serialCode, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
      }),
    }))
  )

  return <TemSerialPrintPageClient labels={labelsWithQr} backHref={`/san-xuat/ke-hoach-ngay?plan_id=${planId}`} />
}
