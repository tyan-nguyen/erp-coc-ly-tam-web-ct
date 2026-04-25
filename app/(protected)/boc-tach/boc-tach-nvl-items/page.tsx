import { CrudTablePage } from '@/components/master-data/crud-table-page'
import { getCrudTableConfig } from '@/lib/master-data/table-config'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function BocTachNvlItemsPage(props: { searchParams: SearchParams }) {
  const config = getCrudTableConfig('boc_tach_nvl_items')
  if (!config) {
    throw new Error('Missing table config: boc_tach_nvl_items')
  }

  return <CrudTablePage config={config} searchParams={await props.searchParams} />
}
