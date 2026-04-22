import { redirect } from 'next/navigation'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { isAdminRole } from '@/lib/auth/roles'

export default async function MePage() {
  const { profile } = await getCurrentSessionProfile()

  if (process.env.NODE_ENV === 'production' || !isAdminRole(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="app-surface rounded-2xl p-6">
      <h1 className="text-2xl font-semibold">Debug Session</h1>
      <p className="app-muted mt-2 text-sm">
        Trang này chỉ giữ lại cho môi trường dev nội bộ. Production sẽ tự chuyển về dashboard.
      </p>
    </div>
  )
}
