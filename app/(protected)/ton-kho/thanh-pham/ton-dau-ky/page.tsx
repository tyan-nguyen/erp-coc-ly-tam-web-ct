import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function FinishedGoodsOpeningBalancePage() {
  redirect('/ton-kho/thanh-pham/kiem-ke?count_type=TON_DAU_KY')
}
