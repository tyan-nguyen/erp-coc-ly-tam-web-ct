'use client'

import Image from 'next/image'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { TemSerialPrintButton } from '@/components/san-xuat/tem-serial-print-button'
import { AutoPrintOnMount } from '@/components/san-xuat/auto-print-on-mount'
import type { PrintableSerialLabel } from '@/lib/pile-serial/repository'

type PrintableLabelWithQr = PrintableSerialLabel & {
  qrDataUrl: string
}

function formatNumber(value: number) {
  const rounded = Math.round(Number(value || 0) * 1000) / 1000
  if (!Number.isFinite(rounded)) return '0'
  return String(rounded)
}

function formatSequence(displaySequence: number, serialCode: string) {
  if (displaySequence > 0) return String(displaySequence).padStart(3, '0')
  const parts = String(serialCode || '').split('-')
  return parts[parts.length - 1] || serialCode
}

function compactLabel(value: string) {
  return String(value || '').replace(/\s+/g, '')
}

function formatPileLabel(label: PrintableLabelWithQr) {
  const maCoc = String(label.maCoc || '').trim()
  const loaiCoc = String(label.loaiCoc || '').trim()
  const itemName = maCoc || loaiCoc
  return `${compactLabel(itemName)} | ${label.tenDoan} ${formatNumber(label.chieuDaiM)}m`
}

function subscribeHydration(onStoreChange: () => void) {
  const timeoutId = window.setTimeout(onStoreChange, 0)
  return () => window.clearTimeout(timeoutId)
}

function getClientSnapshot() {
  return true
}

function getServerSnapshot() {
  return false
}

export function FinishedGoodsGeneratedLabelsPrintPageClient({
  labels,
  autoPrint = false,
}: {
  labels: PrintableLabelWithQr[]
  autoPrint?: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => labels.map((label) => label.serialId))
  const hydrated = useSyncExternalStore(subscribeHydration, getClientSnapshot, getServerSnapshot)

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
      <style jsx global>{`
        @media print {
          @page {
            size: 8cm 4cm;
            margin: 0;
          }

          body * {
            visibility: hidden;
          }

          #finished-goods-label-print-root,
          #finished-goods-label-print-root * {
            visibility: visible;
          }

          #finished-goods-label-print-root {
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
        id="finished-goods-label-print-root"
        className="border-t px-6 py-6 md:px-8 print:border-0 print:p-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-1 print:gap-0">
        {labels.map((label) => {
          const checked = selectedSet.has(label.serialId)
          return (
            <article
              key={label.serialId}
              className={`group relative overflow-hidden rounded-2xl border bg-white p-3 print:break-after-page print:break-inside-avoid print:rounded-none print:border print:border-black print:p-[0.18cm] ${
                checked ? '' : 'opacity-45 print:hidden'
              }`}
              style={{
                borderColor: 'var(--color-border)',
                width: '8cm',
                minHeight: '4cm',
                height: '4cm',
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
                    <div suppressHydrationWarning>
                      STT #{hydrated ? formatSequence(label.displaySequence, label.serialCode) : ''}
                    </div>
                  </div>

                  <div className="text-[9px] leading-tight text-slate-600 print:text-[8px]">
                    {formatPileLabel(label)}
                  </div>
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
