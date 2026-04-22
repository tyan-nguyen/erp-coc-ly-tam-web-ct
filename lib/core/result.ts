export type AppResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: string
    }

export function okResult<T>(data: T): AppResult<T> {
  return { ok: true, data }
}

export function errorResult(error: string): AppResult<never> {
  return { ok: false, error }
}
