'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { decodeQrFromImageFile } from '@/lib/qr/decode-image'
import { submitWarehouseLocationTransfer } from '@/lib/ton-kho-thanh-pham/location-transfer-client-api'
import type {
  WarehouseLocationAssignmentPageData,
  WarehouseLocationTransferResult,
} from '@/lib/ton-kho-thanh-pham/location-assignment-types'

type BarcodeDetectorResult = {
  rawValue?: string
}

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

function normalizeCode(value: string) {
  return String(value || '').trim()
}

function normalizeLocationCode(value: string) {
  const normalized = normalizeCode(value)
  if (!normalized) return ''
  const withoutPrefix = normalized.toUpperCase().startsWith('WHLOC:') ? normalized.slice(6) : normalized
  return normalizeCode(withoutPrefix).toUpperCase()
}

function appendSerialCode(existing: string, nextCode: string) {
  const normalized = normalizeCode(nextCode)
  if (!normalized) return existing
  const current = String(existing || '')
    .split(/[\n,;\t ]+/)
    .map((item) => normalizeCode(item))
    .filter(Boolean)
  if (current.includes(normalized)) return existing
  return current.length ? `${current.join('\n')}\n${normalized}` : normalized
}

function buildTransferIssueMessage(result: WarehouseLocationTransferResult) {
  const missingPreview = result.missingCodes.slice(0, 2)
  const skippedPreview = result.skippedRows.slice(0, 2).map((row) => `${row.serialCode}: ${row.reason}`)
  const details = [...missingPreview, ...skippedPreview].filter(Boolean)

  if (!details.length) {
    return 'Không có serial hợp lệ để điều chuyển bãi.'
  }

  return `Không có serial hợp lệ để điều chuyển bãi. ${details.join(' | ')}`
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

function LocationSelectorCard(props: {
  title: string
  stepLabel: string
  mode: 'LIST' | 'SCAN'
  onModeChange: (mode: 'LIST' | 'SCAN') => void
  selectedLocationId: string
  selectedLocationLabel: string
  locations: WarehouseLocationAssignmentPageData['locations']
  blockedLocationId?: string
  placeholder: string
  scanPrompt: string
  selectedLabel: string
  onSelectLocation: (locationId: string) => void
}) {
  const [scanValue, setScanValue] = useState('')
  const [scanInfo, setScanInfo] = useState('')
  const [scanError, setScanError] = useState('')
  const [imagePending, setImagePending] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerStarting, setScannerStarting] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const readyTimeoutRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const detectLockRef = useRef(false)

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  useEffect(() => {
    if (props.mode !== 'SCAN') {
      stopScanner()
      setScanValue('')
    }
  }, [props.mode])

  function stopScanner() {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    if (readyTimeoutRef.current != null) {
      clearTimeout(readyTimeoutRef.current)
      readyTimeoutRef.current = null
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
    setCameraReady(false)
    setScannerOpen(false)
    setScannerStarting(false)
  }

  function selectLocationFromCode(rawCode: string) {
    const normalized = normalizeLocationCode(rawCode)
    if (!normalized) {
      setScanError('Cần mã bãi hợp lệ.')
      setScanInfo('')
      return false
    }

    const matched = props.locations.find((location) => normalizeLocationCode(location.locationCode) === normalized)
    if (!matched) {
      setScanError(`Không tìm thấy bãi nào khớp mã ${normalized}.`)
      setScanInfo('')
      return false
    }

    if (props.blockedLocationId && matched.locationId === props.blockedLocationId) {
      setScanError('Bãi nguồn và bãi đích không được trùng nhau.')
      setScanInfo('')
      return false
    }

    props.onSelectLocation(matched.locationId)
    setScanError('')
    setScanInfo(`${props.selectedLabel}: ${matched.locationLabel}`)
    return true
  }

  async function scanImageFile(file: File) {
    setScanError('')
    setScanInfo('')
    setImagePending(true)
    try {
      const rawValue = await decodeQrFromImageFile(file)
      if (!rawValue) {
        throw new Error('Không đọc được QR bãi từ ảnh này. Hãy thử ảnh rõ hơn hoặc crop sát mã QR.')
      }
      selectLocationFromCode(rawValue)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Không đọc được QR bãi từ ảnh.')
      setScanInfo('')
    } finally {
      setImagePending(false)
    }
  }

  function runScanLoop() {
    if (!scannerOpen || !videoRef.current || !detectorRef.current) return

    const tick = async () => {
      if (!scannerOpen || !videoRef.current || !detectorRef.current) return
      frameRef.current = requestAnimationFrame(() => {
        void tick()
      })
      if (detectLockRef.current) return
      if (videoRef.current.readyState < 2) return

      detectLockRef.current = true
      try {
        const codes = await detectorRef.current.detect(videoRef.current)
        const rawValue = String(codes.find((item) => normalizeCode(String(item.rawValue || '')))?.rawValue || '').trim()
        if (rawValue) {
          const ok = selectLocationFromCode(rawValue)
          if (ok) stopScanner()
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
        throw new Error('Camera scan trên điện thoại cần HTTPS hoặc localhost. Với môi trường hiện tại có thể dùng ảnh QR hoặc dán mã bãi.')
      }

      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      if (!Detector) {
        throw new Error('Trình duyệt này chưa hỗ trợ quét QR bãi bằng camera. Vẫn có thể dùng ảnh QR hoặc dán mã.')
      }

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

      detectorRef.current = new Detector({ formats: ['qr_code'] })
      streamRef.current = stream
      setScannerOpen(true)
      setCameraReady(false)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.autoplay = true
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        await videoRef.current.play()
      }

      readyTimeoutRef.current = window.setTimeout(() => {
        setScanError('Camera đã bật nhưng chưa lên hình. Hãy kiểm tra quyền Camera của browser hoặc dùng quét từ ảnh.')
      }, 2500)

      setScanInfo(props.scanPrompt)
      runScanLoop()
    } catch (err) {
      stopScanner()
      setScanError(err instanceof Error ? err.message : 'Không bật được camera để quét QR bãi.')
    } finally {
      setScannerStarting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="app-muted text-xs uppercase tracking-[0.18em]">{props.stepLabel}</div>
          <div className="text-sm font-semibold">{props.title}</div>
        </div>
        <div
          className="inline-flex rounded-2xl p-1"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
        >
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${props.mode === 'LIST' ? 'text-white' : ''}`}
            style={{
              backgroundColor: props.mode === 'LIST' ? 'var(--color-primary)' : 'transparent',
              color: props.mode === 'LIST' ? 'white' : undefined,
            }}
            onClick={() => props.onModeChange('LIST')}
          >
            Danh sách
          </button>
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${props.mode === 'SCAN' ? 'text-white' : ''}`}
            style={{
              backgroundColor: props.mode === 'SCAN' ? 'var(--color-primary)' : 'transparent',
              color: props.mode === 'SCAN' ? 'white' : undefined,
            }}
            onClick={() => props.onModeChange('SCAN')}
          >
            Scan
          </button>
        </div>
      </div>

      {props.mode === 'LIST' ? (
        <select
          className="w-full rounded-xl border px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          value={props.selectedLocationId}
          onChange={(event) => {
            setScanError('')
            setScanInfo('')
            props.onSelectLocation(event.target.value)
          }}
        >
          <option value="">{props.placeholder}</option>
          {props.locations
            .filter((location) => !props.blockedLocationId || location.locationId !== props.blockedLocationId)
            .map((location) => (
              <option key={location.locationId} value={location.locationId}>
                {location.locationLabel}
              </option>
            ))}
        </select>
      ) : (
        <div className="space-y-4">
          <div
            className="rounded-2xl p-3 space-y-3"
            style={{ backgroundColor: 'color-mix(in srgb, white 96%, var(--color-primary) 2%)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--color-muted)]">Camera QR bãi</div>
              <button
                type="button"
                onClick={() => {
                  if (scannerOpen) stopScanner()
                  else void startScanner()
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                disabled={scannerStarting}
                aria-label={scannerStarting ? 'Đang scan bãi' : scannerOpen ? 'Tắt scan bãi' : 'Scan bãi'}
                title={scannerStarting ? 'Đang scan bãi' : scannerOpen ? 'Tắt scan bãi' : 'Scan bãi'}
              >
                <ScanQrIcon className="h-6 w-6" />
              </button>
            </div>

            {scannerOpen || scannerStarting ? (
              <div
                className="overflow-hidden rounded-2xl border"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: '#0f172a',
                }}
              >
                <video
                  ref={videoRef}
                  className="h-[180px] w-full object-cover sm:h-[220px]"
                  onLoadedData={() => {
                    if (readyTimeoutRef.current != null) {
                      clearTimeout(readyTimeoutRef.current)
                      readyTimeoutRef.current = null
                    }
                    setCameraReady(true)
                  }}
                />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                className="w-full rounded-xl border px-3 py-2.5 text-sm sm:col-span-3"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                placeholder="Dán mã bãi"
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
              />
              <button
                type="button"
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                onClick={() => {
                  if (selectLocationFromCode(scanValue)) setScanValue('')
                }}
              >
                Chọn từ mã
              </button>
              <label
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold cursor-pointer text-center"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
              >
                {imagePending ? 'Đang đọc ảnh...' : 'Ảnh QR bãi'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void scanImageFile(file)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
              {(scannerOpen || scannerStarting) && cameraReady ? (
                <div className="flex items-center justify-end px-1 text-xs text-[var(--color-muted)]">Đang quét</div>
              ) : (
                <div />
              )}
            </div>
          </div>

          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            {props.selectedLabel}: <span className="font-semibold">{props.selectedLocationLabel || 'Chưa chọn'}</span>
          </div>
        </div>
      )}

      {scanInfo ? (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
            color: 'var(--color-primary)',
          }}
        >
          {scanInfo}
        </div>
      ) : null}

      {scanError ? (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-danger)',
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, white)',
            color: 'var(--color-danger)',
          }}
        >
          {scanError}
        </div>
      ) : null}
    </div>
  )
}

