import { createClient } from '@supabase/supabase-js'
import { loadFinishedGoodsInventoryPageData } from '@/lib/ton-kho-thanh-pham/repository'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase env')
  }

  const supabase = createClient(url, key)
  const itemKey = 'PHC - A400 - 65::THAN::3'
  const data = await loadFinishedGoodsInventoryPageData(supabase, {
    scope: 'PROJECT',
  })

  console.log(
    JSON.stringify(
      {
        filters: data.filters,
        summaryRows: data.summaryRows
          .filter((row) => row.loaiCoc.includes('PHC - A400 - 65'))
          .map((row) => ({
            itemKey: row.itemKey,
            itemLabel: row.itemLabel,
            physicalQty: row.physicalQty,
            projectQty: row.projectQty,
            retailQty: row.retailQty,
            holdQty: row.holdQty,
          })),
        selectedItemDetail: data.selectedItemDetail
          ? {
              itemKey: data.selectedItemDetail.itemKey,
              physicalQty: data.selectedItemDetail.physicalQty,
              projectQty: data.selectedItemDetail.projectQty,
              retailQty: data.selectedItemDetail.retailQty,
              holdQty: data.selectedItemDetail.holdQty,
              totalSerialCount: data.selectedItemDetail.totalSerialCount,
              serialCodes: data.selectedItemDetail.serialRows.map((row) => row.serialCode),
              visibility: data.selectedItemDetail.serialRows.map((row) => row.visibilityLabel),
            }
          : null,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
