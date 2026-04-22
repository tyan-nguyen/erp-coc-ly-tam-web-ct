import { notFound } from 'next/navigation'
import { BaoGiaBuilderClient } from '@/components/don-hang/bao-gia-builder-client'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isCommercialRole } from '@/lib/auth/roles'
import { loadBaoGiaDetailPageData } from '@/lib/bao-gia/page-data'

export default async function BaoGiaDetailPage(props: {
  params: Promise<{ quote_id: string }>
  searchParams?: Promise<{ v?: string }>
}) {
  const { quote_id: quoteId } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : undefined
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()
  const requestedVersionNo = Number(searchParams?.v || 0)
  const commercialViewer = isCommercialRole(profile.role)
  const {
    detail,
    refs,
    selectedVersion,
    isHistoricalView,
    fallbackEstimates,
    fallbackTransportCopy,
    accessoryOptions,
  } = await loadBaoGiaDetailPageData(supabase, {
    quoteId,
    requestedVersionNo,
  })

  if (!detail) notFound()

  return (
    <div className="space-y-6">
      <BaoGiaBuilderClient
        estimates={fallbackEstimates}
        sameScope={true}
        customerName={detail.khachHang || 'Chưa có khách hàng'}
        projectName={detail.duAn || 'Chưa có dự án'}
        sourceEstimateIds={detail.estimateIds}
        transportCopy={fallbackTransportCopy}
        accessoryOptions={accessoryOptions}
        vatConfig={refs.vatConfig}
        initialSnapshot={detail.versions.length === 0 ? null : selectedVersion.snapshot_json}
        quoteMeta={{
          quoteId: detail.quote.quote_id,
          maBaoGia: detail.quote.ma_bao_gia,
          status: detail.quote.trang_thai,
          statusLabel: detail.quote.status_label || 'Nháp',
          currentVersionNo: detail.quote.current_version_no,
          productionApproved: detail.quote.production_approved,
          productionApprovalLabel: detail.quote.production_approval_label || null,
        }}
        versions={detail.versions}
        viewingVersionNo={selectedVersion.version_no}
        isHistoricalView={isHistoricalView}
        readOnly={commercialViewer}
      />
    </div>
  )
}
