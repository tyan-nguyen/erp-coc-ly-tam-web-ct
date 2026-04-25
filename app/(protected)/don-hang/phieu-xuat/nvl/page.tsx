import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canViewMaterialIssue } from '@/lib/auth/roles'
import { loadMaterialIssueScreenData } from '@/lib/nvl-issue/page-data'
import { MaterialIssuePageClient } from '@/components/nvl-issue/material-issue-page-client'

export const dynamic = 'force-dynamic'

export default async function MaterialIssuePage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canViewMaterialIssue(profile.role)) {
    redirect('/dashboard')
  }

  const { pageData } = await loadMaterialIssueScreenData(supabase, {
    viewerRole: profile.role,
  })

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div>
          <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
            Xuất hàng
          </div>
          <h1 className="mt-4 text-2xl font-bold">Phiếu xuất hàng NVL</h1>
          <div className="mt-4 flex flex-wrap gap-6 border-b text-sm" style={{ borderColor: 'var(--color-border)' }}>
            <Link href="/don-hang/phieu-xuat" prefetch className="px-1 pb-3 font-semibold app-muted transition-colors hover:text-[var(--color-foreground)]">
              Cọc thành phẩm
            </Link>
            <span className="border-b-2 px-1 pb-3 font-semibold" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
              Nguyên vật liệu
            </span>
          </div>
        </div>
      </section>

      <MaterialIssuePageClient pageData={pageData} viewerRole={profile.role} />
    </div>
  )
}
