import QRCode from 'qrcode'
import { redirect } from 'next/navigation'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canPrintFinishedGoodsGeneratedLabels } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import {
  loadPrintableSerialLabelsBySerialCodes,
  loadSerialReprintSearchOptions,
} from '@/lib/pile-serial/repository'
import { FinishedGoodsGeneratedLabelsPrintPageClient } from '@/components/ton-kho/finished-goods-generated-labels-print-page-client'
import { SerialReprintPageClient } from '@/components/ton-kho/serial-reprint-page-client'

type SearchParams = Promise<{ serial_codes?: string; autoPrint?: string }>

export const dynamic = 'force-dynamic'

export default async function FinishedGoodsSerialReprintPage(props: { searchParams: SearchParams }) {
  const { profile } = await getCurrentSessionProfile()
  if (!canPrintFinishedGoodsGeneratedLabels(profile.role)) {
    redirect('/dashboard')
  }

  const searchParams = await props.searchParams
  const serialCodes = String(searchParams.serial_codes || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const shouldAutoPrint = String(searchParams.autoPrint || '').trim() === '1'
  const supabase = await createClient()

  if (!serialCodes.length) {
    const options = await loadSerialReprintSearchOptions(supabase)
    return <SerialReprintPageClient options={options} />
  }

  const labels = await loadPrintableSerialLabelsBySerialCodes(supabase, serialCodes)
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
