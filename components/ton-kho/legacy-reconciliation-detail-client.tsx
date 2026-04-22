'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { V2EmptyState } from '@/components/ui/v2-empty-state'
import { V2SectionCard } from '@/components/ui/v2-section-card'
import { decodeQrFromImageFile } from '@/lib/qr/decode-image'
import { submitLegacyReconciliationAssignments } from '@/lib/ton-kho-thanh-pham/reconciliation-client-api'
import type { LegacyReconciliationDetailPageData } from '@/lib/ton-kho-thanh-pham/reconciliation-types'

type BarcodeDetectorResult = {
  rawValue?: string
}

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function formatSourceType(value: 'DON_HANG' | 'TON_KHO') {
  return value === 'TON_KHO' ? 'Bán tồn kho' : 'Theo đơn hàng'
}

function formatLifecycleStatus(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) return '-'
  if (normalized === 'TRONG_KHO') return 'Trong kho'
  if (normalized === 'TRONG_KHU_CHO_QC') return 'Chờ QC'
  if (normalized === 'DA_XUAT') return 'Đã xuất'
  return normalized.replaceAll('_', ' ')
}

function formatDispositionStatus(value: string) {
  const normalized = String(value || '').trim()
  if (!normalized) return '-'
  if (normalized === 'BINH_THUONG') return 'Bình thường'
  if (normalized === 'THANH_LY') return 'Thanh lý / khách lẻ'
  if (normalized === 'HUY') return 'Hủy'
  return normalized.replaceAll('_', ' ')
}

function buildItemSelectionKey(lineId: string, itemKey: string) {
  return `${lineId}::${itemKey}`
}

function normalizeCode(value: string) {
  return String(value || '').trim().toUpperCase()
}

