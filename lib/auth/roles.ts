function normalizeRoleValue(value: string | null | undefined) {
  return String(value || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
}

export function normalizeRole(value: string | null | undefined) {
  return normalizeRoleValue(value)
}

export function isAdminRole(role: string | null | undefined) {
  return normalizeRoleValue(role) === 'admin'
}

export function isQlsxRole(role: string | null | undefined) {
  const normalized = normalizeRoleValue(role)
  return normalized === 'qlsx' || normalized === 'quan ly san xuat'
}

export function isTechnicalRole(role: string | null | undefined) {
  const normalized = normalizeRoleValue(role)
  return normalized === 'ky thuat' || normalized === 'kỹ thuật'
}

export function isWarehouseRole(role: string | null | undefined) {
  const normalized = normalizeRoleValue(role)
  return normalized === 'thu kho' || normalized === 'thukho' || normalized === 'warehouse'
}

export function isInventoryCounterRole(role: string | null | undefined) {
  const normalized = normalizeRoleValue(role)
  return (
    normalized === 'kiem ke vien' ||
    normalized === 'kiemke vien' ||
    normalized === 'kiem ke' ||
    normalized === 'inventory counter'
  )
}

export function isQcRole(role: string | null | undefined) {
  const normalized = normalizeRoleValue(role)
  return normalized === 'qc' || normalized === 'kiem chat luong' || normalized === 'quality control'
}

export function isBusinessRole(role: string | null | undefined) {
  const normalized = normalizeRoleValue(role)
  return normalized === 'kinh doanh' || normalized === 'sales'
}

export function isSalesAccountingRole(role: string | null | undefined) {
  const normalized = normalizeRoleValue(role)
  return (
    normalized === 'ke toan ban hang' ||
    normalized === 'ketoan ban hang' ||
    normalized === 'sales accounting'
  )
}

export function isPurchaseRole(role: string | null | undefined) {
  const normalized = normalizeRoleValue(role)
  return (
    normalized === 'ktmh' ||
    normalized === 'ke toan mua hang' ||
    normalized === 'ketoan mua hang' ||
    normalized === 'mua hang' ||
    normalized === 'purchasing'
  )
}

export function isCommercialRole(role: string | null | undefined) {
  return isBusinessRole(role) || isSalesAccountingRole(role)
}

export function canViewAuditLog(role: string | null | undefined) {
  return isAdminRole(role)
}

export function canAccessNvlStockTruth(role: string | null | undefined) {
  return (
    isQlsxRole(role) ||
    isAdminRole(role) ||
    isWarehouseRole(role) ||
    isPurchaseRole(role) ||
    isSalesAccountingRole(role)
  )
}

export function canViewMaterialIssue(role: string | null | undefined) {
  return isCommercialRole(role) || isWarehouseRole(role) || isAdminRole(role)
}

export function canCreateMaterialIssue(role: string | null | undefined) {
  return isCommercialRole(role) || isAdminRole(role)
}

export function canConfirmMaterialIssue(role: string | null | undefined) {
  return isWarehouseRole(role) || isAdminRole(role)
}

export function canAccessNvlProcurement(role: string | null | undefined) {
  return isQlsxRole(role) || isPurchaseRole(role) || isWarehouseRole(role) || isAdminRole(role)
}

export function canCreateNvlPurchaseRequest(role: string | null | undefined) {
  return isQlsxRole(role) || isWarehouseRole(role) || isAdminRole(role)
}

export function canEditNvlReceiptDraft(role: string | null | undefined) {
  return isQlsxRole(role) || isWarehouseRole(role) || isAdminRole(role)
}

export function canConfirmNvlReceiptMovement(role: string | null | undefined) {
  return isQlsxRole(role) || isWarehouseRole(role) || isAdminRole(role)
}

export function canAccessExternalPileProcurement(role: string | null | undefined) {
  return isQlsxRole(role) || isPurchaseRole(role) || isWarehouseRole(role) || isAdminRole(role)
}

export function canCreateExternalPileRequest(role: string | null | undefined) {
  return isQlsxRole(role) || isAdminRole(role)
}

export function canApproveExternalPileRequest(role: string | null | undefined) {
  return isPurchaseRole(role) || isAdminRole(role)
}

export function canReceiveExternalPileOrder(role: string | null | undefined) {
  return isWarehouseRole(role) || isAdminRole(role)
}

export function canViewShipment(role: string | null | undefined) {
  return isCommercialRole(role) || isWarehouseRole(role) || isAdminRole(role)
}

export function canCreateShipment(role: string | null | undefined) {
  return isCommercialRole(role) || isAdminRole(role)
}

export function canConfirmShipment(role: string | null | undefined) {
  return isWarehouseRole(role) || isAdminRole(role)
}

export function canAccessNvlDemand(role: string | null | undefined) {
  return isQlsxRole(role) || isWarehouseRole(role) || isAdminRole(role)
}

export function canViewProductionPlan(role: string | null | undefined) {
  return isQlsxRole(role) || isWarehouseRole(role) || isSalesAccountingRole(role) || isAdminRole(role)
}

export function canViewProductionVarianceReport(role: string | null | undefined) {
  return isQlsxRole(role) || isWarehouseRole(role) || isPurchaseRole(role) || isAdminRole(role)
}

export function canManageProductionPlan(role: string | null | undefined) {
  return isQlsxRole(role) || isAdminRole(role)
}

export function canSaveProductionActual(role: string | null | undefined) {
  return isWarehouseRole(role) || isAdminRole(role)
}

export function canConfirmProductionActual(role: string | null | undefined) {
  return isWarehouseRole(role) || isAdminRole(role)
}

export function canViewFinishedGoodsInventory(role: string | null | undefined) {
  return isCommercialRole(role) || isWarehouseRole(role) || isQlsxRole(role) || isAdminRole(role)
}

export function canUsePileLookup(role: string | null | undefined) {
  return (
    isAdminRole(role) ||
    isSalesAccountingRole(role) ||
    isBusinessRole(role) ||
    isTechnicalRole(role) ||
    isQlsxRole(role) ||
    isWarehouseRole(role) ||
    isInventoryCounterRole(role)
  )
}

export function canManageWarehouseLocation(role: string | null | undefined) {
  return isWarehouseRole(role) || isQlsxRole(role) || isAdminRole(role)
}

export function canAccessInventoryCount(role: string | null | undefined) {
  return isWarehouseRole(role) || isInventoryCounterRole(role) || isPurchaseRole(role) || isAdminRole(role)
}

export function canEditInventoryCount(role: string | null | undefined) {
  return isWarehouseRole(role) || isInventoryCounterRole(role) || isAdminRole(role)
}

export function canApproveInventoryCount(role: string | null | undefined) {
  return isPurchaseRole(role) || isAdminRole(role)
}

export function canConfirmInventoryCount(role: string | null | undefined) {
  return isWarehouseRole(role) || isAdminRole(role)
}

export function canAccessFinishedGoodsCount(role: string | null | undefined) {
  return isWarehouseRole(role) || isInventoryCounterRole(role) || isAdminRole(role)
}

export function canPrintFinishedGoodsGeneratedLabels(role: string | null | undefined) {
  return (
    isWarehouseRole(role) ||
    isInventoryCounterRole(role) ||
    isQlsxRole(role) ||
    isPurchaseRole(role) ||
    isAdminRole(role)
  )
}

export function canCreateFinishedGoodsCount(role: string | null | undefined) {
  return isInventoryCounterRole(role) || isAdminRole(role)
}

export function canApproveFinishedGoodsCount(role: string | null | undefined) {
  return isAdminRole(role)
}

export function canAccessQc(role: string | null | undefined) {
  return isQcRole(role) || isAdminRole(role)
}

export function canCreateProductionPlan(role: string | null | undefined) {
  return isQlsxRole(role) || isAdminRole(role)
}

export function canFinalizePurchaseOrder(role: string | null | undefined) {
  return isPurchaseRole(role) || isAdminRole(role)
}

export function canFinishPurchaseOrder(role: string | null | undefined) {
  return isWarehouseRole(role) || isAdminRole(role)
}

export function canApproveProductionPlan(role: string | null | undefined) {
  return isSalesAccountingRole(role) || isAdminRole(role)
}
