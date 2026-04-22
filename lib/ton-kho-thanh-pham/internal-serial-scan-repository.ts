import type { SupabaseClient } from '@supabase/supabase-js'
import { loadPileTemplateDetailByLoaiCoc } from '@/lib/pile-template-lookup/repository'
import { loadFinishedGoodsCurrentInventoryRows } from '@/lib/ton-kho-thanh-pham/repository'
import type { WarehouseInternalSerialLookupData } from '@/lib/ton-kho-thanh-pham/internal-serial-scan-types'
import {
  buildItemKey,
  buildItemLabel,
  buildLocationLabel,
  deriveInventoryVisibility,
  isCurrentInventoryRow,
  normalizeText,
  round3,
  toNumber,
} from '@/lib/ton-kho-thanh-pham/internal'

function formatProcurementNote(note: string) {
  const normalized = normalizeText(note)
  const match = normalized.match(/^Nhap mua coc ngoai tu phieu (PO-COC-[^- ]+-\d+) - NCC (.+?)(?: - dong \d+)?$/u)
  if (match) {
    return `${match[1]} - NCC ${match[2]}`
  }
  return normalized
}

function buildQcLabel(qcStatus: string) {
  if (qcStatus === 'DAT') return 'Đạt'
  if (qcStatus === 'LOI') return 'Lỗi'
  if (qcStatus === 'CHUA_QC') return 'Chờ QC'
  return qcStatus || '-'
}

function buildLifecycleLabel(lifecycleStatus: string) {
  if (lifecycleStatus === 'DA_XUAT') return 'Đã xuất'
  if (lifecycleStatus === 'HUY_BO') return 'Hủy'
  if (lifecycleStatus === 'CHO_DUYET_KIEM_KE') return 'Chờ duyệt kiểm kê'
  return 'Trong kho'
}

export async function loadWarehouseInternalSerialLookup(
  supabase: SupabaseClient,
  serialCode: string
): Promise<WarehouseInternalSerialLookupData> {
  const normalizedSerialCode = normalizeText(serialCode)
  if (!normalizedSerialCode) {
    throw new Error('Cần serial hợp lệ để tra cứu.')
  }

  const { data, error } = await supabase
    .from('pile_serial')
    .select(
      'serial_id, serial_code, lot_id, loai_coc, ten_doan, chieu_dai_m, qc_status, lifecycle_status, disposition_status, visible_in_project, visible_in_retail, current_location_id, notes, is_active'
    )
    .eq('serial_code', normalizedSerialCode)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error(`Không tìm thấy serial ${normalizedSerialCode}.`)
  }

  const lotId = String(data.lot_id || '')
  const currentLocationId = String(data.current_location_id || '')
  const loaiCoc = normalizeText(data.loai_coc)
  const [lotResponse, locationResponse, currentInventoryRows, templateDetail] = await Promise.all([
    lotId
      ? supabase.from('production_lot').select('lot_id, lot_code, production_date').eq('lot_id', lotId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    currentLocationId
      ? supabase
          .from('warehouse_location')
          .select('location_id, location_code, location_name')
          .eq('location_id', currentLocationId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadFinishedGoodsCurrentInventoryRows(supabase),
    loadPileTemplateDetailByLoaiCoc(supabase, loaiCoc),
  ])

  if (lotResponse.error) throw lotResponse.error
  if (locationResponse.error) throw locationResponse.error

  const tenDoan = normalizeText(data.ten_doan)
  const chieuDaiM = round3(toNumber(data.chieu_dai_m))
  const itemKey = buildItemKey(loaiCoc, tenDoan, chieuDaiM)
  const currentItemRows = currentInventoryRows.filter((row) => row.itemKey === itemKey)
  const currentSerialRow = currentItemRows.find((row) => row.serialId === String(data.serial_id || ''))

  const qcStatus = normalizeText(data.qc_status)
  const dispositionStatus = normalizeText(data.disposition_status)
  const visibility = currentSerialRow
    ? {
        visibleInProject: currentSerialRow.visibleInProject,
        visibleInRetail: currentSerialRow.visibleInRetail,
      }
    : deriveInventoryVisibility(
        qcStatus,
        dispositionStatus,
        Boolean(data.visible_in_project),
        Boolean(data.visible_in_retail)
      )

  const resolvedLocationCode = normalizeText(locationResponse.data?.location_code)
  const resolvedLocationName = normalizeText(locationResponse.data?.location_name)
  const inCurrentInventory =
    Boolean(data.is_active) &&
    isCurrentInventoryRow(normalizeText(data.lifecycle_status)) &&
    qcStatus !== 'CHUA_QC'

  return {
    serialId: String(data.serial_id || ''),
    serialCode: normalizeText(data.serial_code),
    itemKey,
    itemLabel: buildItemLabel(loaiCoc, tenDoan, chieuDaiM),
    loaiCoc,
    tenDoan,
    chieuDaiM,
    lotCode: normalizeText(lotResponse.data?.lot_code),
    productionDate: normalizeText(lotResponse.data?.production_date),
    qcStatus,
    qcLabel: buildQcLabel(qcStatus),
    lifecycleStatus: normalizeText(data.lifecycle_status),
    lifecycleLabel: buildLifecycleLabel(normalizeText(data.lifecycle_status)),
    dispositionStatus,
    visibilityLabel:
      visibility.visibleInProject && visibility.visibleInRetail
        ? 'Dự án + Khách lẻ'
        : visibility.visibleInProject
          ? 'Dự án'
          : visibility.visibleInRetail
            ? 'Khách lẻ'
            : 'Ẩn / chờ xử lý',
    note: formatProcurementNote(currentSerialRow?.note || normalizeText(data.notes)),
    inCurrentInventory,
    currentLocationId,
    currentLocationLabel:
      currentSerialRow?.locationLabel || buildLocationLabel(resolvedLocationCode, resolvedLocationName),
    physicalQty: currentItemRows.length,
    projectQty: currentItemRows.filter((row) => row.visibleInProject).length,
    retailQty: currentItemRows.filter((row) => row.visibleInRetail).length,
    holdQty: currentItemRows.filter((row) => !row.visibleInProject && !row.visibleInRetail).length,
    currentItemSerialCount: currentItemRows.length,
    locationActionMode: inCurrentInventory ? (currentLocationId ? 'TRANSFER' : 'ASSIGN') : 'NONE',
    templateDetail: templateDetail
      ? {
          templateId: templateDetail.templateId,
          maCoc: templateDetail.maCoc,
          cuongDo: templateDetail.cuongDo,
          macThep: templateDetail.macThep,
          doNgoai: templateDetail.doNgoai,
          chieuDay: templateDetail.chieuDay,
          macBeTong: templateDetail.macBeTong,
          khoiLuongKgMd: templateDetail.khoiLuongKgMd,
          steelLabels: templateDetail.steelLabels,
          pcNos: templateDetail.pcNos,
          donKepFactor: templateDetail.donKepFactor,
          a1Mm: templateDetail.a1Mm,
          a2Mm: templateDetail.a2Mm,
          a3Mm: templateDetail.a3Mm,
          p1Pct: templateDetail.p1Pct,
          p2Pct: templateDetail.p2Pct,
          p3Pct: templateDetail.p3Pct,
          accessoryLabels: templateDetail.accessoryLabels,
          techPreview: templateDetail.techPreview,
        }
      : null,
  }
}
