'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type LookupOption = {
  value: string
  label: string
}

type AccessoryGroups = {
  matBich: LookupOption[]
  mangXong: LookupOption[]
  muiCoc: LookupOption[]
  tap: LookupOption[]
}

type SteelGroups = {
  pc: LookupOption[]
  dai: LookupOption[]
  buoc: LookupOption[]
}

type TemplatePreset = {
  templateId: string
  loaiCoc: string
  cuongDo: string
  macThep: string
  doNgoai: number | null
  chieuDay: number | null
  macBeTong: string
  kgMd: number | null
  thepPc: string
  pcNos: number | null
  thepDai: string
  donKepFactor: number | null
  thepBuoc: string
  a1Mm: number | null
  a2Mm: number | null
  a3Mm: number | null
  p1Pct: number | null
  p2Pct: number | null
  p3Pct: number | null
  matBich: string
  mangXong: string
  muiCoc: string
  tap: string
}

type Filters = {
  query: string
  cuongDo: string
  macThep: string
  doNgoai: number | null
  chieuDay: number | null
  macBeTong: string
  kgMd: number | null
  thepPc: string
  pcNos: number | null
  thepDai: string
  donKepFactor: number | null
  thepBuoc: string
  a1Mm: number | null
  a2Mm: number | null
  a3Mm: number | null
  p1Pct: number | null
  p2Pct: number | null
  p3Pct: number | null
  chieuDaiM: number | null
  matBich: string
  mangXong: string
  muiCoc: string
  tap: string
}

const CUONG_DO_OPTIONS = ['PC', 'PHC']
const MAC_THEP_OPTIONS = ['A', 'B', 'C']
const MAC_BE_TONG_OPTIONS = ['600', '800']
const DON_KEP_OPTIONS = [
  { value: '1', label: 'Đơn' },
  { value: '2', label: 'Kép' },
]

