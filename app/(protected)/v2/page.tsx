import { V2FeedbackBanner } from '@/components/ui/v2-feedback-banner'
import { V2FeatureTile } from '@/components/ui/v2-feature-tile'
import { V2Checklist } from '@/components/ui/v2-checklist'
import { V2ListDetailLayout } from '@/components/ui/v2-list-detail-layout'
import { V2PageHeader } from '@/components/ui/v2-page-header'
import { V2SectionCard } from '@/components/ui/v2-section-card'
import { V2StatGrid } from '@/components/ui/v2-stat-grid'

export default function V2OverviewPage() {
  const phases = [
    'Shared foundation',
    'Master data',
    'Bóc tách',
    'Báo giá',
    'Đơn hàng',
    'Sản xuất + lot/serial',
    'QC',
    'Xuất hàng + trả hàng',
    'Tồn kho thành phẩm',
    'Vị trí kho',
  ]

  return (
    <div className="space-y-6">
      <V2PageHeader
        eyebrow="V2"
        title="ERP Rebuild Workspace"
        description="Đây là workspace rebuild để làm lại kiến trúc app mà vẫn giữ đúng nghiệp vụ đã chốt ở bản hiện tại."
      />

      <V2StatGrid
        items={[
          { label: 'Workspace', value: 'v2', note: 'Tách riêng khỏi bản đang vận hành' },
          { label: 'Mục tiêu', value: 'Kiến trúc sạch', note: 'Giảm refresh toàn page và gom query nặng' },
          { label: 'Chiến lược', value: 'Rebuild dần', note: 'Giữ domain, làm lại app structure' },
          { label: 'Bước kế', value: 'Foundation', note: 'Shared UI, auth/session, list/detail pattern' },
        ]}
      />

      <V2FeedbackBanner tone="info">
        Bản v2 không thêm nghiệp vụ mới ngay. Mình đang dựng một nền chung để các phân hệ sau bám cùng một cách tổ chức.
      </V2FeedbackBanner>

      <V2ListDetailLayout
        list={
          <V2SectionCard
            title="Roadmap"
            description="Mỗi phase sẽ được hoàn thiện theo thứ tự để giảm rủi ro và dễ đối chiếu với bản hiện tại."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {phases.map((phase, index) => (
                <V2FeatureTile
                  key={phase}
                  eyebrow={`Phase ${index + 1}`}
                  title={phase}
                  description="Sẽ được rebuild theo đúng pattern list/detail, summary trước và mutation cục bộ sau."
                />
              ))}
            </div>
          </V2SectionCard>
        }
        detail={
          <V2SectionCard
            title="Nguyên tắc"
            description="Đây là bộ rule nền để mình giữ chất lượng khi chuyển từng phân hệ sang v2."
          >
            <V2Checklist
              items={[
                { title: 'Giữ domain và rule nghiệp vụ đã chốt.' },
                { title: 'Làm lại data loading, mutation flow, và feature boundaries.' },
                { title: 'Ưu tiên list/detail tách riêng, summary trước, serial drill-down sau.' },
                { title: 'Không phụ thuộc vào refresh toàn page cho mọi thao tác nhỏ.' },
                { title: 'Tách rõ query đọc dữ liệu và command ghi dữ liệu.' },
              ]}
            />
          </V2SectionCard>
        }
      />
    </div>
  )
}
