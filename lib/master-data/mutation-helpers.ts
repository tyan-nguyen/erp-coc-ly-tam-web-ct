type SupabaseLike = {
  from: (tableName: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    update: (payload: Record<string, unknown>) => {
      eq: (keyField: string, keyValue: unknown) => Promise<{ error: { message: string } | null }>
    }
  }
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
}

export function parseUnknownColumn(message: string) {
  const relationMatch = message.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation .* does not exist/i)
  if (relationMatch?.[1]) return relationMatch[1]
  const schemaCacheMatch = message.match(
    /Could not find the ['"]([a-zA-Z0-9_]+)['"] column of ['"][a-zA-Z0-9_]+['"] in the schema cache/i
  )
  return schemaCacheMatch?.[1] ?? ''
}

export async function updateRowWithFallback(
  supabase: SupabaseLike,
  tableName: string,
  keyField: string,
  keyValue: unknown,
  payload: Record<string, unknown>
) {
  const working = { ...payload }

  while (true) {
    const attempt = await supabase.from(tableName).update(working).eq(keyField, keyValue)
    if (!attempt.error) return attempt

    if (attempt.error.message.includes(`'updated_by'`)) {
      delete working.updated_by
      continue
    }

    const missingColumn = parseUnknownColumn(attempt.error.message)
    if (missingColumn && missingColumn in working) {
      delete working[missingColumn]
      continue
    }

    return attempt
  }
}

export async function insertRowWithFallback(
  supabase: SupabaseLike,
  tableName: string,
  payload: Record<string, unknown>
) {
  const working = { ...payload }

  while (true) {
    const resolved = await supabase.from(tableName).insert(working)
    if (!resolved.error) return resolved

    if (resolved.error.message.includes(`'created_by'`)) {
      delete working.created_by
      continue
    }

    const missingColumn = parseUnknownColumn(resolved.error.message)
    if (missingColumn && missingColumn in working) {
      delete working[missingColumn]
      continue
    }

    return resolved
  }
}

export async function softDeleteRowWithFallback(
  supabase: SupabaseLike,
  {
    tableName,
    keyField,
    keyValue,
    userId,
    isActiveField = 'is_active',
    deletedAtField = 'deleted_at',
  }: {
    tableName: string
    keyField: string
    keyValue: unknown
    userId: string
    isActiveField?: string
    deletedAtField?: string | null
  }
) {
  const timestamp = new Date().toISOString()
  const payload: Record<string, unknown> = {
    [isActiveField]: false,
    updated_by: userId,
  }
  if (deletedAtField) {
    payload[deletedAtField] = timestamp
  }

  let attempt = await updateRowWithFallback(supabase, tableName, keyField, keyValue, payload)
  if (
    attempt.error &&
    deletedAtField &&
    attempt.error.message.includes(`'${deletedAtField}'`)
  ) {
    attempt = await updateRowWithFallback(supabase, tableName, keyField, keyValue, {
      [isActiveField]: false,
      updated_by: userId,
    })
  }

  if (
    attempt.error &&
    attempt.error.message.toLowerCase().includes('row-level security policy')
  ) {
    const rpcAttempt = await supabase.rpc('soft_delete_master_data', {
      p_table_name: tableName,
      p_key_field: keyField,
      p_key_value: String(keyValue),
      p_user_id: userId,
      p_is_active_field: isActiveField,
      p_deleted_at_field: deletedAtField,
    })
    attempt = { error: rpcAttempt.error }
  }

  return attempt
}
