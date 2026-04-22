'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import type { RowData } from '@/lib/master-data/crud-utils'
import { pickKeyField } from '@/lib/master-data/crud-utils'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'

const BASE_PATH = '/master-data/dm-duan'
const ADDRESS_NOTE_PREFIX = '[VI_TRI_CONG_TRINH]:'
const AREA_NOTE_PREFIX = '[KHU_VUC]:'

function redirectWithError(message: string) {
  redirect(`${BASE_PATH}?err=${encodeURIComponent(message)}`)
}

function redirectWithMessage(message: string) {
  redirect(`${BASE_PATH}?msg=${encodeURIComponent(message)}`)
}

async function loadRows() {
  const { supabase } = await getAuthenticatedClientAndUser()
  const { data, error } = await supabase.from('dm_duan').select('*').limit(200)
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as RowData[]
}

function collectOptionalField(
  payload: Record<string, unknown>,
  fieldName: string,
  formData: FormData
) {
  if (!fieldName) return
  const value = String(formData.get(fieldName) ?? '').trim()
  payload[fieldName] = value || null
}

function readTrimmed(formData: FormData, fieldName: string) {
  return String(formData.get(fieldName) ?? '').trim()
}

function stripAreaMeta(note: string) {
  return note
    .split('\n')
    .filter(
      (line) =>
        !line.trim().startsWith(AREA_NOTE_PREFIX) &&
        !line.trim().startsWith(ADDRESS_NOTE_PREFIX)
    )
    .join('\n')
    .trim()
}

function mergeNoteWithMeta(note: string, address: string, area: string) {
  const cleanNote = stripAreaMeta(note)
  const parts = [
    cleanNote,
    address ? `${ADDRESS_NOTE_PREFIX} ${address}` : '',
    area ? `${AREA_NOTE_PREFIX} ${area}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

export async function createDmDuanAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_duan')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const tenDa = String(formData.get('ten_da') ?? '').trim()
  const khId = String(formData.get('kh_id') ?? '').trim()
  const addressField = String(formData.get('address_field') ?? '').trim()
  const addressStorageMode = String(formData.get('address_storage_mode') ?? 'column').trim()
  const areaField = String(formData.get('area_field') ?? '').trim()
  const areaStorageMode = String(formData.get('area_storage_mode') ?? 'column').trim()
  const noteField = String(formData.get('note_field') ?? '').trim()
  const addressValue = readTrimmed(formData, addressField)
  const areaValue = readTrimmed(formData, areaField)
  const noteValue = readTrimmed(formData, noteField)

  if (!tenDa) redirectWithError('Cần nhập tên dự án.')
  if (!khId) redirectWithError('Cần chọn khách hàng.')
  if (!areaValue) redirectWithError('Cần chọn khu vực.')

  const payload: Record<string, unknown> = {
    ten_da: tenDa,
    kh_id: khId,
    is_active: true,
    deleted_at: null,
    created_by: user.id,
  }

  if (addressStorageMode === 'column') {
    collectOptionalField(payload, addressField, formData)
  }
  if (areaStorageMode === 'column') {
    payload[areaField] = areaValue
  }
  if (noteField) {
    if (addressStorageMode === 'note' || areaStorageMode === 'note') {
      payload[noteField] = mergeNoteWithMeta(
        noteValue,
        addressStorageMode === 'note' ? addressValue : '',
        areaStorageMode === 'note' ? areaValue : ''
      )
    } else {
      collectOptionalField(payload, noteField, formData)
    }
  }

  let { error } = await supabase.from('dm_duan').insert(payload)
  if (error && error.message.includes(`'created_by'`)) {
    const retry = await supabase.from('dm_duan').insert(
      Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'created_by'))
    )
    error = retry.error
  }

  if (error) {
    redirectWithError(error.message)
  }

  redirectWithMessage('Tạo dự án thành công')
}

export async function updateDmDuanAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_duan')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const rows = await loadRows()
  const keyField = pickKeyField('dm_duan', rows)
  const keyValueRaw = String(formData.get('key_value') ?? 'null')
  const tenDa = String(formData.get('ten_da') ?? '').trim()
  const khId = String(formData.get('kh_id') ?? '').trim()
  const addressField = String(formData.get('address_field') ?? '').trim()
  const addressStorageMode = String(formData.get('address_storage_mode') ?? 'column').trim()
  const areaField = String(formData.get('area_field') ?? '').trim()
  const areaStorageMode = String(formData.get('area_storage_mode') ?? 'column').trim()
  const noteField = String(formData.get('note_field') ?? '').trim()
  const addressValue = readTrimmed(formData, addressField)
  const areaValue = readTrimmed(formData, areaField)
  const noteValue = readTrimmed(formData, noteField)

  if (!keyField) redirectWithError('Không xác định được khóa dự án.')

  let keyValue: unknown
  try {
    keyValue = JSON.parse(keyValueRaw) as unknown
  } catch {
    redirectWithError('Khóa dự án không hợp lệ.')
  }

  if (!tenDa) redirectWithError('Cần nhập tên dự án.')
  if (!khId) redirectWithError('Cần chọn khách hàng.')
  if (!areaValue) redirectWithError('Cần chọn khu vực.')

  const payload: Record<string, unknown> = {
    ten_da: tenDa,
    kh_id: khId,
    updated_by: user.id,
  }

  if (addressStorageMode === 'column') {
    collectOptionalField(payload, addressField, formData)
  }
  if (areaStorageMode === 'column') {
    payload[areaField] = areaValue
  }
  if (noteField) {
    if (addressStorageMode === 'note' || areaStorageMode === 'note') {
      payload[noteField] = mergeNoteWithMeta(
        noteValue,
        addressStorageMode === 'note' ? addressValue : '',
        areaStorageMode === 'note' ? areaValue : ''
      )
    } else {
      collectOptionalField(payload, noteField, formData)
    }
  }

  const resolvedKeyField = keyField as string
  let { error } = await supabase.from('dm_duan').update(payload).eq(resolvedKeyField, keyValue)
  if (error && error.message.includes(`'updated_by'`)) {
    const retry = await supabase
      .from('dm_duan')
      .update(Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'updated_by')))
      .eq(resolvedKeyField, keyValue)
    error = retry.error
  }

  if (error) {
    redirectWithError(error.message)
  }

  redirectWithMessage('Cập nhật dự án thành công')
}
