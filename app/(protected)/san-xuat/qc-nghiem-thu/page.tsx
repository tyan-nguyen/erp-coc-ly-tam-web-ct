import { redirect } from 'next/navigation'
import { QcNghiemThuListClient } from '@/components/san-xuat/qc-nghiem-thu-list-client'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canAccessQc } from '@/lib/auth/roles'
import { loadQcNghiemThuPageData } from '@/lib/san-xuat/page-data'
import { createClient } from '@/lib/supabase/server'

export default async function QcNghiemThuPage() {
  const supabase = await createClient()
  const { profile } = await getCurrentSessionProfile()

  if (!canAccessQc(profile.role)) {
    redirect('/dashboard')
  }

  const { rows } = await loadQcNghiemThuPageData(supabase, {
    viewerRole: profile.role,
  })

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div>
          <h1 className="text-2xl font-bold">Nghiệm thu QC</h1>
        </div>
      </section>

      <QcNghiemThuListClient
        rows={rows}
        viewerRole={profile.role}
      />
    </div>
  )
}
