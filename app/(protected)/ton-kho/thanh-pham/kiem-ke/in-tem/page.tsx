import QRCode from 'qrcode'
import { redirect } from 'next/navigation'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canPrintFinishedGoodsGeneratedLabels } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { loadPrintableSerialLabelsByLotIds } from '@/lib/pile-serial/repository'
import { FinishedGoodsGeneratedLabelsPrintPageClient } from '@/components/ton-kho/finished-goods-generated-labels-print-page-client'

type SearchParams = Promise<{ lot_ids?: string; autoPrint?: string }>

export default async function FinishedGoodsGeneratedLabelsPrintPage(props: { searchParams: SearchParams }) {
  const { profile } = await getCurrentSessionProfile()
  if (!canPrintFinishedGoodsGeneratedLabels(profile.role)) {
    redirect('/dashboard')
  }

  const searchParams = await props.searchParams
  const lotIds = String(searchParams.lot_ids || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const shouldAutoPrint = String(searchParams.autoPrint || '').trim() === '1'

  if (!lotIds.length) {
    redirect('/ton-kho/thanh-pham/kiem-ke')
  }

  const supabase = await createClient()
  const labels = await loadPrintableSerialLabelsByLotIds(supabase, lotIds)
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

  return <FinishedGoodsGeneratedLabelsPrintPageClient labels={labelsWithQr} autoPrint={shouldAutoPrint} />
}
