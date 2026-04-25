'use client'

import { useEffect } from 'react'

export function AutoPrintOnMount({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return

    const handleAfterPrint = () => {
      window.setTimeout(() => {
        window.close()
      }, 120)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    const timeout = window.setTimeout(() => {
      window.print()
    }, 180)

    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [enabled])

  return null
}
