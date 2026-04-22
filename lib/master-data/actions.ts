'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import { parsePayload } from '@/lib/master-data/crud-utils'
import { assertMasterDataAccess, getMasterDataPermissionKeyForTable } from '@/lib/master-data/permissions'
import { getCrudTableConfig, isAllowedCrudTable } from '@/lib/master-data/table-config'

const FALLBACK_REDIRECT = '/dashboard'

function resolveActionContext(formData: FormData) {
  const tableName = String(formData.get('table_name') ?? '')
  const basePath = String(formData.get('base_path') ?? '')
  const config = getCrudTableConfig(tableName)
  const safeBasePath = config?.basePath ?? FALLBACK_REDIRECT

  if (!isAllowedCrudTable(tableName) || !config || config.basePath !== basePath) {
    redirect(`${safeBasePath}?err=${encodeURIComponent('Bang khong duoc phep thao tac')}`)
  }

  return { tableName, basePath, config }
}

function isMissingRequiredValue(value: unknown) {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  return false
}

function validatePayload(tableName: string, payload: Record<string, unknown>) {
  const config = getCrudTableConfig(tableName)
  if (!config) {
    throw new Error('Bang khong duoc phep thao tac')
  }

  for (const field of config.requiredCreateFields ?? []) {
    if (isMissingRequiredValue(payload[field])) {
      throw new Error(`Thieu field bat buoc: ${field}`)
    }
  }

  const enumRules = config.enumFieldValues ?? {}
  for (const [field, acceptedValues] of Object.entries(enumRules)) {
    if (!acceptedValues.length) continue
    const value = payload[field]
    if (isMissingRequiredValue(value)) continue
    if (!acceptedValues.includes(String(value))) {
      throw new Error(
        `Gia tri ${field} khong hop le. Cho phep: ${acceptedValues.join(', ')}`
      )
    }
  }
}

function sanitizeUpdatePayload(payload: Record<string, unknown>) {
  const sanitized = { ...payload }
  const readonlyFields = ['created_at', 'updated_at', 'created_by', 'updated_by']

  for (const key of Object.keys(sanitized)) {
    if (readonlyFields.includes(key) || key.endsWith('_label')) {
      delete sanitized[key]
    }
  }

  return sanitized
}

