import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { canManageWarehouseLocation } from '@/lib/auth/roles'
import { loadWarehouseLocationAssignmentPageData } from '@/lib/ton-kho-thanh-pham/location-assignment-page-data'
import { TemSerialPrintButton } from '@/components/san-xuat/tem-serial-print-button'

export const dynamic = 'force-dynamic'

export default async function WarehouseLocationQrPage() {
  const { profile } = await getCurrentSessionProfile()
  if (!canManageWarehouseLocation(profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const pageData = await loadWarehouseLocationAssignmentPageData(supabase)
  const locationsWithQr = await Promise.all(
    pageData.locations.map(async (location) => ({
      ...location,
      qrValue: `WHLOC:${location.locationCode}`,
      qrDataUrl: await QRCode.toDataURL(`WHLOC:${location.locationCode}`, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
      }),
    }))
  )

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase app-primary-soft">
              Tồn kho / Vị trí bãi
            </div>
            <h1 className="mt-4 text-2xl font-bold">In QR bãi</h1>
            <p className="app-muted mt-2 text-sm">
              In các mã QR bãi để dán cố định ngoài hiện trường. Màn gán bãi có thể đọc trực tiếp nội dung dạng
              <span className="mx-1 font-mono">WHLOC:A1</span>
              để chọn đúng bãi đích khi gán hoặc điều chuyển serial.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/ton-kho/thanh-pham/vi-tri-bai" className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
              Xem serial theo bãi
            </Link>
            <Link href="/ton-kho/thanh-pham/vi-tri-bai/gan-bai" className="app-outline rounded-xl px-4 py-2 text-sm font-semibold">
              Gán serial vào bãi
            </Link>
            <TemSerialPrintButton />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
        {locationsWithQr.map((location) => (
          <article
            key={location.locationId}
            className="rounded-2xl border p-3 print:break-inside-avoid print:rounded-none print:border-black"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'white',
              width: '6cm',
              minHeight: '6cm',
              height: '6cm',
              overflow: 'hidden',
            }}
          >
            <div className="flex h-full flex-col items-center justify-between">
              <div className="w-full text-center">
                <div className="text-[20px] font-bold leading-none">{location.locationCode}</div>
                <div className="mt-1 text-[11px] font-medium text-slate-600">{location.locationName || 'Bãi chứa serial'}</div>
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
            </div>
          </article>
        ))}

        {!pageData.schemaReady ? (
          <div className="app-surface rounded-2xl p-6 text-sm text-[var(--color-muted)]">
            Chưa thấy schema `warehouse_location`. Cần chạy file `sql/pile_serial_setup.sql` rồi mới in QR bãi.
          </div>
        ) : null}
      </section>
    </div>
  )
}
