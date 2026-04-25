import type { SupabaseClient } from '@supabase/supabase-js'
import type { InventoryCountingPageData } from '@/lib/inventory-counting/types'
import { loadInventoryCountCatalogOptions, loadInventoryCountSheetSummaries } from '@/lib/inventory-counting/repository'

type AnySupabase = SupabaseClient

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(value || 0))
}

export async function loadInventoryCountingPageData(supabase: AnySupabase): Promise<InventoryCountingPageData> {
  const [sheetData, catalogOptions] = await Promise.all([
    loadInventoryCountSheetSummaries(supabase),
    loadInventoryCountCatalogOptions(supabase),
  ])

  const absoluteVarianceTotal = sheetData.rows.reduce((sum, row) => sum + Math.abs(Number(row.varianceQtyTotal || 0)), 0)

  return {
    schemaReady: sheetData.schemaReady,
    summaryCards: [
      {
        label: 'Phiếu gần đây',
        value: String(sheetData.rows.length),
        helpText: 'Số phiếu kiểm kê gần nhất đang đọc được từ DB.',
      },
      {
        label: 'Danh mục chọn nhanh',
        value: String(catalogOptions.length),
        helpText: 'Các NVL / CCDC / Tài sản đang có sẵn để đưa vào phiếu kiểm kê.',
      },
      {
        label: 'Tổng chênh lệch',
        value: formatNumber(absoluteVarianceTotal),
        helpText: 'Tổng giá trị tuyệt đối chênh lệch trên các phiếu gần đây để theo dõi nhanh mức biến động.',
      },
      {
        label: 'Schema kiểm kê',
        value: sheetData.schemaReady ? 'Sẵn sàng' : 'Chưa sẵn sàng',
        helpText: sheetData.schemaReady
          ? 'Có thể tạo phiếu kiểm kê và lưu DB thật.'
          : 'Cần chạy inventory_counting_setup.sql trước khi lưu phiếu kiểm kê.',
      },
    ],
    catalogOptions,
    savedSheets: sheetData.rows,
  }
}
