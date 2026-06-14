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
      <style jsx global>{`
        @media print {
          @page {
            size: 8cm 4cm;
            margin: 0;
          }

          body * {
            visibility: hidden;
          }

          #production-serial-label-print-root,
          #production-serial-label-print-root * {
            visibility: visible;
          }

          #production-serial-label-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            background: white;
          }
        }
      `}</style>

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

      <section
        id="production-serial-label-print-root"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-1 print:gap-0"
      >
        {labels.map((label) => {
          const checked = selectedSet.has(label.serialId)
          return (
            <article
              key={label.serialId}
              className={`overflow-hidden rounded-2xl border bg-white p-3 print:break-after-page print:break-inside-avoid print:rounded-none print:border-black print:p-[0.18cm] ${
                checked ? '' : 'opacity-45 print:hidden'
              }`}
              style={{
                borderColor: 'var(--color-border)',
                width: '8cm',
                minHeight: '4cm',
                height: '4cm',
              }}
            >
              <div className="flex h-full gap-2">
                <div className="flex w-[2.7cm] shrink-0 flex-col items-center justify-center border-r pr-2 print:w-[2.45cm] print:pr-[0.12cm]" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="mb-1 flex items-center gap-1 self-start">
                    <Image
                      src="/branding/nguyen-trinh-logo.png"
                      alt="Nguyen Trinh logo"
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain print:h-[0.42cm] print:w-[0.42cm]"
                    />
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] leading-none print:text-[8px]">
                      Nguyễn Trình
                    </div>
                  </div>

                  <Image
                    src={label.qrDataUrl}
                    alt={`QR ${label.serialCode}`}
                    width={220}
                    height={220}
                    className="h-[2.15cm] w-[2.15cm] object-contain print:h-[1.95cm] print:w-[1.95cm]"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.18em] text-[var(--color-muted)] print:text-[7px]">
                      Serial
                    </div>
                    <div className="mt-0.5 text-[11px] font-bold leading-tight break-all print:text-[10px]">
                      {label.serialCode}
                    </div>
                  </div>

                  <div className="space-y-1 border-y py-1 text-[10px] leading-tight print:space-y-[0.04cm] print:py-[0.08cm] print:text-[9px]" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="font-semibold">{compactLabel(label.loaiCoc)}</div>
                    <div>
                      {label.tenDoan} {formatNumber(label.chieuDaiM)}m
                    </div>
                    <div>
                      {formatDateLabel(label.productionDate)} | #{formatSequence(label.displaySequence, label.serialCode)}
                    </div>
                  </div>

                  <div className="text-[9px] leading-tight text-slate-600 print:text-[8px]">
                    {compactLabel(label.loaiCoc)} | {label.tenDoan} {formatNumber(label.chieuDaiM)}m
                  </div>
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