export function WarehouseLocationTransferPageClient(props: {
  pageData: WarehouseLocationAssignmentPageData
}) {
  const [fromMode, setFromMode] = useState<'LIST' | 'SCAN'>('LIST')
  const [toMode, setToMode] = useState<'LIST' | 'SCAN'>('LIST')
  const [serialInputMode, setSerialInputMode] = useState<'LIST' | 'SCAN'>('LIST')
  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [serialCodesText, setSerialCodesText] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<WarehouseLocationTransferResult | null>(null)
  const [scanValue, setScanValue] = useState('')
  const [scanPending, setScanPending] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerStarting, setScannerStarting] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [scanInfo, setScanInfo] = useState('')
  const [scanError, setScanError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const readyTimeoutRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const detectLockRef = useRef(false)
  const fromLocationLabel =
    props.pageData.locations.find((location) => location.locationId === fromLocationId)?.locationLabel || ''
  const toLocationLabel =
    props.pageData.locations.find((location) => location.locationId === toLocationId)?.locationLabel || ''
  const serialLineCount = serialCodesText
    ? serialCodesText
        .split('\n')
        .map((item) => normalizeCode(item))
        .filter(Boolean).length
    : 0
  const serialTextareaRows = Math.min(10, Math.max(4, serialLineCount + 1))
  const sourceLocations = useMemo(
    () => props.pageData.locations.filter((location) => location.locationId !== toLocationId),
    [props.pageData.locations, toLocationId]
  )
  const targetLocations = useMemo(
    () => props.pageData.locations.filter((location) => location.locationId !== fromLocationId),
    [props.pageData.locations, fromLocationId]
  )

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  useEffect(() => {
    if (serialInputMode !== 'SCAN') {
      stopScanner()
      setScanValue('')
    }
  }, [serialInputMode])

  useEffect(() => {
    if (fromLocationId && fromLocationId === toLocationId) {
      setToLocationId('')
    }
  }, [fromLocationId, toLocationId])

  function stopScanner() {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    if (readyTimeoutRef.current != null) {
      clearTimeout(readyTimeoutRef.current)
      readyTimeoutRef.current = null
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
    setCameraReady(false)
    setScannerOpen(false)
    setScannerStarting(false)
  }

  function addSerialCodeFromScan(code: string) {
    const normalized = normalizeCode(code)
    if (!normalized) {
      setScanError('Cần serial_code hoặc nội dung QR hợp lệ.')
      setScanInfo('')
      return false
    }

    let changed = false
    setSerialCodesText((current) => {
      const next = appendSerialCode(current, normalized)
      changed = next !== current
      return next
    })
    setScanError('')
    setScanInfo(changed ? `Đã thêm serial: ${normalized}` : `Serial ${normalized} đã có sẵn trong danh sách.`)
    return true
  }

  async function scanImageFile(file: File) {
    setScanError('')
    setScanInfo('')
    setScanPending(true)
    try {
      const rawValue = await decodeQrFromImageFile(file)
      if (!rawValue) {
        throw new Error('Không đọc được QR từ ảnh này. Hãy thử ảnh rõ hơn hoặc crop sát mã QR.')
      }
      addSerialCodeFromScan(rawValue)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Không đọc được QR từ ảnh.')
      setScanInfo('')
    } finally {
      setScanPending(false)
    }
  }

  function runScanLoop() {
    if (!scannerOpen || !videoRef.current || !detectorRef.current) return

    const tick = async () => {
      if (!scannerOpen || !videoRef.current || !detectorRef.current) return
      frameRef.current = requestAnimationFrame(() => {
        void tick()
      })
      if (detectLockRef.current) return
      if (videoRef.current.readyState < 2) return

      detectLockRef.current = true
      try {
        const codes = await detectorRef.current.detect(videoRef.current)
        const rawValue = String(codes.find((item) => normalizeCode(String(item.rawValue || '')))?.rawValue || '').trim()
        if (rawValue) {
          const ok = addSerialCodeFromScan(rawValue)
          if (ok) stopScanner()
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
        throw new Error('Camera scan trên điện thoại cần HTTPS hoặc localhost. Với môi trường hiện tại có thể dùng quét từ ảnh hoặc dán mã.')
      }

      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      if (!Detector) {
        throw new Error('Trình duyệt này chưa hỗ trợ quét QR bằng camera. Vẫn có thể dùng ảnh QR hoặc dán mã.')
      }

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

      detectorRef.current = new Detector({ formats: ['qr_code'] })
      streamRef.current = stream
      setScannerOpen(true)
      setCameraReady(false)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.autoplay = true
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        await videoRef.current.play()
      }

      readyTimeoutRef.current = window.setTimeout(() => {
        setScanError('Camera đã bật nhưng chưa lên hình. Hãy kiểm tra quyền Camera của browser hoặc dùng quét từ ảnh.')
      }, 2500)

      setScanInfo('Đưa QR vào giữa khung. Scan trúng serial nào thì hệ thống tự thêm vào danh sách batch.')
      runScanLoop()
    } catch (err) {
      stopScanner()
      setScanError(err instanceof Error ? err.message : 'Không bật được camera để quét QR.')
    } finally {
      setScannerStarting(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setMessage('')

    try {
      const response = await submitWarehouseLocationTransfer({
        fromLocationId,
        toLocationId,
        serialCodesText,
        note,
      })
      if (!response.data) throw new Error('Không điều chuyển được serial sang bãi mới.')

      if (response.data.transferredCount > 0) {
        setMessage(`Đã chuyển ${response.data.transferredCount} serial từ ${response.data.fromLocationLabel} sang ${response.data.toLocationLabel}.`)
      } else {
        setError(buildTransferIssueMessage(response.data))
      }

      setScanInfo('')
      setScanError('')
      setResult(response.data)
      setSerialCodesText('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không điều chuyển được serial sang bãi mới.')
    } finally {
      setPending(false)
    }
  }

  if (!props.pageData.schemaReady) {
    return (
      <section className="app-surface rounded-2xl p-6">
        <div
          className="rounded-2xl border px-4 py-4 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, white)',
            color: 'var(--color-accent)',
          }}
        >
          Chưa thấy schema `warehouse_location`. Cần chạy file `sql/pile_serial_setup.sql` rồi mới điều chuyển serial giữa các bãi.
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">Điều chuyển serial giữa bãi</h1>
          <a href="/ton-kho/thanh-pham/vi-tri-bai/ma-qr" className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            In QR bãi
          </a>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <LocationSelectorCard
            title="Chọn bãi nguồn"
            stepLabel="Bước 1"
            mode={fromMode}
            onModeChange={setFromMode}
            selectedLocationId={fromLocationId}
            selectedLocationLabel={fromLocationLabel}
            locations={sourceLocations}
            blockedLocationId={toLocationId || undefined}
            placeholder="Chọn bãi nguồn"
            scanPrompt="Quét mã bãi nguồn để chọn đúng nơi đang chứa serial."
            selectedLabel="Bãi nguồn"
            onSelectLocation={(nextId) => {
              setError('')
              setMessage('')
              setResult(null)
              setFromLocationId(nextId)
            }}
          />

          <LocationSelectorCard
            title="Chọn bãi đích"
            stepLabel="Bước 2"
            mode={toMode}
            onModeChange={setToMode}
            selectedLocationId={toLocationId}
            selectedLocationLabel={toLocationLabel}
            locations={targetLocations}
            blockedLocationId={fromLocationId || undefined}
            placeholder="Chọn bãi đích"
            scanPrompt="Quét mã bãi đích để chọn nơi cần chuyển serial sang."
            selectedLabel="Bãi đích"
            onSelectLocation={(nextId) => {
              setError('')
              setMessage('')
              setResult(null)
              setToLocationId(nextId)
            }}
          />

          <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="app-muted text-xs uppercase tracking-[0.18em]">Bước 3</div>
                <div className="text-sm font-semibold">Thêm serial cần điều chuyển</div>
              </div>
              <div
                className="inline-flex rounded-2xl p-1"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
              >
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${serialInputMode === 'LIST' ? 'text-white' : ''}`}
                  style={{
                    backgroundColor: serialInputMode === 'LIST' ? 'var(--color-primary)' : 'transparent',
                    color: serialInputMode === 'LIST' ? 'white' : undefined,
                  }}
                  onClick={() => setSerialInputMode('LIST')}
                >
                  Danh sách
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${serialInputMode === 'SCAN' ? 'text-white' : ''}`}
                  style={{
                    backgroundColor: serialInputMode === 'SCAN' ? 'var(--color-primary)' : 'transparent',
                    color: serialInputMode === 'SCAN' ? 'white' : undefined,
                  }}
                  onClick={() => setSerialInputMode('SCAN')}
                >
                  Scan
                </button>
              </div>
            </div>

            {serialInputMode === 'SCAN' ? (
              <div className="space-y-4">
                <div
                  className="rounded-2xl p-3 space-y-3"
                  style={{ backgroundColor: 'color-mix(in srgb, white 96%, var(--color-primary) 2%)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-[var(--color-muted)]">Camera QR</div>
                    <button
                      type="button"
                      onClick={() => {
                        if (scannerOpen) stopScanner()
                        else void startScanner()
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      disabled={scannerStarting}
                      aria-label={scannerStarting ? 'Đang scan serial' : scannerOpen ? 'Tắt scan serial' : 'Scan serial'}
                      title={scannerStarting ? 'Đang scan serial' : scannerOpen ? 'Tắt scan serial' : 'Scan serial'}
                    >
                      <ScanQrIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {scannerOpen || scannerStarting ? (
                    <div
                      className="overflow-hidden rounded-2xl border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: '#0f172a',
                      }}
                    >
                      <video
                        ref={videoRef}
                        className="h-[180px] w-full object-cover sm:h-[220px]"
                        onLoadedData={() => {
                          if (readyTimeoutRef.current != null) {
                            clearTimeout(readyTimeoutRef.current)
                            readyTimeoutRef.current = null
                          }
                          setCameraReady(true)
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      className="w-full rounded-xl border px-3 py-2.5 text-sm"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      placeholder="Dán serial"
                      value={scanValue}
                      onChange={(event) => setScanValue(event.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      onClick={() => {
                        if (addSerialCodeFromScan(scanValue)) {
                          setScanValue('')
                        }
                      }}
                    >
                      Thêm
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      className="rounded-xl border px-4 py-2.5 text-sm font-semibold cursor-pointer"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                    >
                      {scanPending ? 'Đang đọc ảnh...' : 'Ảnh QR'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void scanImageFile(file)
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                    {scannerOpen || scannerStarting ? (
                      <div className="text-xs text-[var(--color-muted)]">{cameraReady ? 'Đang quét' : 'Đã bật, chờ hình'}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <label className="block space-y-2">
                <span className="text-sm font-medium">Danh sách serial</span>
                <textarea
                  rows={serialTextareaRows}
                  className="w-full rounded-2xl border px-3 py-3 text-sm"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  placeholder="Mỗi dòng một serial"
                  value={serialCodesText}
                  onChange={(event) => {
                    setScanInfo('')
                    setScanError('')
                    setSerialCodesText(event.target.value)
                  }}
                />
              </label>
            )}

            {scanInfo ? (
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
                  color: 'var(--color-primary)',
                }}
              >
                {scanInfo}
              </div>
            ) : null}

            {scanError ? (
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--color-danger)',
                  backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, white)',
                  color: 'var(--color-danger)',
                }}
              >
                {scanError}
              </div>
            ) : null}

            {serialInputMode === 'SCAN' ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Serial đã quét</div>
                <textarea
                  readOnly
                  rows={serialTextareaRows}
                  className="w-full rounded-2xl border px-3 py-3 text-sm"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  value={serialCodesText || 'Chưa có serial nào trong batch quét.'}
                />
              </div>
            ) : null}
          </div>

          <label className="block space-y-2 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-sm font-medium">Ghi chú</span>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              placeholder="Ghi chú nếu cần"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
              disabled={pending}
              type="submit"
            >
              {pending ? 'Đang điều chuyển...' : 'Xác nhận điều chuyển'}
            </button>
          </div>
        </form>

        {message ? (
          <div
            className="mt-4 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
              color: 'var(--color-primary)',
            }}
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            className="mt-4 rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-danger)',
              backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, white)',
              color: 'var(--color-danger)',
            }}
          >
            {error}
          </div>
        ) : null}
      </section>

      {result ? (
        <section className="app-surface rounded-2xl p-6">
          <h3 className="text-lg font-semibold">Kết quả batch điều chuyển</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Đã chuyển</div>
              <div className="mt-2 text-xl font-semibold">{result.transferredCount}</div>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Không tìm thấy</div>
              <div className="mt-2 text-xl font-semibold">{result.missingCodes.length}</div>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Bỏ qua</div>
              <div className="mt-2 text-xl font-semibold">{result.skippedRows.length}</div>
            </div>
          </div>

          {result.missingCodes.length ? (
            <div className="mt-5">
              <div className="text-sm font-semibold">Serial không tìm thấy</div>
              <div className="app-muted mt-2 text-sm">{result.missingCodes.join(', ')}</div>
            </div>
          ) : null}

          {result.skippedRows.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}>
                  <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                    <th className="px-4 py-3">Serial</th>
                    <th className="px-4 py-3">Lý do bỏ qua</th>
                  </tr>
                </thead>
                <tbody>
                  {result.skippedRows.map((row) => (
                    <tr key={`${row.serialCode}-${row.reason}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-3 font-semibold">{row.serialCode}</td>
                      <td className="px-4 py-3">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
