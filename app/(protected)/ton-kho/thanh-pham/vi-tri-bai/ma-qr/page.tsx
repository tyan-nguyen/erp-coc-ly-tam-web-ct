import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canManageWarehouseLocation } from '@/lib/auth/roles'
import { loadWarehouseLocationAssignmentPageData } from '@/lib/ton-kho-thanh-pham/location-assignment-page-data'
import { LocationQrPrintPageClient } from '@/components/ton-kho/location-qr-print-page-client'

export const dynamic = 'force-dynamic'

export default async function WarehouseLocationQrPage() {
  const { profile } = await getCurrentSessionProfile()
  if (!canManageWarehouseLocation(profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const pageData = await loadWarehouseLocationAssignmentPageData(supabase)
  const locationsWithQr = await Promise.all(
    pageData.locations.map(async (location) => ({
      ...location,
      qrValue: `WHLOC:${location.locationCode}`,
      qrDataUrl: await QRCode.toDataURL(`WHLOC:${location.locationCode}`, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
      }),
    }))
  )

  return (
    <LocationQrPrintPageClient locations={locationsWithQr} schemaReady={pageData.schemaReady} />
  )
}
