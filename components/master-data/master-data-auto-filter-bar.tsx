'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

function buildHref(pathname: string, params: URLSearchParams) {
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

type MasterDataAutoFilterBarProps = {
  q: string
  showInactive: boolean
  placeholder: string
}

export function MasterDataAutoFilterBar({
  q,
  showInactive,
  placeholder,
}: MasterDataAutoFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(q)
  const [inactive, setInactive] = useState(showInactive)

  useEffect(() => {
    setQuery(q)
  }, [q])

  useEffect(() => {
    setInactive(showInactive)
  }, [showInactive])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString())
      const normalizedQuery = query.trim()

      if (normalizedQuery) {
        nextParams.set('q', normalizedQuery)
      } else {
        nextParams.delete('q')
      }

      if (inactive) {
        nextParams.set('show_inactive', '1')
      } else {
        nextParams.delete('show_inactive')
      }

      nextParams.set('page', '1')
      nextParams.delete('edit_key')
      nextParams.delete('msg')
      nextParams.delete('err')

      const nextHref = buildHref(pathname, nextParams)
      const currentHref = buildHref(pathname, new URLSearchParams(searchParams.toString()))
      if (nextHref === currentHref) {
        return
      }

      startTransition(() => {
        router.replace(nextHref, { scroll: false })
      })
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [inactive, pathname, query, router, searchParams])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="app-input w-full min-w-[260px] rounded-xl px-3 py-2 text-sm md:w-auto"
      />
      <label className="app-muted inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={inactive}
          onChange={(event) => setInactive(event.target.checked)}
        />
        Hiển thị đã xóa
      </label>
      {isPending ? <span className="app-muted text-xs">Đang lọc...</span> : null}
    </div>
  )
}
