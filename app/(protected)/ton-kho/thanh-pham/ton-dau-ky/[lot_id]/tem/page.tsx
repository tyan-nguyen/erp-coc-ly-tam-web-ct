import { redirect } from 'next/navigation'

type Params = Promise<{ lot_id: string }>
type SearchParams = Promise<{ autoPrint?: string }>

export default async function OpeningBalanceSerialPrintPage(props: { params: Params; searchParams: SearchParams }) {
  const params = await props.params
  const searchParams = await props.searchParams
  const lotId = String(params.lot_id || '').trim()
  if (!lotId) {
    redirect('/ton-kho/thanh-pham/ton-dau-ky')
  }
  const nextParams = new URLSearchParams()
  nextParams.set('lot_ids', lotId)
  if (String(searchParams.autoPrint || '').trim() === '1') {
    nextParams.set('autoPrint', '1')
  }
  redirect(`/ton-kho/thanh-pham/kiem-ke/in-tem?${nextParams.toString()}`)
}