export function PileTemplateLookupForm({
  filters,
  steelGroups,
  accessoryGroups,
  templatePresets,
}: {
  filters: Filters
  steelGroups: SteelGroups
  accessoryGroups: AccessoryGroups
  templatePresets: TemplatePreset[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [formValues, setFormValues] = useState<Filters>(filters)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    setFormValues(filters)
  }, [filters])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSearchParams = new URLSearchParams()
    const entries: Array<[string, string | number | null]> = [
      ['q', formValues.query],
      ['cuong_do', formValues.cuongDo],
      ['mac_thep', formValues.macThep],
      ['do_ngoai', formValues.doNgoai],
      ['chieu_day', formValues.chieuDay],
      ['kg_md', formValues.kgMd],
      ['mac_be_tong', formValues.macBeTong],
      ['thep_pc', formValues.thepPc],
      ['pc_nos', formValues.pcNos],
      ['thep_dai', formValues.thepDai],
      ['don_kep_factor', formValues.donKepFactor],
      ['thep_buoc', formValues.thepBuoc],
      ['a1_mm', formValues.a1Mm],
      ['a2_mm', formValues.a2Mm],
      ['a3_mm', formValues.a3Mm],
      ['p1_pct', formValues.p1Pct],
      ['p2_pct', formValues.p2Pct],
      ['p3_pct', formValues.p3Pct],
      ['chieu_dai_m', formValues.chieuDaiM],
      ['mat_bich', formValues.matBich],
      ['mang_xong', formValues.mangXong],
      ['mui_coc', formValues.muiCoc],
      ['tap', formValues.tap],
    ]

    for (const [key, rawValue] of entries) {
      const value = rawValue === null ? '' : String(rawValue).trim()
      if (!value) continue
      nextSearchParams.set(key, value)
    }

    const nextQuery = nextSearchParams.toString()
    const currentQuery = searchParams.toString()
    const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname

    setIsSubmitting(true)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsSubmitting(false)
      timeoutRef.current = null
    }, 1800)

    if (nextQuery === currentQuery) return

    startTransition(() => {
      router.replace(nextHref, { scroll: false })
    })
  }

  const showPending = isSubmitting || isPending

  function applyTemplatePreset(templateId: string) {
    setSelectedTemplateId(templateId)
    const preset = templatePresets.find((item) => item.templateId === templateId)
    if (!preset) {
      setFormValues((current) => ({
        ...current,
        query: '',
        cuongDo: '',
        macThep: '',
        doNgoai: null,
        chieuDay: null,
        macBeTong: '',
        kgMd: null,
        thepPc: '',
        pcNos: null,
        thepDai: '',
        donKepFactor: null,
        thepBuoc: '',
        a1Mm: null,
        a2Mm: null,
        a3Mm: null,
        p1Pct: null,
        p2Pct: null,
        p3Pct: null,
        matBich: '',
        mangXong: '',
        muiCoc: '',
        tap: '',
      }))
      return
    }
    setFormValues((current) => ({
      ...current,
      query: preset.loaiCoc,
      cuongDo: preset.cuongDo,
      macThep: preset.macThep,
      doNgoai: preset.doNgoai,
      chieuDay: preset.chieuDay,
      macBeTong: preset.macBeTong,
      kgMd: preset.kgMd,
      thepPc: preset.thepPc,
      pcNos: preset.pcNos,
      thepDai: preset.thepDai,
      donKepFactor: preset.donKepFactor,
      thepBuoc: preset.thepBuoc,
      a1Mm: preset.a1Mm,
      a2Mm: preset.a2Mm,
      a3Mm: preset.a3Mm,
      p1Pct: preset.p1Pct,
      p2Pct: preset.p2Pct,
      p3Pct: preset.p3Pct,
      matBich: preset.matBich,
      mangXong: preset.mangXong,
      muiCoc: preset.muiCoc,
      tap: preset.tap,
      chieuDaiM: current.chieuDaiM,
    }))
  }

  function updateField<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-lg font-semibold">Thông số cọc</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Loại cọc">
          <select
            value={selectedTemplateId}
            onChange={(event) => applyTemplatePreset(event.target.value)}
            className="app-input w-full rounded-xl px-3 py-3 text-sm"
          >
            <option value="">-- chọn để tự điền thông số --</option>
            {templatePresets.map((item) => (
              <option key={item.templateId} value={item.templateId}>
                {item.loaiCoc}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Loại cọc / mã nội bộ">
          <input
            type="text"
            name="q"
            value={formValues.query}
            onChange={(event) => updateField('query', event.target.value)}
            placeholder="VD: PHC - A400 - 65"
            className="app-input w-full rounded-xl px-3 py-3 text-sm"
          />
        </Field>
        <Field label="Cường độ">
          <select value={formValues.cuongDo} onChange={(event) => updateField('cuongDo', event.target.value)} className="app-input w-full rounded-xl px-3 py-3 text-sm">
            <option value="">Tất cả</option>
            {CUONG_DO_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mác thép">
          <select value={formValues.macThep} onChange={(event) => updateField('macThep', event.target.value)} className="app-input w-full rounded-xl px-3 py-3 text-sm">
            <option value="">Tất cả</option>
            {MAC_THEP_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Khối lượng (kg/md)">
          <input
            type="number"
            step="0.001"
            value={formValues.kgMd ?? ''}
            onChange={(event) => updateField('kgMd', event.target.value ? Number(event.target.value) : null)}
            placeholder="140"
            className="app-input w-full rounded-xl px-3 py-3 text-sm"
          />
        </Field>
        <Field label="Mác BT">
          <select value={formValues.macBeTong} onChange={(event) => updateField('macBeTong', event.target.value)} className="app-input w-full rounded-xl px-3 py-3 text-sm">
            <option value="">Tất cả</option>
            {MAC_BE_TONG_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ĐK ngoài (mm)">
          <input
            type="number"
            value={formValues.doNgoai ?? ''}
            onChange={(event) => updateField('doNgoai', event.target.value ? Number(event.target.value) : null)}
            placeholder="400"
            className="app-input w-full rounded-xl px-3 py-3 text-sm"
          />
        </Field>
        <Field label="Thành cọc (mm)">
          <input
            type="number"
            value={formValues.chieuDay ?? ''}
            onChange={(event) => updateField('chieuDay', event.target.value ? Number(event.target.value) : null)}
            placeholder="65"
            className="app-input w-full rounded-xl px-3 py-3 text-sm"
          />
        </Field>
        <SearchField label="Thép PC" value={formValues.thepPc} onChange={(value) => updateField('thepPc', value)} options={steelGroups.pc} placeholder="Gõ để lọc hoặc chọn thép PC" />
        <Field label="Số thanh PC">
          <input
            type="number"
            value={formValues.pcNos ?? ''}
            onChange={(event) => updateField('pcNos', event.target.value ? Number(event.target.value) : null)}
            placeholder="8"
            className="app-input w-full rounded-xl px-3 py-3 text-sm"
          />
        </Field>
        <SearchField label="Thép đai" value={formValues.thepDai} onChange={(value) => updateField('thepDai', value)} options={steelGroups.dai} placeholder="Gõ để lọc hoặc chọn thép đai" />
        <SearchField label="Thép buộc" value={formValues.thepBuoc} onChange={(value) => updateField('thepBuoc', value)} options={steelGroups.buoc} placeholder="Gõ để lọc hoặc chọn thép buộc" />
        <Field label="Đơn/kép (vòng)">
          <select
            value={formValues.donKepFactor !== null ? String(formValues.donKepFactor) : ''}
            onChange={(event) => updateField('donKepFactor', event.target.value ? Number(event.target.value) : null)}
            className="app-input w-full rounded-xl px-3 py-3 text-sm"
          >
            <option value="">Tất cả</option>
            {DON_KEP_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="A1 (mm)">
          <input type="number" value={formValues.a1Mm ?? ''} onChange={(event) => updateField('a1Mm', event.target.value ? Number(event.target.value) : null)} placeholder="100" className="app-input w-full rounded-xl px-3 py-3 text-sm" />
        </Field>
        <Field label="A2 (mm)">
          <input type="number" value={formValues.a2Mm ?? ''} onChange={(event) => updateField('a2Mm', event.target.value ? Number(event.target.value) : null)} placeholder="0" className="app-input w-full rounded-xl px-3 py-3 text-sm" />
        </Field>
        <Field label="A3 (mm)">
          <input type="number" value={formValues.a3Mm ?? ''} onChange={(event) => updateField('a3Mm', event.target.value ? Number(event.target.value) : null)} placeholder="100" className="app-input w-full rounded-xl px-3 py-3 text-sm" />
        </Field>
        <Field label="PctA1">
          <input type="number" step="0.001" value={formValues.p1Pct ?? ''} onChange={(event) => updateField('p1Pct', event.target.value ? Number(event.target.value) : null)} placeholder="0.2" className="app-input w-full rounded-xl px-3 py-3 text-sm" />
        </Field>
        <Field label="PctA2">
          <input type="number" step="0.001" value={formValues.p2Pct ?? ''} onChange={(event) => updateField('p2Pct', event.target.value ? Number(event.target.value) : null)} placeholder="0" className="app-input w-full rounded-xl px-3 py-3 text-sm" />
        </Field>
        <Field label="PctA3">
          <input type="number" step="0.001" value={formValues.p3Pct ?? ''} onChange={(event) => updateField('p3Pct', event.target.value ? Number(event.target.value) : null)} placeholder="0.8" className="app-input w-full rounded-xl px-3 py-3 text-sm" />
        </Field>
        <Field label="Chiều dài cần hỏi tồn (m)">
          <input
            type="number"
            step="0.001"
            value={formValues.chieuDaiM ?? ''}
            onChange={(event) => updateField('chieuDaiM', event.target.value ? Number(event.target.value) : null)}
            placeholder="3 hoặc 10"
            className="app-input w-full rounded-xl px-3 py-3 text-sm"
          />
        </Field>
      </div>

      <div className="border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="text-lg font-semibold">Phụ kiện</h2>
          <p className="app-muted mt-2 text-sm">
            Tùy chọn. Nếu biết đúng phụ kiện đi kèm thì chọn thêm để kết quả khớp sát hơn. Không nhập vẫn tra cứu được
            bình thường.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AccessoryField label="Mặt bích" value={formValues.matBich} onChange={(value) => updateField('matBich', value)} options={accessoryGroups.matBich} />
          <AccessoryField label="Măng xông" value={formValues.mangXong} onChange={(value) => updateField('mangXong', value)} options={accessoryGroups.mangXong} />
          <AccessoryField label="Mũi cọc" value={formValues.muiCoc} onChange={(value) => updateField('muiCoc', value)} options={accessoryGroups.muiCoc} />
          <AccessoryField label="Táp vuông" value={formValues.tap} onChange={(value) => updateField('tap', value)} options={accessoryGroups.tap} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="submit"
          disabled={showPending}
          className="app-primary rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60"
        >
          {showPending ? 'Đang tra cứu...' : 'Tra cứu'}
        </button>
        <a href="/ton-kho/thanh-pham/tra-cuu-coc" className="app-outline rounded-xl px-5 py-3 text-sm font-semibold transition">
          Xóa lọc
        </a>
      </div>
    </form>
  )
}

function Field({
  label,
  children,
}: Readonly<{
  label: string
  children: React.ReactNode
}>) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  )
}

function AccessoryField({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string
  value: string
  onChange: (value: string) => void
  options: LookupOption[]
}>) {
  const listId = `${label}-options`.replace(/\s+/g, '-').toLowerCase()
  return (
    <Field label={label}>
      <>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          list={listId}
          placeholder={`Gõ để lọc hoặc chọn ${label.toLowerCase()}`}
          className="app-input w-full rounded-xl px-3 py-3 text-sm"
        />
        <datalist id={listId}>
          <option value="" />
          {options.map((option) => (
            <option key={option.value} value={option.label} />
          ))}
        </datalist>
      </>
    </Field>
  )
}

function SearchField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: Readonly<{
  label: string
  value: string
  onChange: (value: string) => void
  options: LookupOption[]
  placeholder: string
}>) {
  const listId = `${label}-options`.replace(/\s+/g, '-').toLowerCase()
  return (
    <Field label={label}>
      <>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          list={listId}
          placeholder={placeholder}
          className="app-input w-full rounded-xl px-3 py-3 text-sm"
        />
        <datalist id={listId}>
          <option value="" />
          {options.map((option) => (
            <option key={option.value} value={option.label} />
          ))}
        </datalist>
      </>
    </Field>
  )
}
