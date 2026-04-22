'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

export function FormSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode
  pendingLabel?: string
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      aria-disabled={pending}
    >
      {pending ? pendingLabel ?? 'Đang lưu...' : children}
    </button>
  )
}
