import { CrudTablePage } from '@/components/master-data/crud-table-page'
import { getCurrentSessionProfile } from '@/lib/auth/session'
import { assertMasterDataAccess } from '@/lib/master-data/permissions'
import { getCrudTableConfig } from '@/lib/master-data/table-config'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function GiaNvlPage(props: { searchParams: SearchParams }) {
  const { profile } = await getCurrentSessionProfile()
  assertMasterDataAccess(profile.role, 'gia_nvl')
  const config = getCrudTableConfig('gia_nvl')
  if (!config) {
    throw new Error('Missing table config: gia_nvl')
  }

  return <CrudTablePage config={config} searchParams={await props.searchParams} />
}
