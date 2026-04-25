export type PaginationState = {
  page: number
  pageSize: number
  totalCount: number
  pageCount: number
}

export function buildPagination(page: number, pageSize: number, totalCount: number): PaginationState {
  const safePageSize = Math.max(1, Math.trunc(pageSize || 1))
  const safeTotalCount = Math.max(0, Math.trunc(totalCount || 0))
  const pageCount = Math.max(1, Math.ceil(safeTotalCount / safePageSize))
  const safePage = Math.min(Math.max(1, Math.trunc(page || 1)), pageCount)

  return {
    page: safePage,
    pageSize: safePageSize,
    totalCount: safeTotalCount,
    pageCount,
  }
}

export function slicePage<T>(rows: T[], pagination: Pick<PaginationState, 'page' | 'pageSize'>) {
  const start = (pagination.page - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return rows.slice(start, end)
}
