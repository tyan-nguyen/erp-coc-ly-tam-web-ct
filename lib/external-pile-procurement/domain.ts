export const EXTERNAL_PILE_PROCUREMENT_DOMAIN = 'FINISHED_GOODS_EXTERNAL'

function toRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function isExternalPileProcurementPayload(payload: unknown) {
  const record = toRecord(payload)
  return String(record.inventoryDomain || '').trim().toUpperCase() === EXTERNAL_PILE_PROCUREMENT_DOMAIN
}

export function isNvlProcurementPayload(payload: unknown) {
  const record = toRecord(payload)
  const domain = String(record.inventoryDomain || '').trim().toUpperCase()
  return !domain || domain === 'NVL'
}
