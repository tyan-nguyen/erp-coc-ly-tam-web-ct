export type InventoryMovementType =
  | 'PRODUCTION_IN'
  | 'QC_ACCEPTED'
  | 'QC_RETAIL_ONLY'
  | 'QC_CANCELLED'
  | 'SHIPMENT_OUT'
  | 'RETURN_TO_PROJECT'
  | 'RETURN_TO_RETAIL'
  | 'RETURN_CANCELLED'
  | 'LEGACY_RECONCILIATION_OUT'
  | 'LEGACY_RECONCILIATION_IN'
  | 'LOCATION_TRANSFER'
  | 'MANUAL_ADJUSTMENT'

export type InventorySourceType =
  | 'PRODUCTION_PLAN'
  | 'QC_VOUCHER'
  | 'SHIPMENT_VOUCHER'
  | 'RETURN_VOUCHER'
  | 'LEGACY_RECONCILIATION'
  | 'WAREHOUSE_TRANSFER'
  | 'MANUAL_ADJUSTMENT'

export type InventoryPhysicalEffect = 'IN' | 'OUT' | 'NONE'
export type InventoryVisibilityEffect = 'ENABLE' | 'DISABLE' | 'NONE'
export type InventoryHoldEffect = 'ENABLE' | 'DISABLE' | 'NONE'

export type InventoryMovementEffect = {
  physicalEffect: InventoryPhysicalEffect
  projectVisibilityEffect: InventoryVisibilityEffect
  retailVisibilityEffect: InventoryVisibilityEffect
  holdEffect: InventoryHoldEffect
  lifecycleTarget?: string
}

export type InventoryMovementReference = {
  sourceType: InventorySourceType
  sourceId: string
  sourceLineId?: string | null
}

export type InventoryMovementContract = {
  movementType: InventoryMovementType
  effect: InventoryMovementEffect
  reference: InventoryMovementReference
}

export const INVENTORY_MOVEMENT_EFFECTS: Record<InventoryMovementType, InventoryMovementEffect> = {
  PRODUCTION_IN: {
    physicalEffect: 'IN',
    projectVisibilityEffect: 'ENABLE',
    retailVisibilityEffect: 'ENABLE',
    holdEffect: 'DISABLE',
    lifecycleTarget: 'TRONG_KHO',
  },
  QC_ACCEPTED: {
    physicalEffect: 'NONE',
    projectVisibilityEffect: 'ENABLE',
    retailVisibilityEffect: 'ENABLE',
    holdEffect: 'DISABLE',
    lifecycleTarget: 'TRONG_KHO',
  },
  QC_RETAIL_ONLY: {
    physicalEffect: 'NONE',
    projectVisibilityEffect: 'DISABLE',
    retailVisibilityEffect: 'ENABLE',
    holdEffect: 'DISABLE',
    lifecycleTarget: 'TRONG_KHO',
  },
  QC_CANCELLED: {
    physicalEffect: 'OUT',
    projectVisibilityEffect: 'DISABLE',
    retailVisibilityEffect: 'DISABLE',
    holdEffect: 'DISABLE',
    lifecycleTarget: 'HUY',
  },
  SHIPMENT_OUT: {
    physicalEffect: 'OUT',
    projectVisibilityEffect: 'DISABLE',
    retailVisibilityEffect: 'DISABLE',
    holdEffect: 'DISABLE',
    lifecycleTarget: 'DA_XUAT',
  },
  RETURN_TO_PROJECT: {
    physicalEffect: 'IN',
    projectVisibilityEffect: 'ENABLE',
    retailVisibilityEffect: 'ENABLE',
    holdEffect: 'DISABLE',
    lifecycleTarget: 'TRA_LAI_DA_NHAN',
  },
  RETURN_TO_RETAIL: {
    physicalEffect: 'IN',
    projectVisibilityEffect: 'DISABLE',
    retailVisibilityEffect: 'ENABLE',
    holdEffect: 'DISABLE',
    lifecycleTarget: 'TRA_LAI_DA_NHAN',
  },
  RETURN_CANCELLED: {
    physicalEffect: 'NONE',
    projectVisibilityEffect: 'DISABLE',
    retailVisibilityEffect: 'DISABLE',
    holdEffect: 'DISABLE',
    lifecycleTarget: 'HUY',
  },
  LEGACY_RECONCILIATION_OUT: {
    physicalEffect: 'OUT',
    projectVisibilityEffect: 'NONE',
    retailVisibilityEffect: 'NONE',
    holdEffect: 'NONE',
  },
  LEGACY_RECONCILIATION_IN: {
    physicalEffect: 'IN',
    projectVisibilityEffect: 'NONE',
    retailVisibilityEffect: 'NONE',
    holdEffect: 'NONE',
  },
  LOCATION_TRANSFER: {
    physicalEffect: 'NONE',
    projectVisibilityEffect: 'NONE',
    retailVisibilityEffect: 'NONE',
    holdEffect: 'NONE',
  },
  MANUAL_ADJUSTMENT: {
    physicalEffect: 'NONE',
    projectVisibilityEffect: 'NONE',
    retailVisibilityEffect: 'NONE',
    holdEffect: 'NONE',
  },
}
