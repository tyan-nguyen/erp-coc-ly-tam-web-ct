'use client'

import { useMemo, useState } from 'react'
import {
  ACCESSORY_KIND_OPTIONS,
  DVT_OPTIONS,
  STEEL_KIND_OPTIONS,
  buildAccessoryCode,
  buildAccessoryName,
  buildSteelCode,
  buildSteelName,
  formatNhomHangLabel,
  type AccessoryKind,
  type SteelKind,
} from '@/lib/master-data/nvl'

type NvlCreateFormProps = {
  groupOptions: string[]
  existingItems: Array<{
    nvl_id: string
    ten_hang: string
    nhom_hang: string
    dvt: string
    ma_hien_thi: string
  }>
}

export function NvlCreateForm({ groupOptions, existingItems }: NvlCreateFormProps) {
  const resolvedGroupOptions = useMemo(
    () =>
      Array.from(
        new Set(['THEP', 'NVL', 'VAT_TU_PHU', 'PHU_KIEN', 'TAI_SAN', 'CONG_CU_DUNG_CU', ...groupOptions.filter(Boolean)])
      ),
    [groupOptions]
  )
  const [nhomHang, setNhomHang] = useState('')
  const [phuKienKind, setPhuKienKind] = useState<AccessoryKind | ''>('')
  const [thepKind, setThepKind] = useState<SteelKind | ''>('')
  const [ngangMm, setNgangMm] = useState('')
  const [rongMm, setRongMm] = useState('')
  const [dayMm, setDayMm] = useState('')
  const [soLo, setSoLo] = useState('')
  const [duongKinhMm, setDuongKinhMm] = useState('')
  const [tenHangText, setTenHangText] = useState('')
  const [donGiaText, setDonGiaText] = useState('0')
  const [dvtText, setDvtText] = useState('kg')
  const [haoHutPctText, setHaoHutPctText] = useState('0')

  const isAccessory = nhomHang === 'PHU_KIEN'
  const isSteel = nhomHang === 'THEP'
  const dvtValue = isAccessory ? dvtText || 'cái' : isSteel ? 'kg' : dvtText

  const previewName = useMemo(
    () =>
      phuKienKind
        ? buildAccessoryName(phuKienKind, {
            ngangMm: Number(ngangMm || 0),
            rongMm: Number(rongMm || 0),
            dayMm: Number(dayMm || 0),
            soLo: Number(soLo || 0),
          })
        : '',
    [dayMm, ngangMm, phuKienKind, rongMm, soLo]
  )
  const previewCode = useMemo(
    () =>
      phuKienKind
        ? buildAccessoryCode(phuKienKind, {
            ngangMm: Number(ngangMm || 0),
            rongMm: Number(rongMm || 0),
            dayMm: Number(dayMm || 0),
            soLo: Number(soLo || 0),
          })
        : '',
    [dayMm, ngangMm, phuKienKind, rongMm, soLo]
  )
  const previewSteelName = useMemo(
    () => (thepKind ? buildSteelName(thepKind, Number(duongKinhMm || 0)) : ''),
    [duongKinhMm, thepKind]
  )
  const previewSteelCode = useMemo(
    () => (thepKind ? buildSteelCode(thepKind, Number(duongKinhMm || 0)) : ''),
    [duongKinhMm, thepKind]
  )
  const similarItems = useMemo(() => {
    const normalizedText = normalizeForCompare(tenHangText)

    return existingItems
      .map((item) => ({
        ...item,
        accessoryMeta: inferAccessoryMeta(item),
        steelMeta: inferSteelMeta(item),
        haystack: normalizeForCompare(`${item.ma_hien_thi} ${item.ten_hang} ${item.nhom_hang}`),
      }))
      .filter((item) => {
        if (isAccessory) {
          if (item.nhom_hang !== 'PHU_KIEN') return false
          if (item.accessoryMeta.kind && item.accessoryMeta.kind !== phuKienKind) return false
          if (ngangMm && item.accessoryMeta.ngangMm !== Number(ngangMm)) return false
          if (rongMm && item.accessoryMeta.rongMm !== Number(rongMm)) return false
          if (dayMm && item.accessoryMeta.dayMm !== Number(dayMm)) return false
          if (soLo && item.accessoryMeta.soLo !== Number(soLo)) return false
          return true
        }

        if (isSteel) {
          if (item.nhom_hang !== 'THEP') return false
          if (item.steelMeta.kind && item.steelMeta.kind !== thepKind) return false
          if (duongKinhMm && item.steelMeta.duongKinhMm !== Number(duongKinhMm)) return false
          return true
        }

        if (!normalizedText) return false
        return item.nhom_hang === nhomHang && item.haystack.includes(normalizedText)
      })
      .slice(0, 8)
  }, [dayMm, duongKinhMm, existingItems, isAccessory, isSteel, ngangMm, nhomHang, phuKienKind, rongMm, soLo, tenHangText, thepKind])

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Nhóm hàng (bắt buộc)">
          <select
            name="nhom_hang"
            value={nhomHang}
            onChange={(event) => {
              const nextGroup = event.target.value
              setNhomHang(nextGroup)
              if (nextGroup !== 'PHU_KIEN') setPhuKienKind('')
              if (nextGroup !== 'THEP') setThepKind('')
              if (nextGroup === 'THEP') setDvtText('kg')
              if (nextGroup === 'PHU_KIEN') setDvtText('cái')
              if (
                (nextGroup === 'NVL' ||
                  nextGroup === 'VAT_TU_PHU' ||
                  nextGroup === 'TAI_SAN' ||
                  nextGroup === 'CONG_CU_DUNG_CU') &&
                !DVT_OPTIONS.includes(dvtText as (typeof DVT_OPTIONS)[number])
              ) {
                setDvtText('kg')
              }
            }}
            className="app-input w-full rounded-xl px-3 py-3 text-sm uppercase"
          >
            <option value="">Chọn...</option>
            {resolvedGroupOptions.map((item) => (
              <option key={item} value={item}>
                {formatNhomHangLabel(item)}
              </option>
            ))}
          </select>
        </Field>

        {isAccessory ? (
          <div key="accessory-fields" className="contents">
            <Field label="Loại phụ kiện (bắt buộc)" className="xl:col-span-2">
              <select
                name="phu_kien_kind"
                value={phuKienKind}
                onChange={(event) => setPhuKienKind(event.target.value as AccessoryKind)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              >
                <option value="">Chọn...</option>
                {ACCESSORY_KIND_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ĐVT">
              <select
                name="dvt"
                value={dvtValue}
                onChange={(event) => setDvtText(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              >
                {DVT_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Đơn giá chưa VAT">
              <input
                type="number"
                step="0.001"
                name="don_gia"
                value={donGiaText}
                onChange={(event) => setDonGiaText(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <Field label="% hao hụt cho phép">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="hao_hut_pct"
                  value={haoHutPctText}
                  onChange={(event) => setHaoHutPctText(event.target.value)}
                  placeholder="Ví dụ: 3 = 3%"
                  className="app-input w-full rounded-xl px-3 py-3 text-sm"
                />
                <span className="app-muted text-sm font-semibold">%</span>
              </div>
            </Field>
            <Field label="Ngang (mm)">
              <input
                type="number"
                name="ngang_mm"
                value={ngangMm}
                onChange={(event) => setNgangMm(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <Field label="Rộng (mm)">
              <input
                type="number"
                name="rong_mm"
                value={rongMm}
                onChange={(event) => setRongMm(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <Field label="Dày (mm)">
              <input
                type="number"
                name="day_mm"
                value={dayMm}
                onChange={(event) => setDayMm(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <Field label="Số lỗ">
              <input
                type="number"
                name="so_lo"
                value={soLo}
                onChange={(event) => setSoLo(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <div className="xl:col-span-4 grid gap-4 rounded-2xl border p-4 md:grid-cols-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-background) 55%, white)' }}>
              <PreviewRow label="Tên hàng sẽ tạo" value={previewName} />
              <PreviewRow label="Mã hàng sẽ tạo" value={previewCode} />
            </div>
            <input type="hidden" name="ten_hang" value={previewName} />
          </div>
        ) : isSteel ? (
          <div key="steel-fields" className="contents">
            <Field label="Loại thép (bắt buộc)" className="xl:col-span-2">
              <select
                name="thep_kind"
                value={thepKind}
                onChange={(event) => setThepKind(event.target.value as SteelKind)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              >
                <option value="">Chọn...</option>
                {STEEL_KIND_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ĐVT">
              <input
                type="text"
                name="dvt"
                value={dvtValue}
                readOnly
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <Field label="Đơn giá chưa VAT">
              <input
                type="number"
                step="0.001"
                name="don_gia"
                value={donGiaText}
                onChange={(event) => setDonGiaText(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <Field label="% hao hụt cho phép">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="hao_hut_pct"
                  value={haoHutPctText}
                  onChange={(event) => setHaoHutPctText(event.target.value)}
                  placeholder="Ví dụ: 3 = 3%"
                  className="app-input w-full rounded-xl px-3 py-3 text-sm"
                />
                <span className="app-muted text-sm font-semibold">%</span>
              </div>
            </Field>
            <Field label="Đường kính (mm)">
              <input
                type="number"
                name="duong_kinh_mm"
                value={duongKinhMm}
                onChange={(event) => setDuongKinhMm(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <div className="xl:col-span-4 grid gap-4 rounded-2xl border p-4 md:grid-cols-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-background) 55%, white)' }}>
              <PreviewRow label="Tên hàng sẽ tạo" value={previewSteelName} />
              <PreviewRow label="Mã hàng sẽ tạo" value={previewSteelCode} />
            </div>
            <input type="hidden" name="ten_hang" value={previewSteelName} />
          </div>
        ) : nhomHang ? (
          <div key="material-fields" className="contents">
            <Field label="Tên hàng (bắt buộc)" className="xl:col-span-2">
              <input
                type="text"
                name="ten_hang"
                required
                value={tenHangText}
                onChange={(event) => setTenHangText(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <Field label="ĐVT (bắt buộc)">
              <select
                name="dvt"
                value={dvtValue}
                required
                onChange={(event) => setDvtText(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              >
                {DVT_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Đơn giá chưa VAT">
              <input
                type="number"
                step="0.001"
                name="don_gia"
                value={donGiaText}
                onChange={(event) => setDonGiaText(event.target.value)}
                className="app-input w-full rounded-xl px-3 py-3 text-sm"
              />
            </Field>
            <Field label="% hao hụt cho phép">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="hao_hut_pct"
                  value={haoHutPctText}
                  onChange={(event) => setHaoHutPctText(event.target.value)}
                  placeholder="Ví dụ: 3 = 3%"
                  className="app-input w-full rounded-xl px-3 py-3 text-sm"
                />
                <span className="app-muted text-sm font-semibold">%</span>
              </div>
            </Field>
          </div>
        ) : (
          <div className="xl:col-span-4 rounded-2xl border px-4 py-4 text-sm app-muted" style={{ borderColor: 'var(--color-border)' }}>
            Chọn `Nhóm hàng` trước để hệ thống hiện đúng các trường cần nhập.
          </div>
        )}
      </div>
      {similarItems.length > 0 ? (
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-accent) 18%, var(--color-border))',
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 4%, white)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                Vật tư gần giống
              </p>
              <p className="app-muted mt-1 text-xs">
                Kiểm tra nhanh để tránh tạo trùng hoặc tạo lệch quy cách.
              </p>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, white)', color: 'var(--color-accent)' }}>
              {similarItems.length} mục
            </span>
          </div>
          <div className="mt-3 overflow-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  {['Mã hàng', 'Tên hàng', 'Nhóm hàng', 'ĐVT'].map((label) => (
                    <th key={label} className="px-3 py-2 font-semibold whitespace-nowrap" style={{ backgroundColor: 'var(--color-surface)' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {similarItems.map((item) => (
                  <tr key={item.nvl_id} className="border-b" style={{ borderColor: 'color-mix(in srgb, var(--color-border) 72%, white)' }}>
                    <td className="px-3 py-2 whitespace-nowrap">{item.ma_hien_thi}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.ten_hang}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatNhomHangLabel(item.nhom_hang)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{item.dvt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <p className="app-muted text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  )
}

function normalizeForCompare(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function inferAccessoryMeta(item: {
  ma_hien_thi: string
  ten_hang: string
}) {
  const source = `${item.ma_hien_thi} ${item.ten_hang}`.toUpperCase()
  const dimsMatch = source.match(/(\d+)(?:X(\d+))?(?:X(\d+))?(?:X(\d+)LO)?/)

  let kind: AccessoryKind | '' = ''
  if (source.includes('PK-MB') || source.includes('MẶT BÍCH') || source.includes('MAT BICH')) kind = 'MAT_BICH'
  else if (source.includes('PK-MX') || source.includes('MĂNG XÔNG') || source.includes('MANG XONG')) kind = 'MANG_XONG'
  else if (source.includes('PK-MCR') || source.includes('MŨI CỌC RỜI') || source.includes('MUI COC ROI')) kind = 'MUI_COC_ROI'
  else if (source.includes('PK-MCL') || source.includes('MŨI CỌC LIỀN') || source.includes('MUI COC LIEN')) kind = 'MUI_COC_LIEN'
  else if (source.includes('PK-TV') || source.includes('TẤM VUÔNG') || source.includes('TAM VUONG')) kind = 'TAM_VUONG'

  return {
    kind,
    ngangMm: dimsMatch?.[1] ? Number(dimsMatch[1]) : undefined,
    rongMm: dimsMatch?.[2] ? Number(dimsMatch[2]) : undefined,
    dayMm: dimsMatch?.[3] ? Number(dimsMatch[3]) : undefined,
    soLo: dimsMatch?.[4] ? Number(dimsMatch[4]) : undefined,
  }
}

function inferSteelMeta(item: {
  ten_hang: string
  ma_hien_thi: string
}) {
  const source = `${item.ma_hien_thi} ${item.ten_hang}`.toUpperCase()
  const diameterMatch = source.match(/(\d+(?:\.\d+)?)/)

  let kind: SteelKind | '' = ''
  if (source.includes('TPC') || source.includes('THÉP PC') || source.includes('THEP PC')) kind = 'THEP_PC'
  else if (source.includes('TDAI') || source.includes('THÉP ĐAI') || source.includes('THEP DAI')) kind = 'THEP_DAI'
  else if (source.includes('TBUOC') || source.includes('THÉP BUỘC') || source.includes('THEP BUOC')) kind = 'THEP_BUOC'

  return {
    kind,
    duongKinhMm: diameterMatch?.[1] ? Number(diameterMatch[1]) : undefined,
  }
}