export async function createMasterDataAction(formData: FormData) {
  const { tableName, basePath } = resolveActionContext(formData)
  const permissionKey = getMasterDataPermissionKeyForTable(tableName)
  const { profile } = await getCurrentSessionProfile()
  if (permissionKey) assertMasterDataAccess(profile.role, permissionKey)
  const payloadInput = String(formData.get('payload') ?? '{}')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  let payload: Record<string, unknown>

  try {
    payload = parsePayload(payloadInput)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payload khong hop le'
    redirect(`${basePath}?err=${encodeURIComponent(message)}`)
  }
  try {
    validatePayload(tableName, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payload khong hop le'
    redirect(`${basePath}?err=${encodeURIComponent(message)}`)
  }

  const insertPayload = {
    ...payload,
    created_by: payload.created_by ?? user.id,
  }

  let { error } = await supabase.from(tableName).insert(insertPayload)
  if (error && error.message.includes(`'created_by'`)) {
    const retry = await supabase.from(tableName).insert(payload)
    error = retry.error
  }
  if (error) {
    redirect(`${basePath}?err=${encodeURIComponent(error.message)}`)
  }
  redirect(`${basePath}?msg=${encodeURIComponent('Tao moi thanh cong')}`)
}

export async function updateMasterDataAction(formData: FormData) {
  const { tableName, basePath } = resolveActionContext(formData)
  const permissionKey = getMasterDataPermissionKeyForTable(tableName)
  const { profile } = await getCurrentSessionProfile()
  if (permissionKey) assertMasterDataAccess(profile.role, permissionKey)
  const keyField = String(formData.get('key_field') ?? '')
  const keyValueRaw = String(formData.get('key_value') ?? 'null')
  const payloadInput = String(formData.get('payload') ?? '{}')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  let keyValue: unknown
  let payload: Record<string, unknown>

  if (!keyField) {
    redirect(`${basePath}?err=${encodeURIComponent('Thieu key field')}`)
  }

  try {
    keyValue = JSON.parse(keyValueRaw) as unknown
    payload = parsePayload(payloadInput)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payload khong hop le'
    redirect(`${basePath}?err=${encodeURIComponent(message)}`)
  }

  delete payload[keyField]
  payload = sanitizeUpdatePayload(payload)
  try {
    validatePayload(tableName, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payload khong hop le'
    redirect(`${basePath}?err=${encodeURIComponent(message)}`)
  }

  const updatePayload = {
    ...payload,
    updated_by: user.id,
  }

  let { error } = await supabase
    .from(tableName)
    .update(updatePayload)
    .eq(keyField, keyValue)

  if (error && error.message.includes(`'updated_by'`)) {
    const retry = await supabase
      .from(tableName)
      .update(payload)
      .eq(keyField, keyValue)
    error = retry.error
  }

  if (error) {
    redirect(`${basePath}?err=${encodeURIComponent(error.message)}`)
  }
  redirect(`${basePath}?msg=${encodeURIComponent('Cap nhat thanh cong')}`)
}

export async function softDeleteMasterDataAction(formData: FormData) {
  const { tableName, basePath, config } = resolveActionContext(formData)
  const permissionKey = getMasterDataPermissionKeyForTable(tableName)
  const { profile } = await getCurrentSessionProfile()
  if (permissionKey) assertMasterDataAccess(profile.role, permissionKey)
  const keyField = String(formData.get('key_field') ?? '')
  const keyValueRaw = String(formData.get('key_value') ?? 'null')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  let keyValue: unknown

  if (!keyField) {
    redirect(`${basePath}?err=${encodeURIComponent('Thieu key field')}`)
  }

  try {
    keyValue = JSON.parse(keyValueRaw) as unknown
  } catch {
    redirect(`${basePath}?err=${encodeURIComponent('Gia tri key khong hop le')}`)
  }

  const softDelete = config.softDelete
  if (softDelete === null) {
    redirect(`${basePath}?err=${encodeURIComponent('Bang nay khong ho tro xoa mem')}`)
  }
  const resolvedSoftDelete = softDelete ?? {
    isActiveField: 'is_active',
    deletedAtField: 'deleted_at',
  }

  if (!resolvedSoftDelete.isActiveField) {
    redirect(`${basePath}?err=${encodeURIComponent('Bang nay khong ho tro xoa mem')}`)
  }

  const updatePayload: Record<string, unknown> = {
    [resolvedSoftDelete.isActiveField]: false,
    updated_by: user.id,
  }
  if (resolvedSoftDelete.deletedAtField) {
    updatePayload[resolvedSoftDelete.deletedAtField] = new Date().toISOString()
  }

  let { error } = await supabase
    .from(tableName)
    .update(updatePayload)
    .eq(keyField, keyValue)

  if (
    error &&
    resolvedSoftDelete.deletedAtField &&
    error.message.includes(`'${resolvedSoftDelete.deletedAtField}'`)
  ) {
    const fallbackPayload: Record<string, unknown> = {
      [resolvedSoftDelete.isActiveField]: false,
      updated_by: user.id,
    }

    const retry = await supabase
      .from(tableName)
      .update(fallbackPayload)
      .eq(keyField, keyValue)
    error = retry.error
  }

  if (
    error &&
    error.message.toLowerCase().includes('row-level security policy')
  ) {
    const rpcArgs = {
      p_table_name: tableName,
      p_key_field: keyField,
      p_key_value: String(keyValue),
      p_user_id: user.id,
      p_is_active_field: resolvedSoftDelete.isActiveField,
      p_deleted_at_field: resolvedSoftDelete.deletedAtField,
    }

    const rpcAttempt = await supabase.rpc('soft_delete_master_data', rpcArgs)
    error = rpcAttempt.error
  }

  if (error && error.message.includes(`'updated_by'`)) {
    const retryPayload: Record<string, unknown> = {
      [resolvedSoftDelete.isActiveField]: false,
    }
    if (resolvedSoftDelete.deletedAtField) {
      retryPayload[resolvedSoftDelete.deletedAtField] = new Date().toISOString()
    }

    const retry = await supabase
      .from(tableName)
      .update(retryPayload)
      .eq(keyField, keyValue)
    error = retry.error
  }

  if (error) {
    redirect(`${basePath}?err=${encodeURIComponent(error.message)}`)
  }
  redirect(`${basePath}?msg=${encodeURIComponent('Xoa mem thanh cong')}`)
}

export async function bulkSoftDeleteMasterDataAction(formData: FormData) {
  const { tableName, basePath, config } = resolveActionContext(formData)
  const permissionKey = getMasterDataPermissionKeyForTable(tableName)
  const { profile } = await getCurrentSessionProfile()
  if (permissionKey) assertMasterDataAccess(profile.role, permissionKey)
  const keyField = String(formData.get('key_field') ?? '')
  const keyValueRawList = formData.getAll('key_value').map((value) => String(value ?? ''))
  const { supabase, user } = await getAuthenticatedClientAndUser()

  if (!keyField) {
    redirect(`${basePath}?err=${encodeURIComponent('Thieu key field')}`)
  }

  const resolvedSoftDelete = config.softDelete ?? {
    isActiveField: 'is_active',
    deletedAtField: 'deleted_at',
  }

  if (!resolvedSoftDelete?.isActiveField) {
    redirect(`${basePath}?err=${encodeURIComponent('Bang nay khong ho tro xoa mem')}`)
  }

  const parsedValues: unknown[] = []
  for (const raw of keyValueRawList) {
    if (!raw) continue
    try {
      parsedValues.push(JSON.parse(raw) as unknown)
    } catch {
      redirect(`${basePath}?err=${encodeURIComponent('Gia tri key khong hop le')}`)
    }
  }

  if (!parsedValues.length) {
    redirect(`${basePath}?err=${encodeURIComponent('Chua chon dong nao de xoa')}`)
  }

  let successCount = 0

  for (const keyValue of parsedValues) {
    const updatePayload: Record<string, unknown> = {
      [resolvedSoftDelete.isActiveField]: false,
      updated_by: user.id,
    }
    if (resolvedSoftDelete.deletedAtField) {
      updatePayload[resolvedSoftDelete.deletedAtField] = new Date().toISOString()
    }

    let { error } = await supabase.from(tableName).update(updatePayload).eq(keyField, keyValue)

    if (
      error &&
      resolvedSoftDelete.deletedAtField &&
      error.message.includes(`'${resolvedSoftDelete.deletedAtField}'`)
    ) {
      const fallbackPayload: Record<string, unknown> = {
        [resolvedSoftDelete.isActiveField]: false,
        updated_by: user.id,
      }

      const retry = await supabase.from(tableName).update(fallbackPayload).eq(keyField, keyValue)
      error = retry.error
    }

    if (error && error.message.toLowerCase().includes('row-level security policy')) {
      const rpcArgs = {
        p_table_name: tableName,
        p_key_field: keyField,
        p_key_value: String(keyValue),
        p_user_id: user.id,
        p_is_active_field: resolvedSoftDelete.isActiveField,
        p_deleted_at_field: resolvedSoftDelete.deletedAtField,
      }

      const rpcAttempt = await supabase.rpc('soft_delete_master_data', rpcArgs)
      error = rpcAttempt.error
    }

    if (error && error.message.includes(`'updated_by'`)) {
      const retryPayload: Record<string, unknown> = {
        [resolvedSoftDelete.isActiveField]: false,
      }
      if (resolvedSoftDelete.deletedAtField) {
        retryPayload[resolvedSoftDelete.deletedAtField] = new Date().toISOString()
      }

      const retry = await supabase.from(tableName).update(retryPayload).eq(keyField, keyValue)
      error = retry.error
    }

    if (error) {
      redirect(`${basePath}?err=${encodeURIComponent(error.message)}`)
    }

    successCount += 1
  }

  redirect(`${basePath}?msg=${encodeURIComponent(`Xoa mem thanh cong ${successCount} dong`)}`)
}
