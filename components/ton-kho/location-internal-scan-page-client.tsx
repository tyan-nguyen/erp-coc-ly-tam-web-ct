'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { decodeQrFromCanvasImageSource } from '@/lib/qr/decode-image'
import { lookupWarehouseInternalSerial } from '@/lib/ton-kho-thanh-pham/internal-serial-scan-client-api'
import type { WarehouseInternalSerialLookupData } from '@/lib/ton-kho-thanh-pham/internal-serial-scan-types'
import { submitWarehouseLocationAssignment } from '@/lib/ton-kho-thanh-pham/location-assignment-client-api'
import { submitWarehouseLocationTransfer } from '@/lib/ton-kho-thanh-pham/location-transfer-client-api'
import type { WarehouseLocationAssignmentPageData } from '@/lib/ton-kho-thanh-pham/location-assignment-types'
import type { SerialReprintSearchOptions } from '@/lib/pile-serial/repository'
import { SerialReprintSearchPanel } from '@/components/ton-kho/serial-reprint-search-panel'

type BarcodeDetectorResult = {
  rawValue?: string
}

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike
type ActivePanel = 'THONG_SO' | 'TON' | 'SERIAL' | 'BAI'

function normalizeCode(value: string) {
  return String(value || '').trim()
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function ScanQrIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="M4.5 8.5v-3a1 1 0 0 1 1-1h3" />
      <path d="M19.5 8.5v-3a1 1 0 0 0-1-1h-3" />
      <path d="M4.5 15.5v3a1 1 0 0 0 1 1h3" />
      <path d="M19.5 15.5v3a1 1 0 0 1-1 1h-3" />
      <rect x="7.5" y="7.5" width="3.5" height="3.5" rx=".2" />
      <rect x="13" y="7.5" width="3.5" height="3.5" rx=".2" />
      <rect x="7.5" y="13" width="3.5" height="3.5" rx=".2" />
      <path d="M14 13h2.5v1.5H18V17h-4" />
    </svg>
  )
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function ChevronDownIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CheckCircleIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12 2.3 2.3 4.7-5" />
    </svg>
  )
}

function InfoRow(props: { label: string; value: string | number }) {
  return (
    <div
      className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)]"
      style={{ borderTop: '1px solid var(--color-border)' }}
    >
      <div className="text-[var(--color-muted)]">{props.label}</div>
      <div className="min-w-0 break-words text-right font-semibold">{props.value || '-'}</div>
    </div>
  )
}

function SpecTile(props: { label: string; value: string }) {
  return (
    <div className="py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">{props.label}</div>
      <div className="mt-1 text-sm font-semibold break-words">{props.value || '-'}</div>
    </div>
  )
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)
}

function formatNullableNumber(value: number | null, suffix = '') {
  if (value === null) return '-'
  return `${formatNumber(value)}${suffix}`
}

function formatDonKep(value: number | null) {
  if (value === 2) return 'Kép'
  if (value === 1) return 'Đơn'
  return '-'
}

function hasAccessoryDetail(result: WarehouseInternalSerialLookupData) {
  return Boolean(
    result.templateDetail?.accessoryLabels.matBich ||
      result.templateDetail?.accessoryLabels.mangXong ||
      result.templateDetail?.accessoryLabels.muiCoc ||
      result.templateDetail?.accessoryLabels.tap
  )
}

function SectionBlock(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-sm font-semibold">{props.title}</div>
      <div className="mt-2">{props.children}</div>
    </div>
  )
}

