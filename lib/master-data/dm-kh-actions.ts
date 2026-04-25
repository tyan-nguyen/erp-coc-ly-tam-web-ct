'use server'

import { redirect } from 'next/navigation'
import { getAuthenticatedClientAndUser, getCurrentSessionProfile } from '@/lib/auth/session'
import type { RowData } from '@/lib/master-data/crud-utils'
import { pickKeyField, safeStringify } from '@/lib/master-data/crud-utils'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'
import {
  getDmKhAvailableFields,
  pickContactField,
  rowMatchesContact,
} from '@/lib/master-data/dm-kh'

const BASE_PATH = '/master-data/dm-kh'

function redirectWithError(message: string, extraParams?: URLSearchParams) {
  const params = extraParams ?? new URLSearchParams()
  params.set('err', message)
  redirect(`${BASE_PATH}?${params.toString()}`)
}

function redirectWithMessage(message: string) {
  redirect(`${BASE_PATH}?msg=${encodeURIComponent(message)}`)
}

function collectOptionalField(
  payload: Record<string, unknown>,
  availableFields: Set<string>,
  fieldName: string,
  formData: FormData
) {
  if (!availableFields.has(fieldName)) return
  const value = String(formData.get(fieldName) ?? '').trim()
  payload[fieldName] = value || null
}

function assignContactValues(
  payload: Record<string, unknown>,
  availableFields: Set<string>,
  availableContactFields: string[],
  contact: string,
  explicitEmail: string
) {
  const trimmedContact = contact.trim()
  const trimmedEmail = explicitEmail.trim()

  if (availableFields.has('email')) {
    payload.email =
      trimmedEmail || (trimmedContact.includes('@') ? trimmedContact : '') || null
  }

  const nonEmailFields = availableContactFields.filter((field) => field !== 'email')
  for (const field of nonEmailFields) {
    payload[field] = null
  }

  if (!trimmedContact || trimmedContact.includes('@')) {
    return
  }

  const contactField = pickContactField(trimmedContact, nonEmailFields)
  if (contactField) {
    payload[contactField] = trimmedContact
  }
}

async function loadRows() {
  const { supabase } = await getAuthenticatedClientAndUser()
  const { data, error } = await supabase.from('dm_kh').select('*').limit(200)
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []) as RowData[]
}

export async function createDmKhAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_kh')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const rows = await loadRows()
  const { columns, contactFields } = getDmKhAvailableFields(rows)
  const availableFields = new Set(columns)
  const contact = String(formData.get('contact') ?? '').trim()
  const explicitEmail = String(formData.get('email') ?? '').trim()
  const tenKh = String(formData.get('ten_kh') ?? '').trim()
  const nhomKh = String(formData.get('nhom_kh') ?? '').trim()

  const params = new URLSearchParams()
  if (contact) params.set('contact', contact)

  if (!contact) {
    redirectWithError('Cần nhập liên hệ để kiểm tra trùng.', params)
  }

  if (!tenKh) {
    redirectWithError('Cần nhập thông tin khách hàng.', params)
  }

  if (!nhomKh) {
    redirectWithError('Cần chọn nhóm khách hàng.', params)
  }

  const duplicate = rows.find((row) => row.is_active !== false && rowMatchesContact(row, contact))
  if (duplicate) {
    redirectWithError('Liên hệ này đã tồn tại trong danh mục khách hàng.', params)
  }

  const payload: Record<string, unknown> = {
    ten_kh: tenKh,
    nhom_kh: nhomKh,
    is_active: true,
    deleted_at: null,
    created_by: user.id,
  }

  collectOptionalField(payload, availableFields, 'mst', formData)
  collectOptionalField(payload, availableFields, 'dia_chi', formData)
  collectOptionalField(payload, availableFields, 'ghi_chu', formData)

  assignContactValues(payload, availableFields, contactFields, contact, explicitEmail)

  let { error } = await supabase.from('dm_kh').insert(payload)
  if (error && error.message.includes(`'created_by'`)) {
    const retry = await supabase.from('dm_kh').insert(
      Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'created_by'))
    )
    error = retry.error
  }

  if (error) {
    redirectWithError(error.message, params)
  }

  redirectWithMessage('Tạo khách hàng thành công')
}

export async function updateDmKhAction(formData: FormData) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'dm_kh')
  const { supabase, user } = await getAuthenticatedClientAndUser()
  const rows = await loadRows()
  const { columns, contactFields } = getDmKhAvailableFields(rows)
  const availableFields = new Set(columns)
  const keyField = pickKeyField('dm_kh', rows)
  const keyValueRaw = String(formData.get('key_value') ?? 'null')
  const contact = String(formData.get('contact') ?? '').trim()
  const explicitEmail = String(formData.get('email') ?? '').trim()
  const tenKh = String(formData.get('ten_kh') ?? '').trim()
  const nhomKh = String(formData.get('nhom_kh') ?? '').trim()

  if (!keyField) {
    redirectWithError('Không xác định được khóa khách hàng.')
  }
  const resolvedKeyField = keyField as string

  let keyValue: unknown
  try {
    keyValue = JSON.parse(keyValueRaw) as unknown
  } catch {
    redirectWithError('Khóa khách hàng không hợp lệ.')
  }

  if (!tenKh) {
    redirectWithError('Cần nhập thông tin khách hàng.')
  }

  if (!nhomKh) {
    redirectWithError('Cần chọn nhóm khách hàng.')
  }

  const currentRow = rows.find(
    (row) => safeStringify(row[resolvedKeyField]) === safeStringify(keyValue)
  )
  if (!currentRow) {
    redirectWithError('Không tìm thấy khách hàng cần sửa.')
  }

  if (contact) {
    const duplicate = rows.find(
      (row) =>
        row.is_active !== false &&
        safeStringify(row[resolvedKeyField]) !== safeStringify(keyValue) &&
        rowMatchesContact(row, contact)
    )

    if (duplicate) {
      redirectWithError('Liên hệ này đã thuộc về khách hàng khác.')
    }
  }

  const payload: Record<string, unknown> = {
    ten_kh: tenKh,
    nhom_kh: nhomKh,
    updated_by: user.id,
  }

  collectOptionalField(payload, availableFields, 'mst', formData)
  collectOptionalField(payload, availableFields, 'dia_chi', formData)
  collectOptionalField(payload, availableFields, 'ghi_chu', formData)

  assignContactValues(payload, availableFields, contactFields, contact, explicitEmail)

  let { error } = await supabase.from('dm_kh').update(payload).eq(resolvedKeyField, keyValue)
  if (error && error.message.includes(`'updated_by'`)) {
    const retry = await supabase
      .from('dm_kh')
      .update(Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'updated_by')))
      .eq(resolvedKeyField, keyValue)
    error = retry.error
  }

  if (error) {
    redirectWithError(error.message)
  }

  redirectWithMessage('Cập nhật khách hàng thành công')
}
