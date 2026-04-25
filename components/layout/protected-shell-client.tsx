'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { normalizeRole } from '@/lib/auth/roles'
import { WarehouseLocationInternalScanPageClient } from '@/components/ton-kho/location-internal-scan-page-client'
import type { WarehouseLocationAssignmentPageData } from '@/lib/ton-kho-thanh-pham/location-assignment-types'
import type { SerialReprintSearchOptions } from '@/lib/pile-serial/repository'

type NavItem = {
  label: string
  href?: string
  children?: Array<{
    href?: string
    label: string
    kind?: 'link' | 'section'
  }>
}

type NavLinkItem = {
  href: string
  label: string
}

type ProtectedShellClientProps = {
  userEmail: string | null
  role: string
  originalRole?: string
  isRoleOverridden?: boolean
  navItems: NavItem[]
  masterDataItems: NavLinkItem[]
  canUseInternalScanOverlay?: boolean
  internalScanPageData?: WarehouseLocationAssignmentPageData | null
  internalScanReprintOptions?: SerialReprintSearchOptions | null
  children: React.ReactNode
}

export function ProtectedShellClient({
  userEmail,
  role,
  originalRole,
  isRoleOverridden,
  navItems,
  masterDataItems,
  canUseInternalScanOverlay = false,
  internalScanPageData = null,
  internalScanReprintOptions = null,
  children,
}: ProtectedShellClientProps) {
  const [isCompact, setIsCompact] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [masterDataOpen, setMasterDataOpen] = useState(false)
  const [openNavGroups, setOpenNavGroups] = useState<Record<string, boolean>>({})
  const [roleOverride, setRoleOverride] = useState(isRoleOverridden ? role : '')
  const [internalScanOpen, setInternalScanOpen] = useState(false)
  const [internalScanMode, setInternalScanMode] = useState<'search' | 'scan'>('search')
  const canSimulateRole =
    process.env.NODE_ENV !== 'production' &&
    normalizeRole(originalRole || role) === 'admin'

  useEffect(() => {
    function syncViewport() {
      const compact = window.innerWidth < 1280
      setIsCompact(compact)
      setSidebarOpen(!compact)
      setDrawerOpen(false)
      setMasterDataOpen(false)
      setOpenNavGroups({})
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (!internalScanOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setInternalScanOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [internalScanOpen])

  function openInternalScan(mode: 'search' | 'scan') {
    if (!canUseInternalScanOverlay || !internalScanPageData) return
    setInternalScanMode(mode)
    setInternalScanOpen(true)
    setDrawerOpen(false)
  }

  return (
    <div className="app-shell min-h-screen">
      <div className="flex min-h-screen w-full">
        {!isCompact && sidebarOpen ? (
          <SidebarContent
            userEmail={userEmail}
            role={role}
            originalRole={originalRole}
            isRoleOverridden={isRoleOverridden}
            canSimulateRole={canSimulateRole}
            roleOverride={roleOverride}
            setRoleOverride={setRoleOverride}
            masterDataItems={masterDataItems}
            navItems={navItems}
            masterDataOpen={masterDataOpen}
            setMasterDataOpen={setMasterDataOpen}
            openNavGroups={openNavGroups}
            setOpenNavGroups={setOpenNavGroups}
            mode="docked"
            onItemClick={() => {}}
            onToggle={() => {
              setMasterDataOpen(false)
              setOpenNavGroups({})
              setSidebarOpen(false)
            }}
          />
        ) : null}

        {isCompact && drawerOpen ? (
          <>
            <button
              type="button"
              aria-label="Đóng menu"
              className="fixed inset-0 z-30 bg-black/30"
              onClick={() => setDrawerOpen(false)}
            />
            <SidebarContent
              userEmail={userEmail}
              role={role}
              originalRole={originalRole}
              isRoleOverridden={isRoleOverridden}
              canSimulateRole={canSimulateRole}
              roleOverride={roleOverride}
              setRoleOverride={setRoleOverride}
              masterDataItems={masterDataItems}
              navItems={navItems}
              masterDataOpen={masterDataOpen}
              setMasterDataOpen={setMasterDataOpen}
              openNavGroups={openNavGroups}
              setOpenNavGroups={setOpenNavGroups}
              mode="drawer"
              onItemClick={() => setDrawerOpen(false)}
              onToggle={() => {
                setMasterDataOpen(false)
                setOpenNavGroups({})
                setDrawerOpen(false)
              }}
            />
          </>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header
            className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6"
            style={{
              backgroundColor: 'var(--color-primary)',
              borderColor: 'color-mix(in srgb, var(--color-primary) 75%, black)',
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              {isCompact || !sidebarOpen ? (
                <button
                  type="button"
                  aria-label="Mở menu"
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    if (isCompact) {
                      setDrawerOpen((value) => !value)
                      setMasterDataOpen(false)
                      setOpenNavGroups({})
                      return
                    }
                    setMasterDataOpen(false)
                    setSidebarOpen(true)
                  }}
                >
                  ≡
                </button>
              ) : null}
              <Link href="/dashboard" prefetch={false} className="flex min-w-0 items-center gap-3">
                <div className="relative h-11 w-11 overflow-hidden">
                  <Image
                    src="/branding/nguyen-trinh-logo.png"
                    alt="Nguyễn Trình"
                    fill
                    sizes="44px"
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-white md:text-lg">Nguyễn Trình</div>
                </div>
              </Link>
            </div>

            {canUseInternalScanOverlay && internalScanPageData ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Tra cứu serial"
                  className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  style={{ borderColor: 'rgba(255,255,255,0.18)' }}
                  onClick={() => openInternalScan('search')}
                >
                  <SearchIcon className="h-4 w-4" />
                  <span className="hidden md:inline">Tìm kiếm</span>
                </button>
              </div>
            ) : null}
          </header>

          <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>

      {internalScanOpen && canUseInternalScanOverlay && internalScanPageData ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="Đóng tra cứu serial"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setInternalScanOpen(false)}
          />
          <div className="absolute inset-0 overflow-y-auto p-3 md:p-6">
            <div className="mx-auto max-w-[520px]">
              <div
                className="overflow-hidden rounded-[32px] border bg-white shadow-2xl"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">Nội bộ</div>
                    <div className="mt-1 truncate text-lg font-semibold">Tra cứu serial</div>
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-base font-semibold"
                    style={{ borderColor: 'var(--color-border)' }}
                    onClick={() => setInternalScanOpen(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="p-0">
                  <WarehouseLocationInternalScanPageClient
                    key={internalScanMode}
                    pageData={internalScanPageData}
                    reprintOptions={internalScanReprintOptions || undefined}
                    autoStartScanner={internalScanMode === 'scan'}
                    embedded
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SidebarContent({
  userEmail,
  role,
  originalRole,
  isRoleOverridden,
  canSimulateRole,
  roleOverride,
  setRoleOverride,
  masterDataItems,
  navItems,
  masterDataOpen,
  setMasterDataOpen,
  openNavGroups,
  setOpenNavGroups,
  mode,
  onItemClick,
  onToggle,
}: {
  userEmail: string | null
  role: string
  originalRole?: string
  isRoleOverridden?: boolean
  canSimulateRole: boolean
  roleOverride: string
  setRoleOverride: React.Dispatch<React.SetStateAction<string>>
  masterDataItems: NavLinkItem[]
  navItems: NavItem[]
  masterDataOpen: boolean
  setMasterDataOpen: React.Dispatch<React.SetStateAction<boolean>>
  openNavGroups: Record<string, boolean>
  setOpenNavGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  mode: 'docked' | 'drawer'
  onItemClick: () => void
  onToggle: () => void
}) {
  return (
    <aside
      className={[
        'h-screen overflow-y-auto border-r',
        mode === 'docked'
          ? 'sticky top-0 w-64 flex-shrink-0 p-4'
          : 'fixed left-0 top-0 z-40 w-72 p-5 shadow-2xl',
      ].join(' ')}
      style={{
        backgroundColor: 'var(--color-primary)',
        borderColor: 'color-mix(in srgb, var(--color-primary) 70%, black)',
      }}
    >
      <div className="mb-6 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/70">ERP</p>
          <h1 className="text-2xl font-bold text-white">Coc Ly Tam</h1>
        </div>
        <button
          type="button"
          aria-label={mode === 'docked' ? 'Thu gọn menu' : 'Đóng menu'}
          className="rounded-lg border border-white/20 px-2 py-1 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          onClick={onToggle}
        >
          {mode === 'docked' ? '≡' : '×'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex flex-1 flex-col gap-2">
        {masterDataItems.length > 0 ? (
          <div className="rounded-xl">
            <button
              type="button"
              className="app-nav flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors"
              onClick={() => setMasterDataOpen((value) => !value)}
            >
              <span>Danh mục</span>
              <span className="text-white/70">{masterDataOpen ? '−' : '+'}</span>
            </button>
            {masterDataOpen ? (
              <div className="mt-1 flex flex-col gap-1 rounded-xl bg-white/8 p-2">
                {masterDataItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className="rounded-lg py-2 pl-6 pr-3 text-sm font-medium text-white transition hover:bg-white/12 hover:text-white"
                    style={{ color: '#FFFFFF' }}
                    onClick={onItemClick}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {navItems.map((item) =>
          item.children?.length ? (
            <div key={item.label} className="rounded-xl">
              <button
                type="button"
                className="app-nav flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors"
                onClick={() =>
                  setOpenNavGroups((prev) => ({
                    ...prev,
                    [item.label]: !prev[item.label],
                  }))
                }
              >
                <span>{item.label}</span>
                <span className="text-white/70">{openNavGroups[item.label] ? '−' : '+'}</span>
              </button>
              {openNavGroups[item.label] ? (
                <div className="mt-1 flex flex-col gap-1 rounded-xl bg-white/8 p-2">
                  {item.children.map((child) => (
                    child.kind === 'section' || !child.href ? (
                      <div
                        key={`section-${item.label}-${child.label}`}
                        className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55 first:pt-1"
                      >
                        {child.label}
                      </div>
                    ) : (
                      <Link
                        key={child.href}
                        href={child.href}
                        prefetch={false}
                        className="rounded-lg py-2 pl-6 pr-3 text-sm font-medium text-white transition hover:bg-white/12 hover:text-white"
                        style={{ color: '#FFFFFF' }}
                        onClick={onItemClick}
                      >
                        {child.label}
                      </Link>
                    )
                  ))}
                </div>
              ) : null}
            </div>
          ) : item.href ? (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="app-nav rounded-xl px-3 py-2 text-sm font-medium transition-colors"
              onClick={onItemClick}
            >
              {item.label}
            </Link>
          ) : null
        )}
      </nav>

      <div className="mt-6 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
        <div className="text-sm text-white/70">{userEmail || '-'}</div>
        <div className="mt-1 text-sm font-semibold text-white">Role: {role}</div>
        {canSimulateRole ? (
          <RoleOverrideControl
            roleOverride={roleOverride}
            setRoleOverride={setRoleOverride}
            originalRole={originalRole}
            isRoleOverridden={isRoleOverridden}
          />
        ) : null}
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
      </div>
    </aside>
  )
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function RoleOverrideControl({
  roleOverride,
  setRoleOverride,
  originalRole,
  isRoleOverridden,
}: {
  roleOverride: string
  setRoleOverride: React.Dispatch<React.SetStateAction<string>>
  originalRole?: string
  isRoleOverridden?: boolean
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={roleOverride}
        onChange={async (event) => {
          const nextRole = event.target.value
          setRoleOverride(nextRole)
          await fetch('/api/dev/role-override', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: nextRole || null }),
          })
          window.location.href = '/dashboard'
        }}
        className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-white"
      >
        <option value="">Admin thật</option>
        <option value="ky thuat">Giả lập Kỹ thuật</option>
        <option value="kinh doanh">Giả lập Kinh doanh</option>
        <option value="ke toan ban hang">Giả lập Kế toán bán hàng</option>
        <option value="ke toan mua hang">Giả lập Kế toán mua hàng</option>
        <option value="kiem ke vien">Giả lập Kiểm kê viên</option>
        <option value="qlsx">Giả lập QLSX</option>
        <option value="thu kho">Giả lập Thủ kho</option>
        <option value="qc">Giả lập QC</option>
      </select>
      {isRoleOverridden ? (
        <span className="text-xs text-white/70">Role gốc: {originalRole}</span>
      ) : null}
    </div>
  )
}
