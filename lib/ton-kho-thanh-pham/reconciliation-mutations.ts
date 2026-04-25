import { createHash } from 'node:crypto'
import { isAdminRole, isCommercialRole, isWarehouseRole } from '@/lib/auth/roles'
import { normalizeText, safeArray } from '@/lib/ton-kho-thanh-pham/internal'
import { loadLegacyReconciliationDetailPageData } from '@/lib/ton-kho-thanh-pham/reconciliation-repository'
import type {
  LegacyReconciliationAssignmentBody,
  LegacyReconciliationAssignmentResult,
} from '@/lib/ton-kho-thanh-pham/reconciliation-types'

type AnySupabase = Parameters<typeof loadLegacyReconciliationDetailPageData>[0]

type NormalizedAssignment = {
  lineId: string
  itemKey: string
  serialId: string
}

function toStableUuid(value: string) {
  const normalized = String(value || '').trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return normalized
  }
  const hex = createHash('sha1').update(normalized || 'empty-line-id').digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function ensureAllowedRole(userRole: string) {
  if (!isWarehouseRole(userRole) && !isAdminRole(userRole) && !isCommercialRole(userRole)) {
    throw new Error('Bạn không có quyền đối soát serial legacy')
  }
}

function normalizeAssignments(body: LegacyReconciliationAssignmentBody): NormalizedAssignment[] {
  const seen = new Set<string>()
  const rows: NormalizedAssignment[] = []
  for (const item of Array.isArray(body.assignments) ? body.assignments : []) {
    const lineId = normalizeText(item?.lineId)
    const itemKey = normalizeText(item?.itemKey)
    const serialId = normalizeText(item?.serialId)
    if (!lineId || !itemKey || !serialId) continue
    const dedupeKey = `${lineId}::${itemKey}::${serialId}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    rows.push({ lineId, itemKey, serialId })
  }
  return rows
}

export async function executeLegacyReconciliationAssignMutation(input: {
  supabase: AnySupabase
  voucherId: string
  userId: string
  userRole: string
  body: LegacyReconciliationAssignmentBody
}): Promise<LegacyReconciliationAssignmentResult> {
  ensureAllowedRole(input.userRole)

  const assignments = normalizeAssignments(input.body)
  if (!assignments.length) {
    throw new Error('Cần chọn ít nhất một serial để đối soát')
  }

  const detail = await loadLegacyReconciliationDetailPageData(input.supabase, input.voucherId)
  if (!detail) throw new Error('Không tìm thấy phiếu cần đối soát legacy')

  const itemMap = new Map(detail.items.map((item) => [`${item.lineId}::${item.itemKey}`, item]))
  const grouped = new Map<string, NormalizedAssignment[]>()
  for (const assignment of assignments) {
    const key = `${assignment.lineId}::${assignment.itemKey}`
    grouped.set(key, [...(grouped.get(key) || []), assignment])
  }

  for (const [key, selected] of grouped.entries()) {
    const item = itemMap.get(key)
    if (!item) throw new Error('Có serial không thuộc dòng legacy hiện tại')
    if (selected.length > item.unresolvedQty) {
      throw new Error(`Mặt hàng ${item.itemLabel} đang chỉ còn gap ${item.unresolvedQty} cây`)
    }
    const candidateIds = new Set(item.serialCandidates.map((serial) => serial.serialId))
    for (const assignment of selected) {
      if (!candidateIds.has(assignment.serialId)) {
        throw new Error(`Serial ${assignment.serialId} không còn là ứng viên hợp lệ cho ${item.itemLabel}`)
      }
    }
  }

  const serialIds = assignments.map((item) => item.serialId)
  const { data: currentRows, error: currentError } = await input.supabase
    .from('pile_serial')
    .select('serial_id, serial_code, lifecycle_status, qc_status, disposition_status, current_location_id, current_shipment_voucher_id')
    .in('serial_id', serialIds)
    .eq('is_active', true)
  if (currentError) throw currentError

  const currentById = new Map(safeArray<Record<string, unknown>>(currentRows).map((row) => [normalizeText(row.serial_id), row]))
  for (const assignment of assignments) {
    const current = currentById.get(assignment.serialId)
    if (!current) throw new Error(`Không tìm thấy serial ${assignment.serialId}`)
    const currentVoucherId = normalizeText(current.current_shipment_voucher_id)
    if (currentVoucherId && currentVoucherId !== input.voucherId) {
      throw new Error(`Serial ${String(current.serial_code || assignment.serialId)} đang gắn với phiếu xuất khác`)
    }
  }

  const { data: voucherRows, error: voucherError } = await input.supabase
    .from('phieu_xuat_ban')
    .select('payload_json')
    .eq('voucher_id', input.voucherId)
    .maybeSingle()
  if (voucherError) throw voucherError
  const payload = (voucherRows?.payload_json as Record<string, unknown> | null) || {}
  const confirmedSerials = safeArray<Record<string, unknown>>(payload.confirmedSerials)
  const confirmedKeys = new Set(
    confirmedSerials.map((item) => `${normalizeText(item.lineId)}::${normalizeText(item.serialId)}`).filter(Boolean)
  )

  const itemByKey = new Map(detail.items.map((item) => [`${item.lineId}::${item.itemKey}`, item]))
  const newConfirmedPayloadRows = assignments
    .filter((assignment) => !confirmedKeys.has(`${assignment.lineId}::${assignment.serialId}`))
    .map((assignment) => {
      const item = itemByKey.get(`${assignment.lineId}::${assignment.itemKey}`)
      const current = currentById.get(assignment.serialId)
      return {
        lineId: assignment.lineId,
        serialId: assignment.serialId,
        serialCode: String(current?.serial_code || ''),
        orderSourceKey: item?.orderSourceKey || null,
        stockSourceKey: item?.stockSourceKey || '',
      }
    })

  const shipmentRows = assignments.map((assignment) => ({
    voucher_id: input.voucherId,
    voucher_line_id: toStableUuid(assignment.lineId),
    serial_id: assignment.serialId,
    confirmed_at: new Date().toISOString(),
    created_by: input.userId,
  }))
  const { error: insertError } = await input.supabase.from('shipment_voucher_serial').insert(shipmentRows)
  if (insertError) throw insertError

  const { error: updateError } = await input.supabase
    .from('pile_serial')
    .update({
      lifecycle_status: 'DA_XUAT',
      current_shipment_voucher_id: input.voucherId,
      updated_at: new Date().toISOString(),
    })
    .in('serial_id', serialIds)
  if (updateError) throw updateError

  const historyRows = assignments.map((assignment) => {
    const current = currentById.get(assignment.serialId)
    return {
      serial_id: assignment.serialId,
      event_type: 'LEGACY_RECONCILIATION_OUT',
      from_lifecycle_status: current?.lifecycle_status || null,
      to_lifecycle_status: 'DA_XUAT',
      from_qc_status: current?.qc_status || null,
      to_qc_status: current?.qc_status || null,
      from_disposition_status: current?.disposition_status || null,
      to_disposition_status: current?.disposition_status || null,
      from_location_id: current?.current_location_id || null,
      to_location_id: current?.current_location_id || null,
      ref_type: 'LEGACY_RECONCILIATION',
      ref_id: input.voucherId,
      note: String(input.body.note || 'Đối soát serial legacy cho phiếu xuất tay'),
      changed_by: input.userId,
    }
  })
  const { error: historyError } = await input.supabase.from('pile_serial_history').insert(historyRows)
  if (historyError) throw historyError

  const nextPayload = {
    ...payload,
    confirmedSerials: [...confirmedSerials, ...newConfirmedPayloadRows],
  }
  const { error: payloadError } = await input.supabase
    .from('phieu_xuat_ban')
    .update({
      payload_json: nextPayload,
      updated_by: input.userId,
    })
    .eq('voucher_id', input.voucherId)
  if (payloadError) throw payloadError

  const refreshed = await loadLegacyReconciliationDetailPageData(input.supabase, input.voucherId)
  const remainingQty = refreshed?.unresolvedQtyTotal ?? 0

  return {
    voucherId: input.voucherId,
    assignedQty: assignments.length,
    remainingQty,
    affectedItems: detail.items.map((item) => {
      const assignedQty = assignments.filter((assignment) => assignment.lineId === item.lineId && assignment.itemKey === item.itemKey).length
      return {
        lineId: item.lineId,
        itemKey: item.itemKey,
        assignedQty,
        remainingQty: Math.max(item.unresolvedQty - assignedQty, 0),
      }
    }).filter((item) => item.assignedQty > 0),
  }
}
