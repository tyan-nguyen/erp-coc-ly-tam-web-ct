'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { TemSerialPrintButton } from '@/components/san-xuat/tem-serial-print-button'
import { AutoPrintOnMount } from '@/components/san-xuat/auto-print-on-mount'
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

export function FinishedGoodsGeneratedLabelsPrintPageClient({
  labels,
  autoPrint = false,
}: {
  labels: PrintableLabelWithQr[]
  autoPrint?: boolean
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
    <div className="overflow-hidden rounded-2xl border bg-white print:block print:rounded-none print:border-0" style={{ borderColor: 'var(--color-border)' }}>
      <AutoPrintOnMount enabled={autoPrint} />

      <section className="px-6 py-5 md:px-8 print:hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Tem cọc</div>
            <h1 className="mt-3 text-3xl font-bold leading-tight">Danh sách tem</h1>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={selectAll}
              className="text-sm font-semibold text-[var(--color-text)]"
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-sm font-semibold text-[var(--color-text)]"
            >
              Bỏ chọn
            </button>
            <div className="print:hidden">
              <TemSerialPrintButton label="In tem" disabled={selectedIds.length === 0} variant="plain" />
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-t px-6 py-6 md:px-8 print:border-0 print:p-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
        {labels.map((label) => {
          const checked = selectedSet.has(label.serialId)
          return (
            <article
              key={label.serialId}
              className={`group relative border-t px-0 py-5 md:px-4 print:break-inside-avoid print:rounded-none print:border print:border-black print:p-3 ${
                checked ? '' : 'opacity-45 print:hidden'
              }`}
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'white',
                width: '100%',
              }}
              onClick={() => toggleSerial(label.serialId)}
            >
              <div className="mb-3 flex items-start justify-between gap-3 print:hidden">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">Serial</div>
                  <div className="mt-1 text-sm font-semibold break-all">{label.serialCode}</div>
                </div>
                <div
                  className={[
                    'mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                    checked ? 'text-white' : 'text-transparent',
                  ].join(' ')}
                  style={{
                    borderColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: checked ? 'var(--color-primary)' : 'white',
                  }}
                  aria-hidden="true"
                >
                  ✓
                </div>
              </div>

              <div className="flex min-h-[5cm] flex-col overflow-hidden print:h-full print:min-h-[5cm]">
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
            </article>
          )
        })}
        </div>
      </section>
    </div>
  )
}
