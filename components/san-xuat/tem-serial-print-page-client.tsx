'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { TemSerialPrintButton } from '@/components/san-xuat/tem-serial-print-button'
import type { PrintableSerialLabel } from '@/lib/pile-serial/repository'

type PrintableLabelWithQr = PrintableSerialLabel & {
  qrDataUrl: string
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

function formatDateLabel(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatSequence(displaySequence: number, serialCode: string) {
  if (displaySequence > 0) return String(displaySequence).padStart(3, '0')
  const parts = String(serialCode || '').split('-')
  return parts[parts.length - 1] || serialCode
}

function compactLabel(value: string) {
  return String(value || '').replace(/\s+/g, '')
}

export function TemSerialPrintPageClient({
  labels,
  backHref,
}: {
  labels: PrintableLabelWithQr[]
  backHref: string
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => labels.map((label) => label.serialId))
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  function toggleSerial(serialId: string) {
    setSelectedIds((current) => (current.includes(serialId) ? current.filter((item) => item !== serialId) : [...current, serialId]))
  }

  function selectAll() {
    setSelectedIds(labels.map((label) => label.serialId))
  }

  function clearAll() {
    setSelectedIds([])
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Tem serial
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Link
                href={backHref}
                className="app-outline inline-flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none"
                aria-label="Quay lại kế hoạch"
                title="Quay lại kế hoạch"
              >
                ←
              </Link>
              <h1 className="text-2xl font-bold">In tem serial thành phẩm</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={selectAll} className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
              Chọn tất cả
            </button>
            <button type="button" onClick={clearAll} className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
              Bỏ chọn
            </button>
            <TemSerialPrintButton label="In tem" disabled={selectedIds.length === 0} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
        {labels.map((label) => {
          const checked = selectedSet.has(label.serialId)
          return (
            <article
              key={label.serialId}
              className={`rounded-2xl border p-3 print:break-inside-avoid print:rounded-none print:border-black ${
                checked ? '' : 'opacity-45 print:hidden'
              }`}
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'white',
                width: '100%',
                minHeight: '5cm',
                height: 'auto',
                overflow: 'hidden',
              }}
            >
              <div className="flex flex-col print:h-full">
                <div className="flex items-center gap-2">
                  <div className="shrink-0">
                    <Image
                      src="/branding/nguyen-trinh-logo.png"
                      alt="Nguyen Trinh logo"
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] leading-none">Nguyễn Trình</div>
                  </div>
                </div>

                <div className="flex flex-1 items-center justify-center py-0.5">
                  <Image
                    src={label.qrDataUrl}
                    alt={`QR ${label.serialCode}`}
                    width={220}
                    height={220}
                    className="h-[2.85cm] w-[2.85cm] object-contain"
                  />
                </div>

                <div className="mt-auto border-t pt-1.5 text-center text-[10px] font-semibold leading-tight print:text-[9px]">
                  {compactLabel(label.loaiCoc)} | {label.tenDoan} {formatNumber(label.chieuDaiM)}m | {formatDateLabel(label.productionDate)} | #
                  {formatSequence(label.displaySequence, label.serialCode)}
                </div>
              </div>

              <div className="mt-2 flex justify-center print:hidden">
                <label className="inline-flex h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: 'var(--color-border)' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSerial(label.serialId)} className="h-4 w-4" />
                </label>
              </div>
            </article>
          )
        })}
        {labels.length === 0 ? (
          <div className="app-surface rounded-2xl p-6 text-sm text-[var(--color-muted)]">
            Chưa có serial nào cho kế hoạch này.
          </div>
        ) : null}
      </section>
    </div>
  )
}
