'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import type { RowData } from '@/lib/master-data/crud-utils'
import { pickKeyField } from '@/lib/master-data/crud-utils'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'

const BASE_PATH = '/master-data/dm-ncc'

function redirectWithError(message: string) {
  redirect(`${BASE_PATH}?err=${encodeURIComponent(message)}`)
}

function redirectWithMessage(message: string) {
  redirect(`${BASE_PATH}?msg=${encodeURIComponent(message)}`)
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

async function loadRows() {
  const { supabase } = await getAuthenticatedClientAndUser()
  const { data, error } = await supabase.from('dm_ncc').select('*').limit(200)
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as RowData[]
}

export async function createDmNccAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_ncc')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const tenNcc = String(formData.get('ten_ncc') ?? '').trim()
  const loaiNcc = String(formData.get('loai_ncc') ?? '').trim()
  const contactField = String(formData.get('contact_field') ?? '').trim()
  const emailField = String(formData.get('email_field') ?? '').trim()
  const contactNameField = String(formData.get('contact_name_field') ?? '').trim()
  const addressField = String(formData.get('address_field') ?? '').trim()
  const noteField = String(formData.get('note_field') ?? '').trim()

  if (!tenNcc) redirectWithError('Cần nhập tên nhà cung cấp.')
  if (!loaiNcc) redirectWithError('Cần chọn loại nhà cung cấp.')

  const payload: Record<string, unknown> = {
    ten_ncc: tenNcc,
    loai_ncc: loaiNcc,
    is_active: true,
    deleted_at: null,
    created_by: user.id,
  }

  collectOptionalField(payload, contactField, formData)
  collectOptionalField(payload, emailField, formData)
  collectOptionalField(payload, contactNameField, formData)
  collectOptionalField(payload, addressField, formData)
  collectOptionalField(payload, noteField, formData)

  let { error } = await supabase.from('dm_ncc').insert(payload)
  if (error && error.message.includes(`'created_by'`)) {
    const retry = await supabase.from('dm_ncc').insert(
      Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'created_by'))
    )
    error = retry.error
  }

  if (error) redirectWithError(error.message)
  redirectWithMessage('Tạo nhà cung cấp thành công')
}

export async function updateDmNccAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_ncc')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const rows = await loadRows()
  const keyField = pickKeyField('dm_ncc', rows)
  const keyValueRaw = String(formData.get('key_value') ?? 'null')
  const tenNcc = String(formData.get('ten_ncc') ?? '').trim()
  const loaiNcc = String(formData.get('loai_ncc') ?? '').trim()
  const contactField = String(formData.get('contact_field') ?? '').trim()
  const emailField = String(formData.get('email_field') ?? '').trim()
  const contactNameField = String(formData.get('contact_name_field') ?? '').trim()
  const addressField = String(formData.get('address_field') ?? '').trim()
  const noteField = String(formData.get('note_field') ?? '').trim()

  if (!keyField) redirectWithError('Không xác định được khóa nhà cung cấp.')

  let keyValue: unknown
  try {
    keyValue = JSON.parse(keyValueRaw) as unknown
  } catch {
    redirectWithError('Khóa nhà cung cấp không hợp lệ.')
  }

  if (!tenNcc) redirectWithError('Cần nhập tên nhà cung cấp.')
  if (!loaiNcc) redirectWithError('Cần chọn loại nhà cung cấp.')

  const payload: Record<string, unknown> = {
    ten_ncc: tenNcc,
    loai_ncc: loaiNcc,
    updated_by: user.id,
  }

  collectOptionalField(payload, contactField, formData)
  collectOptionalField(payload, emailField, formData)
  collectOptionalField(payload, contactNameField, formData)
  collectOptionalField(payload, addressField, formData)
  collectOptionalField(payload, noteField, formData)

  const resolvedKeyField = keyField as string
  let { error } = await supabase.from('dm_ncc').update(payload).eq(resolvedKeyField, keyValue)
  if (error && error.message.includes(`'updated_by'`)) {
    const retry = await supabase
      .from('dm_ncc')
      .update(Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'updated_by')))
      .eq(resolvedKeyField, keyValue)
    error = retry.error
  }

  if (error) redirectWithError(error.message)
  redirectWithMessage('Cập nhật nhà cung cấp thành công')
}