export function LegacyReconciliationDetailClient(props: {
  pageData: LegacyReconciliationDetailPageData
}) {
  const { pageData } = props
  const router = useRouter()
  const [selectedByItem, setSelectedByItem] = useState<Record<string, string[]>>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanInfo, setScanInfo] = useState('')
  const [manualScanValue, setManualScanValue] = useState('')
  const [imageScanPending, setImageScanPending] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerStarting, setScannerStarting] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const readyTimeoutRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const detectLockRef = useRef(false)

  const selectedQtyTotal = useMemo(
    () => Object.values(selectedByItem).reduce((sum, items) => sum + items.length, 0),
    [selectedByItem]
  )

  const candidateByCode = useMemo(() => {
    const map = new Map<
      string,
      {
        lineId: string
        itemKey: string
        itemLabel: string
        unresolvedQty: number
        serialId: string
        serialCode: string
      }
    >()
    for (const item of pageData.items) {
      for (const serial of item.serialCandidates) {
        map.set(normalizeCode(serial.serialCode), {
          lineId: item.lineId,
          itemKey: item.itemKey,
          itemLabel: item.itemLabel,
          unresolvedQty: item.unresolvedQty,
          serialId: serial.serialId,
          serialCode: serial.serialCode,
        })
      }
    }
    return map
  }, [pageData.items])

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

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

  function toggleSerialSelection(lineId: string, itemKey: string, serialId: string, unresolvedQty: number) {
    const selectionKey = buildItemSelectionKey(lineId, itemKey)
    setSelectedByItem((current) => {
      const currentList = current[selectionKey] || []
      const exists = currentList.includes(serialId)
      if (exists) {
        return {
          ...current,
          [selectionKey]: currentList.filter((value) => value !== serialId),
        }
      }
      if (currentList.length >= unresolvedQty) return current
      return {
        ...current,
        [selectionKey]: [...currentList, serialId],
      }
    })
  }

  function upsertSerialByCode(rawCode: string) {
    const normalized = normalizeCode(rawCode)
    if (!normalized) {
      setScanError('Cần serial_code hoặc nội dung QR để thêm vào draft đối soát.')
      setScanInfo('')
      return false
    }

    const candidate = candidateByCode.get(normalized)
    if (!candidate) {
      setScanError(`Không tìm thấy serial ${rawCode} trong danh sách ứng viên của phiếu này.`)
      setScanInfo('')
      return false
    }

    const selectionKey = buildItemSelectionKey(candidate.lineId, candidate.itemKey)
    const selectedForItem = selectedByItem[selectionKey] || []
    if (!selectedForItem.includes(candidate.serialId) && selectedForItem.length >= candidate.unresolvedQty) {
      setScanError(`Mặt hàng ${candidate.itemLabel} đã chọn đủ ${candidate.unresolvedQty} serial cho draft này.`)
      setScanInfo('')
      return false
    }

    setScanError('')
    setScanInfo(`Đã thêm serial ${candidate.serialCode} vào draft đối soát.`)
    setSelectedByItem((current) => {
      const currentList = current[selectionKey] || []
      if (currentList.includes(candidate.serialId)) return current
      return {
        ...current,
        [selectionKey]: [...currentList, candidate.serialId],
      }
    })
    return true
  }

  async function scanImageFile(file: File) {
    setScanError('')
    setScanInfo('')
    setImageScanPending(true)
    try {
      const rawValue = await decodeQrFromImageFile(file)
      if (!rawValue) {
        throw new Error('Không đọc được QR từ ảnh này. Thử ảnh rõ hơn hoặc crop sát mã QR.')
      }
      upsertSerialByCode(rawValue)
    } catch (scanImageError) {
      setScanError(scanImageError instanceof Error ? scanImageError.message : 'Không đọc được QR từ ảnh.')
      setScanInfo('')
    } finally {
      setImageScanPending(false)
    }
  }

  async function startScanner() {
    setScanError('')
    setScanInfo('')
    setScannerStarting(true)

    try {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!window.isSecureContext && !isLocalhost) {
        throw new Error('Camera scan trên điện thoại cần HTTPS hoặc localhost. Với môi trường hiện tại có thể dùng quét từ ảnh hoặc nhập mã.')
      }

      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      if (!Detector) {
        throw new Error('Trình duyệt này chưa hỗ trợ quét QR bằng camera. Vẫn có thể dùng ảnh QR hoặc nhập mã.')
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

      setScanInfo('Đưa QR vào giữa khung. Scan trúng serial nào thì hệ thống tự thêm vào draft đối soát.')
      runScanLoop()
    } catch (startError) {
      stopScanner()
      setScanError(startError instanceof Error ? startError.message : 'Không bật được camera để quét QR.')
    } finally {
      setScannerStarting(false)
    }
  }

  function runScanLoop() {
    if (!detectorRef.current || !videoRef.current) return

    const tick = async () => {
      if (!scannerOpen || !videoRef.current || !detectorRef.current) return
      frameRef.current = requestAnimationFrame(() => {
        void tick()
      })

      if (videoRef.current.readyState < 2) return
      if (!cameraReady) {
        setCameraReady(true)
        if (readyTimeoutRef.current != null) {
          clearTimeout(readyTimeoutRef.current)
          readyTimeoutRef.current = null
        }
      }
      if (detectLockRef.current) return
      detectLockRef.current = true
      try {
        const codes = await detectorRef.current.detect(videoRef.current)
        const rawValue = String(codes.find((item) => normalizeCode(String(item.rawValue || '')))?.rawValue || '').trim()
        if (rawValue) {
          const ok = upsertSerialByCode(rawValue)
          if (ok) {
            stopScanner()
          }
        }
      } catch {
        // Ignore transient camera detection failures.
      } finally {
        detectLockRef.current = false
      }
    }

    void tick()
  }

  async function handleSubmitAssignments() {
    const assignments = pageData.items.flatMap((item) => {
      const selectionKey = buildItemSelectionKey(item.lineId, item.itemKey)
      return (selectedByItem[selectionKey] || []).map((serialId) => ({
        lineId: item.lineId,
        itemKey: item.itemKey,
        serialId,
      }))
    })

    if (!assignments.length) {
      setError('Cần chọn ít nhất một serial trước khi đối soát.')
      setSuccess('')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await submitLegacyReconciliationAssignments({
        voucherId: pageData.voucherId,
        body: {
          note,
          assignments,
        },
      })
      setSelectedByItem({})
      setNote('')
      setManualScanValue('')
      setScanError('')
      setScanInfo('')
      setSuccess(`Đã gắn ${result.assignedQty} serial legacy. Còn lại ${result.remainingQty} cây chưa đối soát.`)
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không đối soát được serial legacy')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <V2SectionCard
        title="Thông tin phiếu legacy"
        description="Đây là snapshot của phiếu đang còn thiếu map serial. Kho sẽ dùng màn này để soi từng mặt hàng trước khi đi đến bước gán serial thật."
        actions={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Tổng gap</div>
              <div className="mt-2 text-2xl font-semibold">{pageData.unresolvedQtyTotal}</div>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Số mặt hàng</div>
              <div className="mt-2 text-2xl font-semibold">{pageData.items.length}</div>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Loại phiếu</div>
              <div className="mt-2 text-base font-semibold">{formatSourceType(pageData.sourceType)}</div>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
              <div className="app-muted text-xs uppercase tracking-[0.18em]">Ngày tạo</div>
              <div className="mt-2 text-base font-semibold">{formatDate(pageData.createdAt)}</div>
            </div>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">Khách hàng</div>
            <div className="mt-2 text-base font-semibold">{pageData.customerName || '-'}</div>
            <div className="app-muted mt-3 text-xs uppercase tracking-[0.18em]">Dự án</div>
            <div className="mt-2 text-base font-semibold">{pageData.projectName || '-'}</div>
          </div>
          <div className="rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">Đơn hàng</div>
            <div className="mt-2 text-base font-semibold">{pageData.orderLabel || '-'}</div>
            <div className="app-muted mt-3 text-xs uppercase tracking-[0.18em]">Báo giá</div>
            <div className="mt-2 text-base font-semibold">{pageData.quoteLabel || '-'}</div>
          </div>
        </div>
      </V2SectionCard>

      <V2SectionCard
        title="Draft đối soát serial"
        description="Kho có thể quét live, dán mã, chọn ảnh QR hoặc tick tay từng serial ứng viên. Sau mỗi lần xác nhận, hệ thống sẽ gắn serial vào phiếu legacy và cập nhật lại tồn theo đúng serial đó."
        actions={
          <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: 'var(--color-border)' }}>
            <div className="app-muted text-xs uppercase tracking-[0.18em]">Đã chọn trong draft</div>
            <div className="mt-2 text-2xl font-semibold">{selectedQtyTotal}</div>
          </div>
        }
      >
        <div className="space-y-4">
          {error ? (
            <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#b91c1c' }}>
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
              {success}
            </div>
          ) : null}

          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">Quét QR serial legacy</div>
                <div className="app-muted mt-1 text-sm">
                  Có thể quét live, dán mã hoặc chọn ảnh QR để thêm serial vào draft đối soát.
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                style={{ borderColor: 'var(--color-border)' }}
                onClick={scannerOpen ? stopScanner : () => void startScanner()}
                disabled={scannerStarting}
              >
                {scannerOpen ? 'Tắt camera' : scannerStarting ? 'Đang bật camera...' : 'Bật camera quét QR'}
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3">
                <div
                  className="overflow-hidden rounded-2xl border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: '#0f172a' }}
                >
                  <video ref={videoRef} className="aspect-[4/5] w-full object-cover" muted playsInline />
                </div>
                <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                  Trạng thái camera: {scannerOpen ? (cameraReady ? 'Đã lên hình' : 'Đang chờ camera') : 'Chưa bật'}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                  {scanInfo || 'Đưa QR vào giữa khung. Scan trúng serial nào thì hệ thống tự thêm vào draft đối soát.'}
                </div>
                {scanError ? (
                  <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                    {scanError}
                  </div>
                ) : null}
                <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-sm"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                    placeholder="Dán serial_code hoặc nội dung QR để thêm vào draft"
                    value={manualScanValue}
                    onChange={(event) => setManualScanValue(event.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                    style={{ borderColor: 'var(--color-border)' }}
                    onClick={() => {
                      const ok = upsertSerialByCode(manualScanValue)
                      if (ok) setManualScanValue('')
                    }}
                  >
                    Thêm từ mã
                  </button>
                  <label
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          void scanImageFile(file)
                        }
                        event.currentTarget.value = ''
                      }}
                    />
                    {imageScanPending ? 'Đang đọc ảnh...' : 'Chọn ảnh QR'}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Ghi chú đối soát</span>
            <textarea
              className="min-h-[92px] w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              placeholder="VD: Kho đối soát lại theo sổ xuất cũ tháng 04/2026"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-primary)' }}
              disabled={!selectedQtyTotal || isSaving}
              onClick={() => void handleSubmitAssignments()}
            >
              {isSaving ? 'Đang gắn serial...' : 'Xác nhận gắn serial legacy'}
            </button>
          </div>
        </div>
      </V2SectionCard>

      <V2SectionCard
        title="Mặt hàng còn gap"
        description="Mỗi khối dưới đây cho thấy phiếu đã xuất bao nhiêu, đã gắn serial bao nhiêu, đã trả bao nhiêu, còn thiếu bao nhiêu và những serial nào hiện là ứng viên còn trong kho."
      >
        {pageData.items.length ? (
          <div className="space-y-5">
            {pageData.items.map((item) => {
              const selectionKey = buildItemSelectionKey(item.lineId, item.itemKey)
              const selectedSerialIds = selectedByItem[selectionKey] || []
              const reachedLimit = selectedSerialIds.length >= item.unresolvedQty
              return (
                <div
                  key={`${pageData.voucherId}::${item.itemKey}`}
                  className="overflow-hidden rounded-2xl border"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div
                    className="flex flex-wrap items-start justify-between gap-4 px-4 py-4"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)' }}
                  >
                    <div>
                      <div className="text-lg font-semibold">{item.itemLabel}</div>
                      <div className="app-muted mt-1 text-sm">
                        Item key: <span className="font-medium">{item.itemKey}</span>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-5">
                      <div className="rounded-xl border px-4 py-3 text-right text-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="app-muted text-xs uppercase tracking-[0.18em]">Đã xuất</div>
                        <div className="mt-2 text-xl font-semibold">{item.actualQty}</div>
                      </div>
                      <div className="rounded-xl border px-4 py-3 text-right text-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="app-muted text-xs uppercase tracking-[0.18em]">Đã gắn</div>
                        <div className="mt-2 text-xl font-semibold">{item.assignedQty}</div>
                      </div>
                      <div className="rounded-xl border px-4 py-3 text-right text-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="app-muted text-xs uppercase tracking-[0.18em]">Đã trả</div>
                        <div className="mt-2 text-xl font-semibold">{item.returnedQty}</div>
                      </div>
                      <div className="rounded-xl border px-4 py-3 text-right text-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="app-muted text-xs uppercase tracking-[0.18em]">Còn gap</div>
                        <div className="mt-2 text-xl font-semibold">{item.unresolvedQty}</div>
                      </div>
                      <div className="rounded-xl border px-4 py-3 text-right text-sm" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="app-muted text-xs uppercase tracking-[0.18em]">Đã chọn</div>
                        <div className="mt-2 text-xl font-semibold">{selectedSerialIds.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {item.serialCandidates.length ? (
                      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                        <table className="min-w-full text-sm">
                          <thead style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 3%, white)' }}>
                            <tr className="text-left uppercase tracking-[0.2em] app-muted text-xs">
                              <th className="px-4 py-3">Chọn</th>
                              <th className="px-4 py-3">Serial</th>
                              <th className="px-4 py-3">Lô</th>
                              <th className="px-4 py-3">Ngày SX</th>
                              <th className="px-4 py-3">Kho</th>
                              <th className="px-4 py-3">Hiển thị</th>
                              <th className="px-4 py-3">Trạng thái</th>
                              <th className="px-4 py-3">Hướng xử lý</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.serialCandidates.map((serial) => {
                              const checked = selectedSerialIds.includes(serial.serialId)
                              const disabled = !checked && reachedLimit
                              return (
                                <tr key={serial.serialId} style={{ borderTop: '1px solid var(--color-border)' }}>
                                  <td className="px-4 py-4">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled || isSaving}
                                      onChange={() => toggleSerialSelection(item.lineId, item.itemKey, serial.serialId, item.unresolvedQty)}
                                    />
                                  </td>
                                  <td className="px-4 py-4 font-medium">{serial.serialCode}</td>
                                  <td className="px-4 py-4">{serial.lotCode || '-'}</td>
                                  <td className="px-4 py-4">{formatDate(serial.productionDate)}</td>
                                  <td className="px-4 py-4">{serial.locationLabel || '-'}</td>
                                  <td className="px-4 py-4">{serial.visibilityLabel}</td>
                                  <td className="px-4 py-4">{formatLifecycleStatus(serial.lifecycleStatus)}</td>
                                  <td className="px-4 py-4">{formatDispositionStatus(serial.dispositionStatus)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <V2EmptyState
                        title="Chưa có serial ứng viên trong kho"
                        description="Hiện chưa thấy serial còn trong kho khớp mặt hàng này. Nếu đây là legacy gap thật, bước sau mình sẽ cần thêm action đối soát hoặc một nguồn serial khác trước khi kho có thể chốt được."
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <V2EmptyState
            title="Phiếu này hiện không còn gap"
            description="Có thể phiếu đã được đối soát xong ở nguồn dữ liệu khác hoặc không còn dòng nào đủ điều kiện hiển thị ở bước read-only này."
            actionHref="/ton-kho/thanh-pham/doi-soat-legacy"
            actionLabel="Quay lại danh sách"
          />
        )}
      </V2SectionCard>
    </div>
  )
}
