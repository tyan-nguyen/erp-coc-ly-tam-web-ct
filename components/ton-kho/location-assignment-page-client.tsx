'use client'

import { useEffect, useRef, useState } from 'react'
import { decodeQrFromImageFile } from '@/lib/qr/decode-image'
import { submitWarehouseLocationAssignment } from '@/lib/ton-kho-thanh-pham/location-assignment-client-api'
import type {
  WarehouseLocationAssignmentPageData,
  WarehouseLocationAssignmentResult,
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

function buildAssignmentIssueMessage(result: WarehouseLocationAssignmentResult) {
  const missingPreview = result.missingCodes.slice(0, 2)
  const skippedPreview = result.skippedRows.slice(0, 2).map((row) => `${row.serialCode}: ${row.reason}`)
  const details = [...missingPreview, ...skippedPreview].filter(Boolean)

  if (!details.length) {
    return 'Không có serial hợp lệ để gán vào bãi.'
  }

  return `Không có serial hợp lệ để gán vào bãi. ${details.join(' | ')}`
}

export function WarehouseLocationAssignmentPageClient(props: {
  pageData: WarehouseLocationAssignmentPageData
}) {
  const [locationInputMode, setLocationInputMode] = useState<'LIST' | 'SCAN'>('LIST')
  const [serialInputMode, setSerialInputMode] = useState<'LIST' | 'SCAN'>('LIST')
  const [locationId, setLocationId] = useState(props.pageData.locations[0]?.locationId || '')
  const [locationScanValue, setLocationScanValue] = useState('')
  const [serialCodesText, setSerialCodesText] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<WarehouseLocationAssignmentResult | null>(null)
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
  const [locationScannerOpen, setLocationScannerOpen] = useState(false)
  const [locationScannerStarting, setLocationScannerStarting] = useState(false)
  const [locationCameraReady, setLocationCameraReady] = useState(false)
  const [locationScanInfo, setLocationScanInfo] = useState('')
  const [locationScanError, setLocationScanError] = useState('')
  const [locationImagePending, setLocationImagePending] = useState(false)
  const locationVideoRef = useRef<HTMLVideoElement | null>(null)
  const locationStreamRef = useRef<MediaStream | null>(null)
  const locationFrameRef = useRef<number | null>(null)
  const locationReadyTimeoutRef = useRef<number | null>(null)
  const locationDetectorRef = useRef<BarcodeDetectorLike | null>(null)
  const locationDetectLockRef = useRef(false)
  const selectedLocationLabel =
    props.pageData.locations.find((location) => location.locationId === locationId)?.locationLabel || ''
  const serialLineCount = serialCodesText
    ? serialCodesText
        .split('\n')
        .map((item) => normalizeCode(item))
        .filter(Boolean).length
    : 0
  const serialTextareaRows = Math.min(10, Math.max(4, serialLineCount + 1))

  useEffect(() => {
    return () => {
      stopScanner()
      stopLocationScanner()
    }
  }, [])

  useEffect(() => {
    if (locationInputMode !== 'SCAN') {
      stopLocationScanner()
      setLocationScanValue('')
    }
  }, [locationInputMode])

  useEffect(() => {
    if (serialInputMode !== 'SCAN') {
      stopScanner()
      setScanValue('')
    }
  }, [serialInputMode])

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

  function stopLocationScanner() {
    if (locationFrameRef.current != null) {
      cancelAnimationFrame(locationFrameRef.current)
      locationFrameRef.current = null
    }
    if (locationReadyTimeoutRef.current != null) {
      clearTimeout(locationReadyTimeoutRef.current)
      locationReadyTimeoutRef.current = null
    }
    if (locationStreamRef.current) {
      for (const track of locationStreamRef.current.getTracks()) {
        track.stop()
      }
      locationStreamRef.current = null
    }
    if (locationVideoRef.current) {
      locationVideoRef.current.srcObject = null
    }
    locationDetectLockRef.current = false
    setLocationCameraReady(false)
    setLocationScannerOpen(false)
    setLocationScannerStarting(false)
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

  function selectLocationFromCode(rawCode: string) {
    const normalized = normalizeLocationCode(rawCode)
    if (!normalized) {
      setLocationScanError('Cần mã bãi hợp lệ.')
      setLocationScanInfo('')
      return false
    }

    const matched = props.pageData.locations.find((location) => normalizeLocationCode(location.locationCode) === normalized)
    if (!matched) {
      setLocationScanError(`Không tìm thấy bãi nào khớp mã ${normalized}.`)
      setLocationScanInfo('')
      return false
    }

    setLocationId(matched.locationId)
    setLocationScanError('')
    setLocationScanInfo(`Đã chọn bãi đích: ${matched.locationLabel}`)
    return true
  }

  async function scanLocationImageFile(file: File) {
    setLocationScanError('')
    setLocationScanInfo('')
    setLocationImagePending(true)
    try {
      const rawValue = await decodeQrFromImageFile(file)
      if (!rawValue) {
        throw new Error('Không đọc được QR bãi từ ảnh này. Hãy thử ảnh rõ hơn hoặc crop sát mã QR.')
      }
      selectLocationFromCode(rawValue)
    } catch (err) {
      setLocationScanError(err instanceof Error ? err.message : 'Không đọc được QR bãi từ ảnh.')
      setLocationScanInfo('')
    } finally {
      setLocationImagePending(false)
    }
  }

  function runLocationScanLoop() {
    if (!locationScannerOpen || !locationVideoRef.current || !locationDetectorRef.current) return

    const tick = async () => {
      if (!locationScannerOpen || !locationVideoRef.current || !locationDetectorRef.current) return
      locationFrameRef.current = requestAnimationFrame(() => {
        void tick()
      })
      if (locationDetectLockRef.current) return
      if (locationVideoRef.current.readyState < 2) return

      locationDetectLockRef.current = true
      try {
        const codes = await locationDetectorRef.current.detect(locationVideoRef.current)
        const rawValue = String(codes.find((item) => normalizeCode(String(item.rawValue || '')))?.rawValue || '').trim()
        if (rawValue) {
          const ok = selectLocationFromCode(rawValue)
          if (ok) {
            stopLocationScanner()
          }
        }
      } catch {
        // Ignore transient detection failures.
      } finally {
        locationDetectLockRef.current = false
      }
    }

    void tick()
  }

  async function startLocationScanner() {
    setLocationScanError('')
    setLocationScanInfo('')
    setLocationScannerStarting(true)

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

      locationDetectorRef.current = new Detector({ formats: ['qr_code'] })
      locationStreamRef.current = stream
      setLocationScannerOpen(true)
      setLocationCameraReady(false)

      if (locationVideoRef.current) {
        locationVideoRef.current.srcObject = stream
        locationVideoRef.current.autoplay = true
        locationVideoRef.current.muted = true
        locationVideoRef.current.playsInline = true
        await locationVideoRef.current.play()
      }

      locationReadyTimeoutRef.current = window.setTimeout(() => {
        setLocationScanError('Camera đã bật nhưng chưa lên hình. Hãy kiểm tra quyền Camera của browser hoặc dùng quét từ ảnh.')
      }, 2500)

      setLocationScanInfo('Đưa QR bãi vào giữa khung. Quét trúng là hệ thống tự chọn bãi đích.')
      runLocationScanLoop()
    } catch (err) {
      stopLocationScanner()
      setLocationScanError(err instanceof Error ? err.message : 'Không bật được camera để quét QR bãi.')
    } finally {
      setLocationScannerStarting(false)
    }
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
          if (ok) {
            stopScanner()
          }
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
      const response = await submitWarehouseLocationAssignment({
        locationId,
        serialCodesText,
        note,
      })
      if (!response.data) throw new Error('Không gán được serial vào bãi.')

      if (response.data.assignedCount > 0) {
        setMessage(`Đã gán ${response.data.assignedCount} serial vào bãi ${response.data.locationLabel}.`)
      } else if (response.data.unchangedCount > 0 && !response.data.missingCodes.length && !response.data.skippedRows.length) {
        setMessage(`Các serial đã nằm sẵn ở bãi ${response.data.locationLabel}.`)
      } else {
        setError(buildAssignmentIssueMessage(response.data))
      }

      setScanInfo('')
      setScanError('')
      setResult(response.data)
      setSerialCodesText('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gán được serial vào bãi.')
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
          Chưa thấy schema `warehouse_location`. Cần chạy file `sql/pile_serial_setup.sql` rồi mới gán serial vào bãi.
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">Gán serial vào bãi</h1>
          <a href="/ton-kho/thanh-pham/vi-tri-bai/ma-qr" className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            In QR bãi
          </a>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="app-muted text-xs uppercase tracking-[0.18em]">Bước 1</div>
                <div className="text-sm font-semibold">Chọn bãi</div>
              </div>
              <div
                className="inline-flex rounded-2xl p-1"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
              >
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${locationInputMode === 'LIST' ? 'text-white' : ''}`}
                  style={{
                    backgroundColor: locationInputMode === 'LIST' ? 'var(--color-primary)' : 'transparent',
                    color: locationInputMode === 'LIST' ? 'white' : undefined,
                  }}
                  onClick={() => setLocationInputMode('LIST')}
                >
                  Danh sách
                </button>
                <button
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${locationInputMode === 'SCAN' ? 'text-white' : ''}`}
                  style={{
                    backgroundColor: locationInputMode === 'SCAN' ? 'var(--color-primary)' : 'transparent',
                    color: locationInputMode === 'SCAN' ? 'white' : undefined,
                  }}
                  onClick={() => setLocationInputMode('SCAN')}
                >
                  Scan
                </button>
              </div>
            </div>

            {locationInputMode === 'LIST' ? (
              <div className="mt-4">
                <select
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  value={locationId}
                  onChange={(event) => {
                    setLocationScanInfo('')
                    setLocationScanError('')
                    setError('')
                    setMessage('')
                    setResult(null)
                    setLocationId(event.target.value)
                  }}
                >
                  <option value="">Chọn bãi đích</option>
                  {props.pageData.locations.map((location) => (
                    <option key={location.locationId} value={location.locationId}>
                      {location.locationLabel}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div
                  className="rounded-2xl border px-4 py-3 text-sm font-medium"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)',
                  }}
                >
                  Quét mã bãi để chọn bãi đích
                </div>
                <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-3">
                  {locationScannerOpen || locationScannerStarting ? (
                    <div
                      className="overflow-hidden rounded-2xl border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: '#0f172a',
                      }}
                    >
                      <video
                        ref={locationVideoRef}
                        className="h-[180px] w-full object-cover sm:h-[200px]"
                        onLoadedData={() => {
                          if (locationReadyTimeoutRef.current != null) {
                            clearTimeout(locationReadyTimeoutRef.current)
                            locationReadyTimeoutRef.current = null
                          }
                          setLocationCameraReady(true)
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                    Camera bãi: {locationScannerOpen ? (locationCameraReady ? 'Đang quét' : 'Đã bật, chờ hình') : 'Chưa bật'}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="w-full rounded-xl border px-3 py-2.5 text-sm sm:col-span-2"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                      placeholder="Dán mã bãi"
                      value={locationScanValue}
                      onChange={(event) => setLocationScanValue(event.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                      style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => {
                        if (selectLocationFromCode(locationScanValue)) {
                          setLocationScanValue('')
                        }
                      }}
                    >
                      Chọn từ mã
                    </button>
                    <label
                      className="rounded-xl border px-4 py-2.5 text-sm font-semibold cursor-pointer"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      {locationImagePending ? 'Đang đọc ảnh...' : 'Ảnh QR bãi'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void scanLocationImageFile(file)
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (locationScannerOpen) stopLocationScanner()
                        else void startLocationScanner()
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'white' }}
                      disabled={locationScannerStarting}
                      aria-label={locationScannerStarting ? 'Đang scan bãi' : locationScannerOpen ? 'Tắt scan bãi' : 'Scan bãi'}
                      title={locationScannerStarting ? 'Đang scan bãi' : locationScannerOpen ? 'Tắt scan bãi' : 'Scan bãi'}
                    >
                      <ScanQrIcon className="h-6 w-6" />
                    </button>
                  </div>
                  <div
                    className="rounded-2xl border px-4 py-3 text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  >
                    Bãi đích: <span className="font-semibold">{selectedLocationLabel || 'Chưa chọn'}</span>
                  </div>
                </div>
                </div>
              </div>
            )}

            {locationScanInfo ? (
              <div
                className="mt-4 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
                  color: 'var(--color-primary)',
                }}
              >
                {locationScanInfo}
              </div>
            ) : null}

            {locationScanError ? (
              <div
                className="mt-4 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: 'var(--color-danger)',
                  backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, white)',
                  color: 'var(--color-danger)',
                }}
              >
                {locationScanError}
              </div>
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="app-muted text-xs uppercase tracking-[0.18em]">Bước 2</div>
                <div className="text-sm font-semibold">Thêm serial</div>
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
              <div className="mt-4 space-y-4">
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
                      <div className="text-xs text-[var(--color-muted)]">
                        {cameraReady ? 'Đang quét' : 'Đã bật, chờ hình'}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <label className="mt-4 block space-y-2">
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
                className="mt-4 rounded-2xl border px-4 py-3 text-sm"
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
                className="mt-4 rounded-2xl border px-4 py-3 text-sm"
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
              <div className="mt-4 space-y-2">
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
              {pending ? 'Đang gán bãi...' : 'Xác nhận gán bãi'}
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
          <h3 className="text-lg font-semibold">Kết quả batch gán bãi</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Đã gán</div>
              <div className="mt-2 text-xl font-semibold">{result.assignedCount}</div>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Đã ở đúng bãi</div>
              <div className="mt-2 text-xl font-semibold">{result.unchangedCount}</div>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Không tìm thấy</div>
              <div className="mt-2 text-xl font-semibold">{result.missingCodes.length}</div>
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

function ScanQrIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4 8V6a2 2 0 0 1 2-2h2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7" y="7" width="3" height="3" rx="0.4" />
      <rect x="14" y="7" width="3" height="3" rx="0.4" />
      <rect x="7" y="14" width="3" height="3" rx="0.4" />
      <path d="M14 14h1v1h-1zM16 15h1v1h-1zM15 16h1v1h-1zM14 17h1v1h-1zM17 17h1v1h-1z" fill="currentColor" stroke="none" />
    </svg>
  )
}