export function WarehouseLocationInternalScanPageClient(props: {
  pageData: WarehouseLocationAssignmentPageData
  reprintOptions?: SerialReprintSearchOptions
  autoStartScanner?: boolean
  embedded?: boolean
}) {
  const [serialValue, setSerialValue] = useState('')
  const [lookupPending, setLookupPending] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupInfo, setLookupInfo] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [lookupResult, setLookupResult] = useState<WarehouseInternalSerialLookupData | null>(null)
  const [reprintSearchOpen, setReprintSearchOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<ActivePanel>('THONG_SO')
  const [targetLocationId, setTargetLocationId] = useState('')
  const [actionNote, setActionNote] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerStarting, setScannerStarting] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanInfo, setScanInfo] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const readyTimeoutRef = useRef<number | null>(null)
  const noQrTimeoutRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const detectLockRef = useRef(false)
  const scannerOpenRef = useRef(false)

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  useEffect(() => {
    if (!lookupResult) return
    const preferredLocation =
      props.pageData.locations.find((location) => location.locationId !== lookupResult.currentLocationId)?.locationId || ''
    setTargetLocationId(preferredLocation)
    setActionNote('')
    setActionError('')
    setActionMessage('')
    setActivePanel(lookupResult.locationActionMode === 'NONE' ? 'THONG_SO' : 'BAI')
  }, [lookupResult?.serialId, lookupResult, props.pageData.locations])

  /* eslint-disable react-hooks/exhaustive-deps */
  // startScanner is intentionally invoked only when the overlay/page asks to open camera immediately.
  useEffect(() => {
    if (!props.autoStartScanner || scannerOpen) return
    void startScanner()
  }, [props.autoStartScanner, scannerOpen])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const message = actionMessage || (scannerOpen ? '' : scanInfo) || lookupInfo
    if (!message) {
      setToastMessage('')
      return
    }
    setToastMessage(message)
    const timer = window.setTimeout(() => {
      setToastMessage((current) => (current === message ? '' : current))
      if (actionMessage === message) setActionMessage('')
      if (scanInfo === message) setScanInfo('')
      if (lookupInfo === message) setLookupInfo('')
    }, 1800)
    return () => {
      clearTimeout(timer)
    }
  }, [actionMessage, scanInfo, lookupInfo, scannerOpen])

  function stopScanner() {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    if (readyTimeoutRef.current != null) {
      clearTimeout(readyTimeoutRef.current)
      readyTimeoutRef.current = null
    }
    if (noQrTimeoutRef.current != null) {
      clearTimeout(noQrTimeoutRef.current)
      noQrTimeoutRef.current = null
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    detectLockRef.current = false
    scannerOpenRef.current = false
    setCameraReady(false)
    setScannerOpen(false)
    setScannerStarting(false)
  }

  async function performLookup(code: string, options?: { silent?: boolean }) {
    const normalizedCode = normalizeCode(code)
    if (!normalizedCode) {
      setReprintSearchOpen(true)
      setLookupError('')
      setLookupInfo('')
      return null
    }

    setLookupPending(true)
    setLookupError('')
    if (!options?.silent) {
      setLookupInfo('')
      setActionError('')
      setActionMessage('')
    }

    try {
      const response = await lookupWarehouseInternalSerial({ serialCode: normalizedCode })
      if (!response.data) {
        throw new Error('Không đọc được dữ liệu serial.')
      }
      setLookupResult(response.data)
      setReprintSearchOpen(false)
      setSerialValue(response.data.serialCode)
      if (!options?.silent) {
        setLookupInfo(`Đã nhận serial ${response.data.serialCode}.`)
      }
      return response.data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tra cứu được serial.'
      setLookupError(message)
      setLookupResult(null)
      throw error
    } finally {
      setLookupPending(false)
    }
  }

  async function addSerialFromScan(code: string) {
    const normalizedCode = normalizeCode(code)
    if (!normalizedCode) {
      setScanError('Cần serial hợp lệ.')
      setScanInfo('')
      return
    }

    setScanError('')
    setScanInfo(`Đang tra cứu ${normalizedCode}...`)
    setSerialValue(normalizedCode)

    try {
      await performLookup(normalizedCode)
      setScanInfo(`Đã nhận serial ${normalizedCode}.`)
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Không tra cứu được serial.')
      setScanInfo('')
    }
  }

  function runScanLoop() {
    if (!scannerOpenRef.current || !videoRef.current) return

    const tick = async () => {
      if (!scannerOpenRef.current || !videoRef.current) return
      frameRef.current = requestAnimationFrame(() => {
        void tick()
      })
      if (detectLockRef.current) return
      if (videoRef.current.readyState < 2) return

      detectLockRef.current = true
      try {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        const width = video.videoWidth || 1280
        const height = video.videoHeight || 720
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return

        context.drawImage(video, 0, 0, width, height)

        let rawValue = ''
        if (detectorRef.current) {
          const bitmap = await createImageBitmap(canvas)
          try {
            const codes = await detectorRef.current.detect(bitmap)
            rawValue = String(codes.find((item) => normalizeCode(String(item.rawValue || '')))?.rawValue || '').trim()
          } finally {
            bitmap.close()
          }
        }
        if (!rawValue) {
          rawValue = decodeQrFromCanvasImageSource(canvas)
        }
        if (rawValue) {
          stopScanner()
          await addSerialFromScan(rawValue)
        }
      } catch {
        // Ignore transient detection failures.
      } finally {
        detectLockRef.current = false
      }
    }

    void tick()
  }

  async function startScanner() {
    setScanError('')
    setScanInfo('')
    setScannerStarting(true)

    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!window.isSecureContext && !isLocalhost) {
        throw new Error('Camera trên điện thoại cần HTTPS hoặc localhost. Với môi trường này có thể dùng ảnh QR hoặc dán mã.')
      }

      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector

      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }

      detectorRef.current = Detector ? new Detector({ formats: ['qr_code'] }) : null
      streamRef.current = stream
      scannerOpenRef.current = true
      setScannerOpen(true)
      setScannerStarting(false)
      setCameraReady(false)
      setScanInfo('Camera đang mở. Đưa QR vào giữa khung, giữ rõ trong 1-2 giây.')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }

      readyTimeoutRef.current = window.setTimeout(() => {
        setCameraReady(true)
      }, 800)
      noQrTimeoutRef.current = window.setTimeout(() => {
        setScanInfo('Camera vẫn đang quét nhưng chưa nhận được QR. Hãy để mã sáng rõ, không bị lóa, hoặc chụp/crop sát QR rồi dùng ô tìm kiếm/dán mã.')
      }, 3000)

      runScanLoop()
    } catch (error) {
      stopScanner()
      setScannerStarting(false)
      setScanError(error instanceof Error ? error.message : 'Không bật được camera để quét QR.')
    }
  }

  async function submitLocationAction() {
    if (!lookupResult) return
    if (lookupResult.locationActionMode === 'NONE') return
    if (!targetLocationId) {
      setActionError('Cần chọn bãi để thao tác.')
      setActionMessage('')
      return
    }
    if (lookupResult.locationActionMode === 'TRANSFER' && targetLocationId === lookupResult.currentLocationId) {
      setActionError('Bãi đến phải khác bãi hiện tại.')
      setActionMessage('')
      return
    }

    setActionPending(true)
    setActionError('')
    setActionMessage('')
    try {
      if (lookupResult.locationActionMode === 'ASSIGN') {
        await submitWarehouseLocationAssignment({
          locationId: targetLocationId,
          serialCodesText: lookupResult.serialCode,
          note: actionNote,
        })
      } else {
        await submitWarehouseLocationTransfer({
          fromLocationId: lookupResult.currentLocationId,
          toLocationId: targetLocationId,
          serialCodesText: lookupResult.serialCode,
          note: actionNote,
        })
      }

      const refreshed = await performLookup(lookupResult.serialCode, { silent: true })
      if (!refreshed) throw new Error('Không làm mới được dữ liệu serial sau khi cập nhật.')
      setActionMessage(
        refreshed.locationActionMode === 'NONE'
          ? `Đã cập nhật serial ${lookupResult.serialCode}.`
          : `Đã cập nhật bãi cho serial ${lookupResult.serialCode}.`
      )
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không cập nhật được bãi cho serial.')
    } finally {
      setActionPending(false)
    }
  }

  return (
    <div
      className={[
        'w-full overflow-hidden bg-white',
        props.embedded
          ? 'max-w-none rounded-none border-0 pb-6'
          : 'mx-auto max-w-[460px] rounded-[28px] border pb-8',
      ].join(' ')}
      style={props.embedded ? undefined : { borderColor: 'var(--color-border)' }}
    >
      {toastMessage ? (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ecfdf3] px-3 py-2 text-sm font-medium text-[#15803d] shadow-sm">
            <CheckCircleIcon className="h-4 w-4" />
            <span>Đã nhận</span>
          </div>
        </div>
      ) : null}

      <section className={props.embedded ? 'px-5 py-3.5' : 'px-6 py-6'}>
        {!props.embedded ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-muted)]">Nội bộ</div>
              <div className="mt-1 text-lg font-semibold">Tra cứu serial</div>
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <form
            className="space-y-2.5"
            onSubmit={(event) => {
              event.preventDefault()
              void performLookup(serialValue)
            }}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                type="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-2xl border px-4 py-3 text-sm"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                placeholder="Nhập hoặc quét serial"
                value={serialValue}
                onChange={(event) => setSerialValue(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  if (scannerOpen) stopScanner()
                  else void startScanner()
                }}
                className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                disabled={scannerStarting}
                aria-label={scannerStarting ? 'Đang scan serial' : scannerOpen ? 'Tắt scan serial' : 'Scan serial'}
                title={scannerStarting ? 'Đang scan serial' : scannerOpen ? 'Tắt scan serial' : 'Scan serial'}
              >
                <ScanQrIcon className="h-6 w-6" />
              </button>
              <button
                type="submit"
                className="hidden h-[50px] w-[50px] items-center justify-center rounded-2xl border md:inline-flex"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                disabled={lookupPending}
                aria-label={lookupPending ? 'Đang tra cứu' : 'Tìm serial'}
                title={lookupPending ? 'Đang tra cứu' : 'Tìm serial'}
                >
                  <SearchIcon className="h-5 w-5" />
                </button>
            </div>

            {scannerOpen || scannerStarting ? (
              <div className="space-y-3">
                <div
                  className="overflow-hidden rounded-2xl"
                  style={{ backgroundColor: '#0f172a' }}
                >
                  <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
                  <video
                    ref={videoRef}
                    className="h-[220px] w-full object-cover"
                    muted
                    playsInline
                    autoPlay
                    onLoadedData={() => {
                      if (readyTimeoutRef.current != null) {
                        clearTimeout(readyTimeoutRef.current)
                        readyTimeoutRef.current = null
                      }
                      setCameraReady(true)
                    }}
                  />
                </div>

                <div className="rounded-2xl bg-white px-4 py-3 text-sm">
                  Camera: {cameraReady ? 'Đã lên hình' : scannerOpen ? 'Đang chờ' : 'Chưa bật'}
                </div>
                {scanInfo ? (
                  <div
                    className="rounded-2xl px-4 py-3 text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    {scanInfo}
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>

        {scanError || lookupError ? (
          <div
            className="mt-4 rounded-2xl px-4 py-3 text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, white)',
              color: 'var(--color-danger)',
            }}
          >
            {scanError || lookupError}
          </div>
        ) : null}
      </section>

      {reprintSearchOpen ? (
        <section
          className={props.embedded ? 'border-t px-5 py-5' : 'border-t px-6 py-5'}
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="mb-4">
            <div className="text-lg font-semibold">Tìm serial từ thông tin tem</div>
            <div className="mt-1 text-sm text-[var(--color-muted)]">
              Dùng khi QR bị xước và không đọc được serial, nhưng vẫn còn thông tin mã cọc, đoạn, ngày và STT.
            </div>
          </div>
          <SerialReprintSearchPanel
            options={props.reprintOptions || { loaiCocOptions: [], tenDoanOptions: [] }}
            onSelectSerial={(serialCode) => {
              void performLookup(serialCode)
            }}
          />
        </section>
      ) : null}

      {lookupResult ? (
        <>
          <section className={props.embedded ? 'border-t px-5 py-5' : 'border-t px-6 py-5'} style={{ borderColor: 'var(--color-border)' }}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
              <div className="min-w-0 break-all leading-6">{lookupResult.serialCode}</div>
              <div
                className="text-right leading-6"
                style={{ color: lookupResult.qcStatus === 'DAT' ? '#15803d' : 'var(--color-text)' }}
              >
                {lookupResult.qcLabel}
              </div>
              <div className="min-w-0 text-[var(--color-muted)] leading-6">{lookupResult.itemLabel}</div>
              <div className="text-right leading-6">{lookupResult.currentLocationLabel}</div>
            </div>

            <div className="mt-4">
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-2xl border px-4 py-3 pr-11 text-sm"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                  value={activePanel}
                  onChange={(event) => {
                    const value = event.target.value as ActivePanel | 'IN_TEM'
                    if (value === 'IN_TEM') {
                      window.location.href = `/ton-kho/thanh-pham/in-tem?serial_codes=${encodeURIComponent(lookupResult.serialCode)}`
                      return
                    }
                    setActivePanel(value)
                  }}
                >
                  <option value="THONG_SO">Thông số</option>
                  <option value="TON">Tồn tương ứng</option>
                  <option value="SERIAL">Xem serial</option>
                  <option value="BAI">
                    {lookupResult.locationActionMode === 'ASSIGN'
                      ? 'Chọn bãi'
                      : lookupResult.locationActionMode === 'TRANSFER'
                        ? 'Điều chuyển'
                        : 'Bãi'}
                  </option>
                  <option value="IN_TEM">In lại tem</option>
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              </div>
            </div>
          </section>

          {activePanel === 'THONG_SO' ? (
            <section className={props.embedded ? 'border-t px-5 py-5' : 'border-t px-6 py-5'} style={{ borderColor: 'var(--color-border)' }}>
              <div className="text-lg font-semibold">Thông số cọc</div>
              <div className="mt-4 space-y-4">
                <div className="grid gap-x-5 border-t sm:grid-cols-2 xl:grid-cols-4" style={{ borderColor: 'var(--color-border)' }}>
                  <SpecTile label="Serial" value={lookupResult.serialCode} />
                  <SpecTile label="Mã cọc" value={lookupResult.templateDetail?.maCoc || lookupResult.loaiCoc} />
                  <SpecTile label="Đoạn" value={lookupResult.tenDoan} />
                  <SpecTile label="Chiều dài" value={`${formatNumber(lookupResult.chieuDaiM)}m`} />
                  <SpecTile label="Lô" value={lookupResult.lotCode || '-'} />
                  <SpecTile label="Ngày SX" value={formatDate(lookupResult.productionDate)} />
                  <SpecTile label="Hiển thị" value={lookupResult.visibilityLabel} />
                  <SpecTile label="Bãi" value={lookupResult.currentLocationLabel} />
                </div>

                {lookupResult.templateDetail ? (
                  <>
                    <SectionBlock title="Thông số cọc đầy đủ">
                      <div className="grid gap-x-5 border-t sm:grid-cols-2 xl:grid-cols-4" style={{ borderColor: 'var(--color-border)' }}>
                        <SpecTile label="Cường độ" value={lookupResult.templateDetail.cuongDo || '-'} />
                        <SpecTile label="Mác thép" value={lookupResult.templateDetail.macThep || '-'} />
                        <SpecTile label="ĐK ngoài" value={`${formatNumber(lookupResult.templateDetail.doNgoai)} mm`} />
                        <SpecTile label="Thành cọc" value={`${formatNumber(lookupResult.templateDetail.chieuDay)} mm`} />
                        <SpecTile label="Mác BT" value={lookupResult.templateDetail.macBeTong || '-'} />
                        <SpecTile
                          label="Khối lượng"
                          value={
                            lookupResult.templateDetail.khoiLuongKgMd !== null
                              ? `${formatNumber(lookupResult.templateDetail.khoiLuongKgMd)} kg/md`
                              : '-'
                          }
                        />
                        <SpecTile label="Thép PC" value={lookupResult.templateDetail.steelLabels.pc || '-'} />
                        <SpecTile label="Số thanh PC" value={lookupResult.templateDetail.pcNos !== null ? formatNumber(lookupResult.templateDetail.pcNos) : '-'} />
                        <SpecTile label="Thép đai" value={lookupResult.templateDetail.steelLabels.dai || '-'} />
                        <SpecTile label="Đơn/kép" value={formatDonKep(lookupResult.templateDetail.donKepFactor)} />
                        <SpecTile label="Thép buộc" value={lookupResult.templateDetail.steelLabels.buoc || '-'} />
                        <SpecTile label="A1" value={formatNullableNumber(lookupResult.templateDetail.a1Mm, ' mm')} />
                        <SpecTile label="A2" value={formatNullableNumber(lookupResult.templateDetail.a2Mm, ' mm')} />
                        <SpecTile label="A3" value={formatNullableNumber(lookupResult.templateDetail.a3Mm, ' mm')} />
                        <SpecTile label="PctA1" value={formatNullableNumber(lookupResult.templateDetail.p1Pct)} />
                        <SpecTile label="PctA2" value={formatNullableNumber(lookupResult.templateDetail.p2Pct)} />
                        <SpecTile label="PctA3" value={formatNullableNumber(lookupResult.templateDetail.p3Pct)} />
                      </div>
                    </SectionBlock>

                    {hasAccessoryDetail(lookupResult) ? (
                      <SectionBlock title="Phụ kiện theo loại cọc">
                        <div className="grid gap-x-5 border-t sm:grid-cols-2 xl:grid-cols-4" style={{ borderColor: 'var(--color-border)' }}>
                          <SpecTile label="Mặt bích" value={lookupResult.templateDetail.accessoryLabels.matBich || '-'} />
                          <SpecTile label="Măng xông" value={lookupResult.templateDetail.accessoryLabels.mangXong || '-'} />
                          <SpecTile label="Mũi cọc" value={lookupResult.templateDetail.accessoryLabels.muiCoc || '-'} />
                          <SpecTile label="Táp vuông" value={lookupResult.templateDetail.accessoryLabels.tap || '-'} />
                        </div>
                      </SectionBlock>
                    ) : null}

                    <SectionBlock title="Preview kỹ thuật">
                      <div className="grid gap-x-5 border-t sm:grid-cols-3" style={{ borderColor: 'var(--color-border)' }}>
                        <SpecTile
                          label="RA dài hạn"
                          value={`${formatNumber(lookupResult.templateDetail.techPreview.ra_l)} tấn`}
                        />
                        <SpecTile
                          label="RA ngắn hạn"
                          value={`${formatNumber(lookupResult.templateDetail.techPreview.ra_s)} tấn`}
                        />
                        <SpecTile
                          label="Mcr"
                          value={`${formatNumber(lookupResult.templateDetail.techPreview.mcr)} (t.m)`}
                        />
                      </div>
                    </SectionBlock>
                  </>
                ) : (
                  <div
                    className="border-t pt-4 text-sm"
                    style={{
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    Chưa map được bộ thông số loại cọc mẫu cho serial này. Vẫn xem được thông tin tồn và trạng thái serial, nhưng
                    phần thông số kỹ thuật/phụ kiện cần bổ sung mapping ở `dm_coc_template`.
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {activePanel === 'TON' ? (
            <section className={props.embedded ? 'border-t px-5 py-5' : 'border-t px-6 py-5'} style={{ borderColor: 'var(--color-border)' }}>
              <div className="text-lg font-semibold">Tồn tương ứng</div>
              <div className="mt-4 grid grid-cols-2 gap-x-5 border-t sm:grid-cols-4" style={{ borderColor: 'var(--color-border)' }}>
                {[
                  { label: 'Tồn vật lý', value: lookupResult.physicalQty },
                  { label: 'Dự án', value: lookupResult.projectQty },
                  { label: 'Khách lẻ', value: lookupResult.retailQty },
                  { label: 'Chờ xử lý', value: lookupResult.holdQty },
                ].map((item) => (
                  <div key={item.label} className="py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">{item.label}</div>
                    <div className="mt-1 text-xl font-semibold leading-none">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-[var(--color-muted)]">Cùng mã hiện đang có {lookupResult.currentItemSerialCount} serial còn trong tồn.</div>
            </section>
          ) : null}

          {activePanel === 'SERIAL' ? (
            <section className={props.embedded ? 'border-t px-5 py-5' : 'border-t px-6 py-5'} style={{ borderColor: 'var(--color-border)' }}>
              <div className="text-lg font-semibold">Trạng thái serial</div>
              <div className="mt-3 space-y-1">
                <InfoRow label="Chất lượng" value={lookupResult.qcLabel} />
                <InfoRow label="Trạng thái" value={lookupResult.lifecycleLabel} />
                <InfoRow label="Bãi hiện tại" value={lookupResult.currentLocationLabel} />
                <InfoRow label="Ghi chú" value={lookupResult.note || '-'} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/ton-kho/thanh-pham?item=${encodeURIComponent(lookupResult.itemKey)}`}
                  className="rounded-2xl border px-4 py-2.5 text-sm font-semibold"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  Mở tồn kho
                </Link>
                {lookupResult.currentLocationId ? (
                  <Link
                    href={`/ton-kho/thanh-pham/vi-tri-bai?location=${encodeURIComponent(lookupResult.currentLocationId)}`}
                    className="rounded-2xl border px-4 py-2.5 text-sm font-semibold"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    Mở theo bãi
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {activePanel === 'BAI' ? (
            <section className={props.embedded ? 'border-t px-5 py-5' : 'border-t px-6 py-5'} style={{ borderColor: 'var(--color-border)' }}>
              <div className="text-lg font-semibold">
                {lookupResult.locationActionMode === 'ASSIGN'
                  ? 'Chọn bãi cho serial'
                  : lookupResult.locationActionMode === 'TRANSFER'
                    ? 'Điều chuyển'
                    : 'Thao tác bãi'}
              </div>
              {lookupResult.locationActionMode === 'NONE' ? (
                <div
                  className="mt-4 rounded-2xl px-4 py-4 text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, white 97%, var(--color-primary) 2%)',
                  }}
                >
                  Serial này hiện không còn nằm trong tồn kho, nên màn nội bộ chỉ cho xem thông tin chứ không gán hoặc điều chuyển bãi.
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-3">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium">{lookupResult.locationActionMode === 'TRANSFER' ? 'Bãi đến' : 'Bãi đích'}</span>
                      <select
                        className="w-full rounded-2xl border px-4 py-3 text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                        value={targetLocationId}
                        onChange={(event) => setTargetLocationId(event.target.value)}
                      >
                        <option value="">-- chọn bãi --</option>
                        {props.pageData.locations.map((location) => (
                          <option key={location.locationId} value={location.locationId}>
                            {location.locationLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-3 block space-y-2">
                      <span className="text-sm font-medium">Ghi chú</span>
                      <input
                        className="w-full rounded-2xl border px-4 py-3 text-sm"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                        placeholder="Ghi chú nếu cần"
                        value={actionNote}
                        onChange={(event) => setActionNote(event.target.value)}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    disabled={actionPending}
                    onClick={() => {
                      void submitLocationAction()
                    }}
                  >
                    {actionPending
                      ? 'Đang cập nhật...'
                      : lookupResult.locationActionMode === 'TRANSFER'
                        ? 'Xác nhận'
                        : 'Xác nhận gán bãi'}
                  </button>
                </>
              )}

              {actionMessage ? (
                <div
                  className="mt-4 rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
                    color: 'var(--color-primary)',
                  }}
                >
                  {actionMessage}
                </div>
              ) : null}

              {actionError ? (
                <div
                  className="mt-4 rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, white)',
                    color: 'var(--color-danger)',
                  }}
                >
                  {actionError}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
