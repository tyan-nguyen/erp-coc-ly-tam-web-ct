'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { PrintableSerialLabel, SerialReprintSearchOptions } from '@/lib/pile-serial/repository'
import { lookupSerialLabelsForReprint } from '@/lib/ton-kho-thanh-pham/serial-reprint-client-api'

function normalizeText(value: string) {
  return String(value || '').trim()
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(value || 0))
}

function printHref(serialCode: string) {
  const params = new URLSearchParams()
  params.set('serial_codes', serialCode)
  return `/ton-kho/thanh-pham/in-tem?${params.toString()}`
}

function LabelInput(props: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">{props.label}</span>
      {props.children}
    </label>
  )
}

export function SerialReprintSearchPanel({
  options,
  showDirectSerial = false,
  onSelectSerial,
}: {
  options: SerialReprintSearchOptions
  showDirectSerial?: boolean
  onSelectSerial?: (serialCode: string) => void
}) {
  const [serialCode, setSerialCode] = useState('')
  const [loaiCoc, setLoaiCoc] = useState('')
  const [tenDoan, setTenDoan] = useState('')
  const [chieuDaiM, setChieuDaiM] = useState('')
  const [productionDate, setProductionDate] = useState('')
  const [displaySequence, setDisplaySequence] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState<PrintableSerialLabel[]>([])

  const directSerial = normalizeText(serialCode).toUpperCase()
  const hasCriteria = useMemo(
    () => Boolean(normalizeText(loaiCoc) || normalizeText(tenDoan) || normalizeText(chieuDaiM) || normalizeText(productionDate) || normalizeText(displaySequence)),
    [chieuDaiM, displaySequence, loaiCoc, productionDate, tenDoan]
  )

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setCandidates([])
    try {
      if (!hasCriteria) throw new Error('Nhập ít nhất một thông tin còn đọc được trên tem.')
      const response = await lookupSerialLabelsForReprint({
        loaiCoc,
        tenDoan,
        chieuDaiM: chieuDaiM ? Number(chieuDaiM) : undefined,
        productionDate,
        displaySequence: displaySequence ? Number(displaySequence) : undefined,
      })
      setCandidates(response.data?.candidates || [])
      if (!response.data?.candidates?.length) {
        setError('Không tìm thấy serial khớp thông tin đã nhập.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tìm được serial.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-5">
      {showDirectSerial ? (
        <div className="border-b pb-5" style={{ borderColor: 'var(--color-border)' }}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <LabelInput label="Serial">
              <input
                className="w-full rounded-2xl border px-4 py-3 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                placeholder="Ví dụ: LO-260419-MUI-1M-L01-001"
                value={serialCode}
                onChange={(event) => setSerialCode(event.target.value)}
              />
            </LabelInput>
            <Link
              href={directSerial ? printHref(directSerial) : '#'}
              aria-disabled={!directSerial}
              className={[
                'inline-flex justify-center rounded-2xl px-4 py-3 text-sm font-semibold',
                directSerial ? 'text-white' : 'pointer-events-none opacity-50',
              ].join(' ')}
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              In lại tem
            </Link>
          </div>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={submitSearch}>
        <div className="grid gap-3 md:grid-cols-5">
          <LabelInput label="Mã cọc">
            <select
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
              value={loaiCoc}
              onChange={(event) => setLoaiCoc(event.target.value)}
            >
              <option value="">Chọn mã cọc</option>
              {options.loaiCocOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </LabelInput>

          <LabelInput label="Đoạn">
            <select
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
              value={tenDoan}
              onChange={(event) => setTenDoan(event.target.value)}
            >
              <option value="">Chọn đoạn</option>
              {options.tenDoanOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </LabelInput>

          <LabelInput label="Chiều dài">
            <input
              type="number"
              min="0"
              step="0.001"
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
              placeholder="1"
              value={chieuDaiM}
              onChange={(event) => setChieuDaiM(event.target.value)}
            />
          </LabelInput>

          <LabelInput label="Ngày">
            <input
              type="date"
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
              value={productionDate}
              onChange={(event) => setProductionDate(event.target.value)}
            />
          </LabelInput>

          <LabelInput label="STT">
            <input
              type="number"
              min="1"
              step="1"
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
              placeholder="001"
              value={displaySequence}
              onChange={(event) => setDisplaySequence(event.target.value)}
            />
          </LabelInput>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-2xl px-5 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
            disabled={pending}
          >
            {pending ? 'Đang tìm...' : 'Tìm serial'}
          </button>
        </div>
      </form>

      {error ? (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, white)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      ) : null}

      {candidates.length ? (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead className="bg-[#f6f9fb] text-left text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3">Serial</th>
                <th className="px-4 py-3">Thông tin tem</th>
                {onSelectSerial ? null : <th className="px-4 py-3 text-right">In</th>}
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr
                  key={candidate.serialId}
                  className={['border-t', onSelectSerial ? 'cursor-pointer transition hover:bg-[#f6f9fb]' : ''].join(' ')}
                  style={{ borderColor: 'var(--color-border)' }}
                  onClick={() => {
                    if (onSelectSerial) onSelectSerial(candidate.serialCode)
                  }}
                >
                  <td className="px-4 py-4 font-semibold break-all">{candidate.serialCode}</td>
                  <td className="px-4 py-4 text-[var(--color-muted)]">
                    {(candidate.maCoc || candidate.loaiCoc)} · {candidate.tenDoan} · {formatNumber(candidate.chieuDaiM)}m · #
                    {String(candidate.displaySequence || 0).padStart(3, '0')}
                  </td>
                  {onSelectSerial ? null : (
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={printHref(candidate.serialCode)}
                        className="inline-flex rounded-xl px-3 py-2 text-sm font-semibold text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        In lại tem
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
