'use client'

import { createContext, useContext } from 'react'

type SessionUser = {
  id: string
  email: string | null
}

type SessionProfile = {
  profile_id: number
  user_id: string
  role: string
  original_role?: string
  is_role_overridden?: boolean
  ho_ten: string | null
  email: string | null
  is_active: boolean
}

type ProtectedSessionValue = {
  user: SessionUser
  profile: SessionProfile
}

const ProtectedSessionContext = createContext<ProtectedSessionValue | null>(null)

export function ProtectedSessionProvider({
  value,
  children,
}: {
  value: ProtectedSessionValue
  children: React.ReactNode
}) {
  return (
    <ProtectedSessionContext.Provider value={value}>
      {children}
    </ProtectedSessionContext.Provider>
  )
}

export function useProtectedSession() {
  const value = useContext(ProtectedSessionContext)
  if (!value) {
    throw new Error('useProtectedSession must be used within ProtectedSessionProvider')
  }
  return value
}
