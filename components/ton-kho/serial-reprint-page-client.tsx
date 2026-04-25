'use client'

import type { SerialReprintSearchOptions } from '@/lib/pile-serial/repository'
import { SerialReprintSearchPanel } from '@/components/ton-kho/serial-reprint-search-panel'

export function SerialReprintPageClient({ options }: { options: SerialReprintSearchOptions }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: 'var(--color-border)' }}>
      <section className="px-6 py-5 md:px-8">
        <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Kho thành phẩm</div>
        <h1 className="mt-3 text-3xl font-bold leading-tight">In tem cọc</h1>
      </section>

      <section className="border-t px-6 py-6 md:px-8" style={{ borderColor: 'var(--color-border)' }}>
        <SerialReprintSearchPanel options={options} showDirectSerial />
      </section>
    </div>
  )
}
