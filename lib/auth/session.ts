import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isAdminRole, normalizeRole } from '@/lib/auth/roles'

type UserProfile = {
  profile_id: number
  user_id: string
  role: string
  ho_ten: string | null
  email: string | null
  is_active: boolean
}

export const DEV_ROLE_OVERRIDE_COOKIE = 'dev_role_override'

export async function getAuthenticatedClientAndUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return { supabase, user }
}

export async function getCurrentSessionProfile() {
  const { supabase, user } = await getAuthenticatedClientAndUser()

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('profile_id, user_id, role, ho_ten, email, is_active')
    .eq('user_id', user.id)
    .single<UserProfile>()

  if (error || !profile || !profile.is_active) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const requestedRole = cookieStore.get(DEV_ROLE_OVERRIDE_COOKIE)?.value || ''
  const canOverrideRole = process.env.NODE_ENV !== 'production' && isAdminRole(profile.role)
  const effectiveRole = canOverrideRole && requestedRole ? normalizeRole(requestedRole) || profile.role : profile.role

  return {
    user,
    profile: {
      ...profile,
      role: effectiveRole,
      original_role: profile.role,
      is_role_overridden: canOverrideRole && Boolean(requestedRole),
    },
  }
}

export async function getAuthenticatedClientUserAndProfile() {
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const { profile } = await getCurrentSessionProfile()

  return {
    supabase,
    user,
    profile,
  }
}
