export type WarehouseLocationOption = {
  locationId: string
  locationCode: string
  locationName: string
  locationLabel: string
}

export type WarehouseLocationAssignmentPageData = {
  schemaReady: boolean
  locations: WarehouseLocationOption[]
}

export type WarehouseLocationAssignmentSkippedRow = {
  serialCode: string
  reason: string
}

export type WarehouseLocationAssignmentResult = {
  locationLabel: string
  assignedCount: number
  unchangedCount: number
  missingCodes: string[]
  skippedRows: WarehouseLocationAssignmentSkippedRow[]
}

export type WarehouseLocationTransferResult = {
  fromLocationLabel: string
  toLocationLabel: string
  transferredCount: number
  missingCodes: string[]
  skippedRows: WarehouseLocationAssignmentSkippedRow[]
}
