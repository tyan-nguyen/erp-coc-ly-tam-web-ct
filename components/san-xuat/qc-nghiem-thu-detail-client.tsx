'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { QcIssueDraft, QcIssueLineResult, QcNghiemThuDetail, QcSerialResult } from '@/lib/san-xuat/types'
import { isAdminRole, isQcRole } from '@/lib/auth/roles'
import { decodeQrFromImageFile } from '@/lib/qr/decode-image'
import { submitSaveQcIssue } from '@/lib/san-xuat/client-api'

type QcDefectDraftRow = {
  id: string
  lineId: string
  lineQuery: string
  serialId: string
  serialQuery: string
  dispositionStatus: Extract<QcSerialResult['dispositionStatus'], 'THANH_LY' | 'HUY'>
  note: string
}

type BarcodeDetectorResult = {
  rawValue?: string
}

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike
type QcInputMode = 'SCAN' | 'SELECT'

export function QcNghiemThuDetailClient(props: {
  detail: QcNghiemThuDetail
  viewerRole: string
  embedded?: boolean
  fastBackToList?: boolean
}) {
  const router = useRouter()
  const qcViewer = isQcRole(props.viewerRole)
  const adminViewer = isAdminRole(props.viewerRole)
  const [savedQcIssue, setSavedQcIssue] = useState<QcIssueDraft | null>(null)
  const [message, setMessage] = useState('')
  const qcIssue = savedQcIssue || props.detail.qcIssue
  const qcLocked = Boolean(qcIssue?.locked)
  const canUseQcFlow = (qcViewer || adminViewer) && !qcLocked
  const [note, setNote] = useState(qcIssue?.note || '')
  const [acceptedQtyByLine, setAcceptedQtyByLine] = useState<Record<string, string>>(() =>
    buildInitialAcceptedState(props.detail.lines, qcIssue?.lineResults || [])
  )
  const [lineNotes, setLineNotes] = useState<Record<string, string>>(() =>
    buildInitialLineNotes(qcIssue?.lineResults || [])
  )
  const [defectDraftRows, setDefectDraftRows] = useState<QcDefectDraftRow[]>(() =>
    buildInitialDefectDraftRows(props.detail.qcIssue?.serialResults || [], !Boolean(props.detail.qcIssue?.locked) && (qcViewer || adminViewer))
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [scanError, setScanError] = useState('')
  const [scanInfo, setScanInfo] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerStarting, setScannerStarting] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [manualScanValue, setManualScanValue] = useState('')
  const [imageScanPending, setImageScanPending] = useState(false)
  const [qcInputMode, setQcInputMode] = useState<QcInputMode>('SCAN')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const readyTimeoutRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const detectLockRef = useRef(false)

  useEffect(() => {
    setSavedQcIssue(null)
    setMessage('')
    setNote(props.detail.qcIssue?.note || '')
    setAcceptedQtyByLine(buildInitialAcceptedState(props.detail.lines, props.detail.qcIssue?.lineResults || []))
    setLineNotes(buildInitialLineNotes(props.detail.qcIssue?.lineResults || []))
    setDefectDraftRows(
      buildInitialDefectDraftRows(
        props.detail.qcIssue?.serialResults || [],
        !Boolean(props.detail.qcIssue?.locked) && (qcViewer || adminViewer)
      )
    )
    setQcInputMode('SCAN')
  }, [props.detail.plan.plan_id, props.detail.lines, props.detail.qcIssue, qcViewer, adminViewer])

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  const serialBlueprints = useMemo(() => qcIssue?.serialResults || [], [qcIssue?.serialResults])
  const lineOptions = useMemo(
    () =>
      props.detail.lines.map((line) => ({
        lineId: line.line_id,
        label: buildQcLineLabel(line),
      })),
    [props.detail.lines]
  )
  const lineOptionMap = useMemo(() => new Map(lineOptions.map((item) => [item.lineId, item.label])), [lineOptions])
  const serialBlueprintMap = useMemo(
    () => new Map(serialBlueprints.map((item) => [item.serialId, item])),
    [serialBlueprints]
  )
  const serialBlueprintCodeMap = useMemo(
    () => new Map(serialBlueprints.map((item) => [normalizeCode(item.serialCode), item])),
    [serialBlueprints]
  )

  const activeDefectRows = useMemo(
    () => defectDraftRows.filter((row) => row.lineId && row.serialId),
    [defectDraftRows]
  )

  const serialDefectsById = useMemo(
    () =>
      Object.fromEntries(
        activeDefectRows
          .map((row) => {
            const base = serialBlueprintMap.get(row.serialId)
            if (!base) return null
            return [
              row.serialId,
              {
                ...base,
                qcStatus: 'LOI' as const,
                dispositionStatus: row.dispositionStatus,
                note: row.note || '',
              } satisfies QcSerialResult,
            ] as const
          })
          .filter(Boolean) as Array<readonly [string, QcSerialResult]>
      ),
    [activeDefectRows, serialBlueprintMap]
  )

  const serialResults = useMemo(
    () =>
      serialBlueprints.map((item) => {
        const defect = serialDefectsById[item.serialId]
        if (defect) {
          return {
            ...item,
            ...defect,
            qcStatus: 'LOI',
            dispositionStatus: defect.dispositionStatus === 'THANH_LY' ? 'THANH_LY' : 'HUY',
            note: defect.note || '',
          } satisfies QcSerialResult
        }

        return {
          ...item,
          qcStatus: 'DAT',
          dispositionStatus: 'BINH_THUONG',
          note: '',
        } satisfies QcSerialResult
      }),
    [serialBlueprints, serialDefectsById]
  )

  const serialResultsByLine = useMemo(() => {
    const grouped = new Map<string, QcSerialResult[]>()
    for (const item of serialResults) {
      const lineId = item.lineId || '__unknown__'
      const current = grouped.get(lineId) || []
      current.push(item)
      grouped.set(lineId, current)
    }
    return grouped
  }, [serialResults])

  const lineResults = useMemo(() => {
    return props.detail.lines.map((line) => {
      const actualQty = Number(line.so_luong_da_san_xuat || 0)
      const serialItems = serialResultsByLine.get(line.line_id) || []
      const acceptedFromSerial = serialItems.filter((item) => item.qcStatus === 'DAT').length
      const acceptedQty =
        serialItems.length > 0
          ? acceptedFromSerial
          : Math.min(Math.max(Number(acceptedQtyByLine[line.line_id] || 0), 0), actualQty)
      return {
        lineId: line.line_id,
        actualQty,
        acceptedQty,
        rejectedQty: Math.max(actualQty - acceptedQty, 0),
        note: lineNotes[line.line_id] || '',
      } satisfies QcIssueLineResult
    })
  }, [acceptedQtyByLine, lineNotes, props.detail.lines, serialResultsByLine])

  const summary = useMemo(() => {
    return lineResults.reduce(
      (acc, item) => {
        acc.actualQty += item.actualQty
        acc.acceptedQty += item.acceptedQty
        acc.rejectedQty += item.rejectedQty
        return acc
      },
      { actualQty: 0, acceptedQty: 0, rejectedQty: 0 }
    )
  }, [lineResults])

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

  function upsertDefectBySerial(serialCode: string) {
    const normalizedCode = normalizeCode(serialCode)
    const matched = serialBlueprintCodeMap.get(normalizedCode)
    if (!matched) {
      setScanError(`Không tìm thấy serial ${serialCode} trong ngày QC này.`)
      setScanInfo('')
      return false
    }

    setScanError('')
    setScanInfo(`Đã nhận serial lỗi: ${matched.serialCode}`)
    setDefectDraftRows((current) => {
      const existingIndex = current.findIndex((item) => item.serialId === matched.serialId)
      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                lineId: matched.lineId,
                lineQuery: lineOptionMap.get(matched.lineId) || '',
                serialId: matched.serialId,
                serialQuery: matched.serialCode,
              }
            : item
        )
      }

      const emptyIndex = current.findIndex((item) => !item.lineId && !item.serialId)
      if (emptyIndex >= 0) {
        return current.map((item, index) =>
          index === emptyIndex
            ? {
                ...item,
                lineId: matched.lineId,
                lineQuery: lineOptionMap.get(matched.lineId) || '',
                serialId: matched.serialId,
                serialQuery: matched.serialCode,
              }
            : item
        )
      }

      return [
        ...current,
        {
          ...buildEmptyDefectDraftRow(current.length + 1),
          lineId: matched.lineId,
          lineQuery: lineOptionMap.get(matched.lineId) || '',
          serialId: matched.serialId,
          serialQuery: matched.serialCode,
        },
      ]
    })
    return true
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
          const ok = upsertDefectBySerial(rawValue)
          if (ok) {
            stopScanner()
          }
        }
      } catch {
        // Ignore transient detection failures while camera is active.
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
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (!window.isSecureContext && !isLocalhost) {
        throw new Error('Camera scan trên điện thoại cần chạy bằng HTTPS hoặc localhost. Link mạng LAN http://192.168... thường sẽ bị chặn camera.')
      }

      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      if (!Detector) {
        throw new Error('Trình duyệt này chưa hỗ trợ quét QR bằng camera. Vẫn có thể nhập tay serial ở bảng lỗi.')
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
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
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
        if (!cameraReady) {
          setScanError('Camera đã bật nhưng chưa lên hình. Hãy kiểm tra quyền Camera của browser, đóng ứng dụng khác đang dùng camera, rồi bật lại.')
        }
      }, 2500)

      setScanInfo('Đưa QR vào giữa khung. Scan trúng mã nào thì hệ thống tự thêm vào danh sách lỗi.')
      runScanLoop()
    } catch (err) {
      stopScanner()
      setScanError(err instanceof Error ? err.message : 'Không bật được camera để quét QR.')
    } finally {
      setScannerStarting(false)
    }
  }

  function submitManualScan() {
    const value = manualScanValue.trim()
    if (!value) {
      setScanError('Cần nhập serial hoặc nội dung QR để thêm lỗi nhanh.')
      return
    }
    upsertDefectBySerial(value)
    setManualScanValue('')
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
      upsertDefectBySerial(rawValue)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Không đọc được QR từ ảnh.')
    } finally {
      setImageScanPending(false)
    }
  }

  function addDefectDraftRow() {
    setDefectDraftRows((current) => [...current, buildEmptyDefectDraftRow(current.length + 1)])
  }

  function updateDefectDraftRow(rowId: string, patch: Partial<QcDefectDraftRow>) {
    setDefectDraftRows((current) =>
      current.map((item) =>
        item.id === rowId
          ? {
              ...item,
              ...patch,
              serialId: patch.lineId && patch.lineId !== item.lineId ? '' : (patch.serialId ?? item.serialId),
              serialQuery:
                patch.lineId && patch.lineId !== item.lineId ? '' : (patch.serialQuery ?? item.serialQuery),
            }
          : item
      )
    )
  }

  function removeDefectDraftRow(rowId: string) {
    setDefectDraftRows((current) => (current.length > 1 ? current.filter((item) => item.id !== rowId) : [buildEmptyDefectDraftRow(1)]))
  }

  async function saveQcIssue() {
    setError('')
    setMessage('')
    if (!canUseQcFlow) {
      setError('Role hiện tại không được xác nhận nghiệm thu QC.')
      return
    }

    setPending(true)
    try {
      const result = await submitSaveQcIssue({
        planId: props.detail.plan.plan_id,
        note,
        lineResults,
        serialResults,
      })
      if (result.data) {
        setSavedQcIssue(result.data)
      }
      setMessage('Đã lưu phiếu nghiệm thu QC.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được phiếu nghiệm thu QC.')
    } finally {
      setPending(false)
    }
  }

  function goBackToQcList() {
    if (props.fastBackToList && typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.replace('/san-xuat/qc-nghiem-thu')
  }

  return (
    <div className="space-y-6">
      {message ? (
        <section className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)', color: 'var(--color-primary)' }}>
          {message}
        </section>
      ) : null}
      {error ? <section className="app-accent-soft rounded-2xl px-4 py-3 text-sm">{error}</section> : null}

      {!props.embedded ? (
        <section className="app-surface rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBackToQcList}
              className="app-outline inline-flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none"
              aria-label="Quay lại danh sách QC"
              title="Quay lại danh sách QC"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold">Chi tiết nghiệm thu QC</h1>
          </div>
        </section>
      ) : null}

      {qcLocked ? (
        <section className="app-surface rounded-2xl p-6">
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
              color: 'var(--color-primary)',
            }}
          >
            Phiếu nghiệm thu QC của ngày này đã được xác nhận, hiện chỉ còn xem.
          </div>
          {!qcViewer && adminViewer ? (
            <p className="app-muted mt-3 text-sm">
              Admin đang xem lớp nghiệm thu QC đã xác nhận. Chưa mở chức năng can thiệp lại ở bước này.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="app-surface rounded-2xl p-6">
        <div>
          <h2 className="text-lg font-semibold">Các dòng nghiệm thu QC</h2>
        </div>

        <div className="mt-4">
          <Field label="Ghi chú QC">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={!canUseQcFlow}
              placeholder="Ghi chú chung cho ngày QC"
              className="app-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border max-md:hidden" style={{ borderColor: 'var(--color-border)' }}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đơn hàng</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Mã bóc tách</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Loại cọc</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đoạn</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Chiều dài</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Thực SX</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL đạt</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">SL lỗi</th>
                <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {props.detail.lines.map((row) => {
                const actualQty = Number(row.so_luong_da_san_xuat || 0)
                const serialItems = serialResultsByLine.get(row.line_id) || []
                const acceptedQty =
                  serialItems.length > 0
                    ? serialItems.filter((item) => item.qcStatus === 'DAT').length
                    : Math.min(Math.max(Number(acceptedQtyByLine[row.line_id] || 0), 0), actualQty)
                const rejectedQty = Math.max(actualQty - acceptedQty, 0)
                const serialManaged = serialItems.length > 0
                return (
                  <tr key={row.line_id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.ma_order || row.order_id}</div>
                      <div className="text-xs text-[var(--color-muted)]">{row.khach_hang || '-'} · {row.du_an || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.boc_id ? (
                        <Link
                          href={`/boc-tach/boc-tach-nvl/${row.boc_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {row.ma_boc_tach_hien_thi || row.boc_id}
                        </Link>
                      ) : (
                        row.ma_boc_tach_hien_thi || row.boc_id || '-'
                      )}
                    </td>
                    <td className="px-4 py-3">{row.loai_coc || '-'}</td>
                    <td className="px-4 py-3">{row.ten_doan}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.chieu_dai_m)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(actualQty)}</td>
                    <td className="px-4 py-3 text-right">
                      {canUseQcFlow && !serialManaged ? (
                        <input
                          type="number"
                          min={0}
                          max={actualQty}
                          value={acceptedQtyByLine[row.line_id] ?? String(actualQty)}
                          onChange={(event) =>
                            setAcceptedQtyByLine((current) => ({
                              ...current,
                              [row.line_id]: event.target.value,
                            }))
                          }
                          className="app-input w-24 rounded-xl px-2 py-1 text-right text-sm"
                        />
                      ) : (
                        formatNumber(acceptedQty)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(rejectedQty)}</td>
                    <td className="px-4 py-3">
                      {canUseQcFlow ? (
                        <input
                          value={lineNotes[row.line_id] || ''}
                          onChange={(event) =>
                            setLineNotes((current) => ({
                              ...current,
                              [row.line_id]: event.target.value,
                            }))
                          }
                          className="app-input w-full min-w-[220px] rounded-xl px-3 py-2 text-sm"
                          placeholder="Ghi chú lỗi nếu cần"
                        />
                      ) : (
                        lineNotes[row.line_id] || '-'
                      )}
                    </td>
                  </tr>
                )
              })}
              {props.detail.lines.length > 0 ? (
                <tr
                  className="border-t"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)',
                  }}
                >
                  <td className="px-4 py-3 font-semibold" colSpan={5}>
                    Tổng
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatNumber(summary.actualQty)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatNumber(summary.acceptedQty)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatNumber(summary.rejectedQty)}</td>
                  <td className="px-4 py-3" />
                </tr>
              ) : null}
              {props.detail.lines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                    Chưa có dòng nào đủ điều kiện để QC nghiệm thu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {props.detail.lines.map((row) => {
            const actualQty = Number(row.so_luong_da_san_xuat || 0)
            const serialItems = serialResultsByLine.get(row.line_id) || []
            const acceptedQty =
              serialItems.length > 0
                ? serialItems.filter((item) => item.qcStatus === 'DAT').length
                : Math.min(Math.max(Number(acceptedQtyByLine[row.line_id] || 0), 0), actualQty)
            const rejectedQty = Math.max(actualQty - acceptedQty, 0)
            const serialManaged = serialItems.length > 0
            return (
              <div key={row.line_id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-base font-semibold">{row.ma_order || row.order_id}</div>
                <div className="mt-1 text-sm text-[var(--color-muted)]">
                  {(row.khach_hang || '-') + ' · ' + (row.du_an || '-')}
                </div>
                <div className="mt-2 text-sm">
                  {(row.loai_coc || '-') + ' · ' + row.ten_doan + ' · ' + formatNumber(row.chieu_dai_m) + 'm'}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'color-mix(in srgb, white 96%, var(--color-primary) 2%)' }}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">Thực SX</div>
                    <div className="mt-1 font-semibold">{formatNumber(actualQty)}</div>
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'color-mix(in srgb, white 96%, var(--color-primary) 2%)' }}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">SL đạt</div>
                    <div className="mt-1 font-semibold">
                      {canUseQcFlow && !serialManaged ? (
                        <input
                          type="number"
                          min={0}
                          max={actualQty}
                          value={acceptedQtyByLine[row.line_id] ?? String(actualQty)}
                          onChange={(event) =>
                            setAcceptedQtyByLine((current) => ({
                              ...current,
                              [row.line_id]: event.target.value,
                            }))
                          }
                          className="app-input w-full rounded-xl px-2 py-1 text-right text-sm"
                        />
                      ) : (
                        formatNumber(acceptedQty)
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'color-mix(in srgb, white 96%, var(--color-primary) 2%)' }}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">SL lỗi</div>
                    <div className="mt-1 font-semibold">{formatNumber(rejectedQty)}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <Field label="Ghi chú">
                    {canUseQcFlow ? (
                      <input
                        value={lineNotes[row.line_id] || ''}
                        onChange={(event) =>
                          setLineNotes((current) => ({
                            ...current,
                            [row.line_id]: event.target.value,
                          }))
                        }
                        className="app-input w-full rounded-xl px-3 py-2 text-sm"
                        placeholder="Ghi chú lỗi nếu cần"
                      />
                    ) : (
                      <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                        {lineNotes[row.line_id] || '-'}
                      </div>
                    )}
                  </Field>
                </div>
              </div>
            )
          })}

          {props.detail.lines.length > 0 ? (
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 4%, white)',
              }}
            >
              <div className="text-sm font-semibold">Tổng</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span><span className="text-[var(--color-muted)]">Thực SX</span> <span className="font-semibold">{formatNumber(summary.actualQty)}</span></span>
                <span><span className="text-[var(--color-muted)]">SL đạt</span> <span className="font-semibold">{formatNumber(summary.acceptedQty)}</span></span>
                <span><span className="text-[var(--color-muted)]">SL lỗi</span> <span className="font-semibold">{formatNumber(summary.rejectedQty)}</span></span>
              </div>
            </div>
          ) : null}
        </div>

        {serialResults.length > 0 ? (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold">QC theo serial</h3>
              {canUseQcFlow ? (
                <div className="grid grid-cols-2 rounded-2xl p-1" style={{ backgroundColor: 'color-mix(in srgb, white 90%, var(--color-primary) 4%)' }}>
                  <button
                    type="button"
                    onClick={() => setQcInputMode('SCAN')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${qcInputMode === 'SCAN' ? 'app-primary text-white' : ''}`}
                  >
                    Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setQcInputMode('SELECT')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${qcInputMode === 'SELECT' ? 'app-primary text-white' : ''}`}
                  >
                    Danh sách
                  </button>
                </div>
              ) : null}
            </div>

            {canUseQcFlow && qcInputMode === 'SCAN' ? (
              <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="font-semibold max-md:hidden">Quét QR serial lỗi</div>
                
                <div className="grid gap-3">
                  <input
                    value={manualScanValue}
                    onChange={(event) => setManualScanValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        submitManualScan()
                      }
                    }}
                    className="app-input w-full rounded-xl px-3 py-2 text-sm"
                    placeholder="Dán serial_code hoặc nội dung QR để thêm lỗi nhanh"
                  />
                </div>

                {scannerOpen ? (
                  <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        onLoadedData={() => setCameraReady(true)}
                        onPlaying={() => setCameraReady(true)}
                        className="block h-[280px] w-full object-cover"
                        style={{ backgroundColor: '#0f172a' }}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl border px-3 py-2 text-sm max-md:hidden" style={{ borderColor: 'var(--color-border)' }}>
                        Trạng thái camera: {cameraReady ? 'Đã lên hình' : 'Đang chờ camera'}
                      </div>
                      <div className="rounded-xl border px-3 py-2 text-sm max-md:hidden" style={{ borderColor: 'var(--color-border)' }}>
                        Đưa mã QR vào giữa khung. Scan trúng là tự thêm vào bảng lỗi.
                      </div>
                      {scanInfo ? (
                        <div
                          className="rounded-xl border px-3 py-2 text-sm"
                          style={{
                            borderColor: 'color-mix(in srgb, var(--color-primary) 24%, white)',
                            backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, white)',
                            color: 'var(--color-primary)',
                          }}
                        >
                          {scanInfo}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => (scannerOpen ? stopScanner() : void startScanner())}
                    disabled={scannerStarting || imageScanPending}
                    className="app-outline inline-flex h-11 w-11 items-center justify-center rounded-xl disabled:opacity-50"
                    aria-label={scannerStarting ? 'Đang scan' : scannerOpen ? 'Tắt scan' : 'Scan'}
                    title={scannerStarting ? 'Đang scan' : scannerOpen ? 'Tắt scan' : 'Scan'}
                  >
                    <ScanQrIcon className="h-6 w-6" />
                  </button>
                  <label className="app-outline inline-flex cursor-pointer items-center rounded-xl px-4 py-2 text-sm font-semibold">
                    {imageScanPending ? 'Đang đọc ảnh...' : 'Chọn ảnh QR'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imageScanPending}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          void scanImageFile(file)
                        }
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                  <span className="app-muted text-sm max-md:hidden">
                    Có thể dùng ảnh chụp QR trên màn hình hoặc ảnh tem in ra để test nhanh.
                  </span>
                </div>

                {scanError ? <div className="text-sm" style={{ color: '#b42318' }}>{scanError}</div> : null}
              </div>
            ) : null}
            <div className="hidden">
              {props.detail.lines.map((line) => {
                const items = serialResultsByLine.get(line.line_id) || []
                const defectCount = items.filter((item) => Boolean(serialDefectsById[item.serialId])).length
                return (
                  <div key={line.line_id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="font-semibold">{buildQcLineLabel(line)}</div>
                        <div className="app-muted mt-2 text-sm">
                          Tổng: {formatNumber(items.length)} · Đạt: {formatNumber(items.length - defectCount)} · Lỗi: {formatNumber(defectCount)}
                        </div>
                      </div>
                )
              })}
            </div>

            {(!canUseQcFlow || qcInputMode === 'SELECT') ? (
              <>
                <div className="overflow-x-auto rounded-2xl border max-md:hidden" style={{ borderColor: 'var(--color-border)' }}>
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, white)' }}>
                        <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Đoạn</th>
                        <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Serial lỗi</th>
                        <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Hướng xử lý</th>
                        <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase">Ghi chú</th>
                        {canUseQcFlow ? (
                          <th className="px-4 py-3 text-xs font-semibold tracking-[0.14em] uppercase text-right">Thao tác</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {defectDraftRows.length > 0
                        ? defectDraftRows.map((row) => {
                            const availableSerialOptions = serialBlueprints.filter(
                              (item) =>
                                item.lineId === row.lineId &&
                                !defectDraftRows.some((draft) => draft.id !== row.id && draft.serialId === item.serialId)
                            )
                            return (
                              <tr key={row.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                                <td className="px-4 py-3">
                                  {canUseQcFlow ? (
                                    <>
                                      <input
                                        list={`qc-line-options-${row.id}`}
                                        value={row.lineQuery || lineOptionMap.get(row.lineId) || ''}
                                        onChange={(event) => {
                                          const value = event.target.value
                                          const matched = lineOptions.find((item) => item.label === value)
                                          updateDefectDraftRow(row.id, {
                                            lineQuery: value,
                                            lineId: matched?.lineId || '',
                                          })
                                        }}
                                        className="app-input w-full min-w-[260px] rounded-xl px-3 py-2 text-sm"
                                        placeholder="Gõ để tìm đoạn"
                                      />
                                      <datalist id={`qc-line-options-${row.id}`}>
                                        {lineOptions.map((option) => (
                                          <option key={option.lineId} value={option.label} />
                                        ))}
                                      </datalist>
                                    </>
                                  ) : (
                                    lineOptionMap.get(row.lineId) || '-'
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {canUseQcFlow ? (
                                    <>
                                      <input
                                        list={`qc-serial-options-${row.id}`}
                                        value={row.serialQuery || serialBlueprintMap.get(row.serialId)?.serialCode || ''}
                                        onChange={(event) => {
                                          const value = event.target.value
                                          const matched = availableSerialOptions.find((item) => item.serialCode === value)
                                          updateDefectDraftRow(row.id, {
                                            serialQuery: value,
                                            serialId: matched?.serialId || '',
                                          })
                                        }}
                                        disabled={!row.lineId}
                                        className="app-input w-full min-w-[240px] rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                                        placeholder="Gõ để tìm serial"
                                      />
                                      <datalist id={`qc-serial-options-${row.id}`}>
                                        {availableSerialOptions.map((option) => (
                                          <option key={option.serialId} value={option.serialCode} />
                                        ))}
                                      </datalist>
                                    </>
                                  ) : (
                                    row.serialQuery || serialBlueprintMap.get(row.serialId)?.serialCode || '-'
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {canUseQcFlow ? (
                                    <select
                                      value={row.dispositionStatus}
                                      onChange={(event) =>
                                        updateDefectDraftRow(row.id, {
                                          dispositionStatus: event.target.value as QcDefectDraftRow['dispositionStatus'],
                                        })
                                      }
                                      className="app-input min-w-[170px] rounded-xl px-3 py-2 text-sm"
                                    >
                                      <option value="THANH_LY">Thanh lý / khách lẻ</option>
                                      <option value="HUY">Hủy bỏ</option>
                                    </select>
                                  ) : (
                                    dispositionLabel(row.dispositionStatus)
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {canUseQcFlow ? (
                                    <input
                                      value={row.note}
                                      onChange={(event) => updateDefectDraftRow(row.id, { note: event.target.value })}
                                      className="app-input w-full min-w-[220px] rounded-xl px-3 py-2 text-sm"
                                      placeholder="Ghi chú cho serial lỗi"
                                    />
                                  ) : (
                                    row.note || '-'
                                  )}
                                </td>
                                {canUseQcFlow ? (
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeDefectDraftRow(row.id)}
                                      aria-label="Bỏ dòng lỗi"
                                      title="Bỏ dòng lỗi"
                                      className="app-outline inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold leading-none"
                                    >
                                      ×
                                    </button>
                                  </td>
                                ) : null}
                              </tr>
                            )
                          })
                        : null}

                      {defectDraftRows.length === 0 ? (
                        <tr>
                          <td colSpan={canUseQcFlow ? 5 : 4} className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
                            Chưa có serial lỗi. Hệ thống coi toàn bộ serial còn lại là `Đạt`.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 md:hidden">
                  {defectDraftRows.length > 0 ? (
                    defectDraftRows.map((row) => {
                      const availableSerialOptions = serialBlueprints.filter(
                        (item) =>
                          item.lineId === row.lineId &&
                          !defectDraftRows.some((draft) => draft.id !== row.id && draft.serialId === item.serialId)
                      )
                      return (
                        <div key={row.id} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
                          <Field label="Đoạn">
                            {canUseQcFlow ? (
                              <>
                                <input
                                  list={`qc-line-options-mobile-${row.id}`}
                                  value={row.lineQuery || lineOptionMap.get(row.lineId) || ''}
                                  onChange={(event) => {
                                    const value = event.target.value
                                    const matched = lineOptions.find((item) => item.label === value)
                                    updateDefectDraftRow(row.id, {
                                      lineQuery: value,
                                      lineId: matched?.lineId || '',
                                    })
                                  }}
                                  className="app-input w-full rounded-xl px-3 py-2 text-sm"
                                  placeholder="Gõ để tìm đoạn"
                                />
                                <datalist id={`qc-line-options-mobile-${row.id}`}>
                                  {lineOptions.map((option) => (
                                    <option key={option.lineId} value={option.label} />
                                  ))}
                                </datalist>
                              </>
                            ) : (
                              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                                {lineOptionMap.get(row.lineId) || '-'}
                              </div>
                            )}
                          </Field>
                          <Field label="Serial lỗi">
                            {canUseQcFlow ? (
                              <>
                                <input
                                  list={`qc-serial-options-mobile-${row.id}`}
                                  value={row.serialQuery || serialBlueprintMap.get(row.serialId)?.serialCode || ''}
                                  onChange={(event) => {
                                    const value = event.target.value
                                    const matched = availableSerialOptions.find((item) => item.serialCode === value)
                                    updateDefectDraftRow(row.id, {
                                      serialQuery: value,
                                      serialId: matched?.serialId || '',
                                    })
                                  }}
                                  disabled={!row.lineId}
                                  className="app-input w-full rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                                  placeholder="Gõ để tìm serial"
                                />
                                <datalist id={`qc-serial-options-mobile-${row.id}`}>
                                  {availableSerialOptions.map((option) => (
                                    <option key={option.serialId} value={option.serialCode} />
                                  ))}
                                </datalist>
                              </>
                            ) : (
                              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                                {row.serialQuery || serialBlueprintMap.get(row.serialId)?.serialCode || '-'}
                              </div>
                            )}
                          </Field>
                          <Field label="Hướng xử lý">
                            {canUseQcFlow ? (
                              <select
                                value={row.dispositionStatus}
                                onChange={(event) =>
                                  updateDefectDraftRow(row.id, {
                                    dispositionStatus: event.target.value as QcDefectDraftRow['dispositionStatus'],
                                  })
                                }
                                className="app-input w-full rounded-xl px-3 py-2 text-sm"
                              >
                                <option value="THANH_LY">Thanh lý / khách lẻ</option>
                                <option value="HUY">Hủy bỏ</option>
                              </select>
                            ) : (
                              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                                {dispositionLabel(row.dispositionStatus)}
                              </div>
                            )}
                          </Field>
                          <Field label="Ghi chú">
                            {canUseQcFlow ? (
                              <input
                                value={row.note}
                                onChange={(event) => updateDefectDraftRow(row.id, { note: event.target.value })}
                                className="app-input w-full rounded-xl px-3 py-2 text-sm"
                                placeholder="Ghi chú cho serial lỗi"
                              />
                            ) : (
                              <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                                {row.note || '-'}
                              </div>
                            )}
                          </Field>
                          {canUseQcFlow ? (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeDefectDraftRow(row.id)}
                                className="app-outline rounded-xl px-4 py-2 text-sm font-semibold"
                              >
                                Xóa dòng lỗi
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  ) : (
                    <div className="rounded-2xl border px-4 py-6 text-center text-sm text-[var(--color-muted)]" style={{ borderColor: 'var(--color-border)' }}>
                      Chưa có serial lỗi. Hệ thống coi toàn bộ serial còn lại là `Đạt`.
                    </div>
                  )}
                </div>

                {canUseQcFlow ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => addDefectDraftRow()}
                      className="app-outline rounded-xl px-4 py-2 text-sm font-semibold"
                    >
                      + Thêm dòng lỗi
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {canUseQcFlow ? (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => void saveQcIssue()}
              disabled={pending}
              className="app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function buildInitialAcceptedState(lines: QcNghiemThuDetail['lines'], results: QcIssueLineResult[]) {
  const resultMap = new Map(results.map((item) => [item.lineId, item]))
  return Object.fromEntries(
    lines.map((line) => [line.line_id, String(Number(resultMap.get(line.line_id)?.acceptedQty ?? line.so_luong_da_san_xuat ?? 0))])
  )
}

function buildInitialLineNotes(results: QcIssueLineResult[]) {
  return Object.fromEntries(results.map((item) => [item.lineId, item.note || '']))
}

function buildInitialDefectDraftRows(results: QcSerialResult[], canUseQcFlow: boolean) {
  const mappedRows = results
    .filter((item) => item.qcStatus === 'LOI')
    .map((item, index) => ({
      id: `draft-row-${index + 1}`,
      lineId: item.lineId,
      lineQuery: '',
      serialId: item.serialId,
      serialQuery: item.serialCode,
      dispositionStatus: (item.dispositionStatus === 'THANH_LY' ? 'THANH_LY' : 'HUY') as QcDefectDraftRow['dispositionStatus'],
      note: item.note || '',
    }))

  if (mappedRows.length > 0) return mappedRows
  return canUseQcFlow ? [buildEmptyDefectDraftRow(1)] : []
}

function buildEmptyDefectDraftRow(seq: number): QcDefectDraftRow {
  return {
    id: `draft-row-${seq}`,
    lineId: '',
    lineQuery: '',
    serialId: '',
    serialQuery: '',
    dispositionStatus: 'THANH_LY',
    note: '',
  }
}

function ScanQrIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4.75 8.25V5.75a1 1 0 0 1 1-1h2.5" strokeLinecap="round" />
      <path d="M19.25 8.25V5.75a1 1 0 0 0-1-1h-2.5" strokeLinecap="round" />
      <path d="M4.75 15.75v2.5a1 1 0 0 0 1 1h2.5" strokeLinecap="round" />
      <path d="M19.25 15.75v2.5a1 1 0 0 1-1 1h-2.5" strokeLinecap="round" />
      <path d="M8 8h3v3H8z" />
      <path d="M13 8h3v3h-3z" />
      <path d="M8 13h3v3H8z" />
      <path d="M13 13h1.5" strokeLinecap="round" />
      <path d="M16 13v3" strokeLinecap="round" />
      <path d="M13 16h3" strokeLinecap="round" />
    </svg>
  )
}

function buildQcLineLabel(line: QcNghiemThuDetail['lines'][number]) {
  return `${line.loai_coc || '-'} | ${line.ten_doan} | ${formatNumber(line.chieu_dai_m)}m`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0))
}

function dispositionLabel(value: QcSerialResult['dispositionStatus']) {
  if (value === 'THANH_LY') return 'Thanh lý / khách lẻ'
  if (value === 'HUY') return 'Hủy bỏ'
  return 'Bình thường'
}

function normalizeCode(value: string) {
  return String(value || '').trim().toUpperCase()
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold">{props.label}</span>
      {props.children}
    </label>
  )
}
