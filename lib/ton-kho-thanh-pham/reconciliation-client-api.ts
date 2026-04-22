import type {
  LegacyReconciliationAssignmentBody,
  LegacyReconciliationAssignmentResult,
} from '@/lib/ton-kho-thanh-pham/reconciliation-types'

export async function submitLegacyReconciliationAssignments(input: {
  voucherId: string
  body: LegacyReconciliationAssignmentBody
}): Promise<LegacyReconciliationAssignmentResult> {
  const response = await fetch(`/api/ton-kho/thanh-pham/doi-soat-legacy/${input.voucherId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input.body),
  })

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: LegacyReconciliationAssignmentResult; error?: string }
    | null

  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error || 'Không đối soát được serial legacy')
  }

  return payload.data
}
