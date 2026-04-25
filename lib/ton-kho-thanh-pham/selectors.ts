import type {
  FinishedGoodsInventoryFilters,
  FinishedGoodsInventoryItemDetail,
  FinishedGoodsInventorySummaryRow,
} from '@/lib/ton-kho-thanh-pham/types'
import {
  deriveStockSegmentGroup,
  isHoldInventoryRow,
  matchesQuery,
  matchesScope,
  resolveVisibilityLabel,
  SERIAL_PAGE_SIZE,
  type InventorySerialRecord,
} from '@/lib/ton-kho-thanh-pham/internal'

export function buildInventorySummaryRows(
  currentRows: InventorySerialRecord[],
  legacyShipmentGapByItem: Map<string, number>
) {
  const summaryMap = new Map<string, FinishedGoodsInventorySummaryRow & { lotIds: Set<string> }>()

  for (const row of currentRows) {
    const existing =
      summaryMap.get(row.itemKey) ||
      ({
        itemKey: row.itemKey,
        itemLabel: row.itemLabel,
        templateId: row.templateId,
        maCoc: row.maCoc,
        loaiCoc: row.loaiCoc,
        tenDoan: deriveStockSegmentGroup(row.tenDoan),
        chieuDaiM: row.chieuDaiM,
        physicalQty: 0,
        projectQty: 0,
        retailQty: 0,
        holdQty: 0,
        lotCount: 0,
        latestProductionDate: row.productionDate,
        legacyShipmentGapQty: 0,
        lotIds: new Set<string>(),
      } satisfies FinishedGoodsInventorySummaryRow & { lotIds: Set<string> })

    existing.physicalQty += 1
    if (row.visibleInProject) existing.projectQty += 1
    if (row.visibleInRetail) existing.retailQty += 1
    if (isHoldInventoryRow(row)) existing.holdQty += 1
    if (row.lotId) existing.lotIds.add(row.lotId)
    if (row.productionDate && (!existing.latestProductionDate || row.productionDate > existing.latestProductionDate)) {
      existing.latestProductionDate = row.productionDate
    }
    existing.lotCount = existing.lotIds.size
    summaryMap.set(row.itemKey, existing)
  }

  for (const [itemKey, gapQty] of legacyShipmentGapByItem.entries()) {
    const existing = summaryMap.get(itemKey)
    if (!existing || !gapQty) continue
    existing.legacyShipmentGapQty = gapQty
    existing.physicalQty = Math.max(existing.physicalQty - gapQty, 0)
    existing.projectQty = Math.max(existing.projectQty - gapQty, 0)
    existing.retailQty = Math.max(existing.retailQty - gapQty, 0)
    summaryMap.set(itemKey, existing)
  }

  return summaryMap
}

export function buildFilteredSummaryRows(
  summaryMap: Map<string, FinishedGoodsInventorySummaryRow & { lotIds: Set<string> }>,
  filters: FinishedGoodsInventoryFilters
): FinishedGoodsInventorySummaryRow[] {
  return Array.from(summaryMap.values())
    .filter((row) => matchesScope(row, filters.scope))
    .filter((row) => matchesQuery(row, filters.query))
    .sort((a, b) => {
      if (b.physicalQty !== a.physicalQty) return b.physicalQty - a.physicalQty
      return a.itemLabel.localeCompare(b.itemLabel, 'vi')
    })
    .map((row) => {
      const { lotIds, ...rest } = row
      void lotIds
      return rest
    })
}

export function buildSelectedItemDetail(
  currentRows: InventorySerialRecord[],
  filteredRows: FinishedGoodsInventorySummaryRow[],
  summaryMap: Map<string, FinishedGoodsInventorySummaryRow & { lotIds: Set<string> }>,
  filters: FinishedGoodsInventoryFilters
): FinishedGoodsInventoryItemDetail | null {
  if (!filters.selectedItemKey) return null

  const scopedSerials = currentRows
    .filter((row) => row.itemKey === filters.selectedItemKey)
    .filter((row) => {
      if (filters.scope === 'PROJECT') return row.visibleInProject
      if (filters.scope === 'RETAIL') return row.visibleInRetail
      if (filters.scope === 'HOLD') return isHoldInventoryRow(row)
      return true
    })
    .sort((a, b) => {
      if (a.lotCode !== b.lotCode) return a.lotCode.localeCompare(b.lotCode, 'vi')
      return a.serialCode.localeCompare(b.serialCode, 'vi')
    })

  if (!scopedSerials.length) return null

  const summary = filteredRows.find((row) => row.itemKey === filters.selectedItemKey) || summaryMap.get(filters.selectedItemKey)
  const useScopedCounts = filters.scope !== 'ALL'
  const serialPageCount = Math.max(Math.ceil(scopedSerials.length / SERIAL_PAGE_SIZE), 1)
  const serialPage = Math.min(filters.serialPage, serialPageCount)
  const serialRows = scopedSerials
    .slice((serialPage - 1) * SERIAL_PAGE_SIZE, serialPage * SERIAL_PAGE_SIZE)
    .map((row) => ({
      serialId: row.serialId,
      serialCode: row.serialCode,
      lotCode: row.lotCode,
      productionDate: row.productionDate,
      lifecycleStatus: row.lifecycleStatus,
      dispositionStatus: row.dispositionStatus,
      visibilityLabel: resolveVisibilityLabel(row.visibleInProject, row.visibleInRetail),
      locationLabel: row.locationLabel,
      note: row.note,
    }))

  return {
    itemKey: filters.selectedItemKey,
    itemLabel: summary?.itemLabel || scopedSerials[0].itemLabel,
    templateId: summary?.templateId || scopedSerials[0].templateId,
    maCoc: summary?.maCoc || scopedSerials[0].maCoc,
    loaiCoc: summary?.loaiCoc || scopedSerials[0].loaiCoc,
    tenDoan: summary?.tenDoan || scopedSerials[0].tenDoan,
    chieuDaiM: summary?.chieuDaiM || scopedSerials[0].chieuDaiM,
    physicalQty: useScopedCounts ? scopedSerials.length : summary?.physicalQty || scopedSerials.length,
    projectQty:
      useScopedCounts
        ? scopedSerials.filter((row) => row.visibleInProject).length
        : summary?.projectQty || scopedSerials.filter((row) => row.visibleInProject).length,
    retailQty:
      useScopedCounts
        ? scopedSerials.filter((row) => row.visibleInRetail).length
        : summary?.retailQty || scopedSerials.filter((row) => row.visibleInRetail).length,
    holdQty:
      useScopedCounts
        ? scopedSerials.filter((row) => isHoldInventoryRow(row)).length
        : summary?.holdQty || scopedSerials.filter((row) => isHoldInventoryRow(row)).length,
    lotCount: useScopedCounts ? new Set(scopedSerials.map((row) => row.lotId)).size : summary?.lotCount || new Set(scopedSerials.map((row) => row.lotId)).size,
    legacyShipmentGapQty: summary?.legacyShipmentGapQty || 0,
    serialRows,
    totalSerialCount: scopedSerials.length,
    serialPage,
    serialPageCount,
  }
}
