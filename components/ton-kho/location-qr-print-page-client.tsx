'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { TemSerialPrintButton } from '@/components/san-xuat/tem-serial-print-button'

type PrintableLocationQr = {
  locationId: string
  locationCode: string
  locationName: string
  locationLabel: string
  qrValue: string
  qrDataUrl: string
}

export function LocationQrPrintPageClient(props: {
  locations: PrintableLocationQr[]
  schemaReady: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    props.locations.map((location) => location.locationId)
  )
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  function toggleLocation(locationId: string) {
    setSelectedIds((current) =>
      current.includes(locationId)
        ? current.filter((item) => item !== locationId)
        : [...current, locationId]
    )
  }

  function selectAll() {
    setSelectedIds(props.locations.map((location) => location.locationId))
  }

  function clearAll() {
    setSelectedIds([])
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }

          #location-qr-print-root,
          #location-qr-print-root * {
            visibility: visible;
          }

          #location-qr-print-root {
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

      <section className="app-surface rounded-2xl p-6 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Tồn kho / Vị trí bãi
            </div>
            <h1 className="mt-4 text-2xl font-bold">In QR bãi</h1>
            <p className="app-muted mt-2 text-sm">
              Chọn các bãi cần in rồi bấm in. Hệ thống chỉ in đúng các mã QR đã tick.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/ton-kho/thanh-pham/vi-tri-bai" className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
              Xem serial theo bãi
            </Link>
            <Link href="/ton-kho/thanh-pham/vi-tri-bai/gan-bai" className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
              Gán serial vào bãi
            </Link>
            <TemSerialPrintButton label="In tem" disabled={selectedIds.length === 0} variant="plain" />
          </div>
        </div>
      </section>

      <section className="app-surface rounded-2xl p-6 print:hidden">
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
            Bỏ chọn tất cả
          </button>
          <div className="text-sm app-muted">
            Đã chọn: {selectedIds.length} / {props.locations.length}
          </div>
        </div>
      </section>

      <section
        id="location-qr-print-root"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3"
      >
        {props.locations.map((location) => {
          const checked = selectedSet.has(location.locationId)
          return (
            <article
              key={location.locationId}
              className={`relative rounded-2xl border bg-white p-3 print:break-inside-avoid print:rounded-none print:border-black ${
                checked ? '' : 'opacity-45 print:hidden'
              }`}
              style={{
                borderColor: 'var(--color-border)',
                width: '6cm',
                minHeight: '6cm',
                height: '6cm',
                overflow: 'hidden',
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-3 print:hidden">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">Bãi</div>
                  <div className="mt-1 text-sm font-semibold break-all">{location.locationCode}</div>
                </div>
                <label className="mt-1 inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLocation(location.locationId)}
                    className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  />
                  Chọn
                </label>
              </div>

              <button
                type="button"
                onClick={() => toggleLocation(location.locationId)}
                className="flex h-full w-full flex-col items-center justify-between text-left"
              >
                <div className="w-full text-center">
                  <div className="text-[20px] font-bold leading-none">{location.locationCode}</div>
                  <div className="mt-1 text-[11px] font-medium text-slate-600">
                    {location.locationName || 'Bãi chứa serial'}
                  </div>
                </div>

                <div className="flex flex-1 items-center justify-center py-1">
                  <Image
                    src={location.qrDataUrl}
                    alt={`QR bãi ${location.locationCode}`}
                    width={220}
                    height={220}
                    className="h-[3.2cm] w-[3.2cm] object-contain"
                  />
                </div>

                <div className="w-full border-t pt-1.5 text-center">
                  <div className="text-[11px] font-semibold">{location.locationLabel}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-600">{location.qrValue}</div>
                </div>
              </button>
            </article>
          )
        })}

        {props.schemaReady && props.locations.length === 0 ? (
          <div className="app-surface rounded-2xl p-6 text-sm text-[var(--color-muted)] print:hidden">
            Chưa có khu vực tồn nào để in QR. Hãy tạo khu vực tồn trước rồi quay lại màn này.
          </div>
        ) : null}

        {!props.schemaReady ? (
          <div className="app-surface rounded-2xl p-6 text-sm text-[var(--color-muted)] print:hidden">
            Chưa thấy schema `warehouse_location`. Cần chạy file `sql/pile_serial_setup.sql` rồi mới in QR bãi.
          </div>
        ) : null}
      </section>
    </div>
  )
}
