import type { RowData } from '@/lib/master-data/crud-utils'

type SoftDeleteConfig = {
  isActiveField: string
  deletedAtField: string | null
}

export type CrudTableConfig = {
  tableName: string
  basePath: string
  title: string
  description: string
  createTemplate: RowData
  requiredCreateFields?: string[]
  enumFieldValues?: Record<string, string[]>
  softDelete?: SoftDeleteConfig | null
}

export const CRUD_TABLE_CONFIGS: CrudTableConfig[] = [
  {
    tableName: 'dm_kh',
    basePath: '/master-data/dm-kh',
    title: 'Master Data: dm_kh',
    description: 'CRUD tren `public.dm_kh`.',
    createTemplate: {
      ten_kh: '',
      nhom_kh: 'TIEM_NANG',
      is_active: true,
      deleted_at: null,
    },
    requiredCreateFields: ['ten_kh', 'nhom_kh'],
    enumFieldValues: {
      nhom_kh: ['TIEM_NANG', 'VANG_LAI'],
    },
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'dm_duan',
    basePath: '/master-data/dm-duan',
    title: 'Master Data: dm_duan',
    description: 'CRUD tren `public.dm_duan`.',
    createTemplate: {
      ten_da: '',
      kh_id: '',
      is_active: true,
      deleted_at: null,
    },
    requiredCreateFields: ['ten_da', 'kh_id'],
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'dm_ncc',
    basePath: '/master-data/dm-ncc',
    title: 'Master Data: dm_ncc',
    description: 'CRUD tren `public.dm_ncc`.',
    createTemplate: {
      ten_ncc: '',
      loai_ncc: 'PHU_KIEN',
      is_active: true,
      deleted_at: null,
    },
    requiredCreateFields: ['ten_ncc', 'loai_ncc'],
    enumFieldValues: {
      loai_ncc: ['PHU_KIEN'],
    },
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'warehouse_location',
    basePath: '/master-data/khu-vuc-ton',
    title: 'Master Data: warehouse_location',
    description: 'CRUD tren `public.warehouse_location`.',
    createTemplate: {
      location_code: '',
      location_name: '',
      location_type: 'STORAGE',
      parent_location_id: null,
      is_active: true,
    },
    requiredCreateFields: ['location_code', 'location_type'],
    enumFieldValues: {
      location_type: ['STORAGE', 'STAGING', 'DEFECT'],
    },
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: null,
    },
  },
  {
    tableName: 'nvl',
    basePath: '/master-data/nvl',
    title: 'Master Data: nvl',
    description: 'CRUD tren `public.nvl`.',
    createTemplate: {
      ten_hang: '',
      dvt: 'kg',
      nhom_hang: 'THEP',
      hao_hut_pct: 0,
      is_active: true,
      deleted_at: null,
    },
    requiredCreateFields: ['ten_hang', 'dvt', 'nhom_hang'],
    enumFieldValues: {
      nhom_hang: ['THEP', 'NVL', 'VAT_TU_PHU', 'PHU_KIEN', 'TAI_SAN', 'CONG_CU_DUNG_CU'],
    },
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'gia_nvl',
    basePath: '/master-data/gia-nvl',
    title: 'Master Data: gia_nvl',
    description: 'CRUD tren `public.gia_nvl`.',
    createTemplate: {
      nvl_id: '',
      don_gia: 0,
      dvt: 'kg',
    },
    requiredCreateFields: ['nvl_id', 'don_gia', 'dvt'],
    softDelete: null,
  },
  {
    tableName: 'dm_coc_template',
    basePath: '/master-data/dm-coc-template',
    title: 'Master Data: dm_coc_template',
    description: 'CRUD tren `public.dm_coc_template`.',
    createTemplate: {
      loai_coc: '',
      mac_be_tong: 'B40',
      do_ngoai: 600,
      chieu_day: 100,
      is_active: true,
      deleted_at: null,
    },
    requiredCreateFields: ['loai_coc', 'mac_be_tong', 'do_ngoai', 'chieu_day'],
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'dm_dinh_muc_phu_md',
    basePath: '/master-data/dm-dinh-muc-phu-md',
    title: 'Master Data: dm_dinh_muc_phu_md',
    description: 'CRUD tren `public.dm_dinh_muc_phu_md`.',
    createTemplate: {
      nvl_id: '',
      nhom_d: '',
      dvt: 'kg',
      dinh_muc: 0,
      is_active: true,
      deleted_at: null,
    },
    requiredCreateFields: ['nvl_id', 'nhom_d', 'dvt', 'dinh_muc'],
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'dm_capphoi_bt',
    basePath: '/master-data/dm-capphoi-bt',
    title: 'Master Data: dm_capphoi_bt',
    description: 'CRUD tren `public.dm_capphoi_bt`.',
    createTemplate: {
      nvl_id: '',
      mac_be_tong: '',
      dinh_muc_m3: 0,
      dvt: 'kg',
      ghi_chu: null,
      is_active: true,
      deleted_at: null,
    },
    requiredCreateFields: ['nvl_id', 'mac_be_tong', 'dinh_muc_m3', 'dvt'],
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'boc_tach_nvl',
    basePath: '/boc-tach/boc-tach-nvl',
    title: 'Module: boc_tach_nvl',
    description: 'CRUD khoi dau tren `public.boc_tach_nvl`.',
    createTemplate: { ghi_chu: '' },
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'boc_tach_nvl_items',
    basePath: '/boc-tach/boc-tach-nvl-items',
    title: 'Module: boc_tach_nvl_items',
    description: 'CRUD khoi dau tren `public.boc_tach_nvl_items`.',
    createTemplate: { ghi_chu: '' },
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
  {
    tableName: 'boc_tach_seg_nvl',
    basePath: '/boc-tach/boc-tach-seg-nvl',
    title: 'Module: boc_tach_seg_nvl',
    description: 'CRUD khoi dau tren `public.boc_tach_seg_nvl`.',
    createTemplate: { ghi_chu: '' },
    softDelete: {
      isActiveField: 'is_active',
      deletedAtField: 'deleted_at',
    },
  },
]

const CRUD_TABLE_CONFIG_MAP = new Map(
  CRUD_TABLE_CONFIGS.map((config) => [config.tableName, config])
)

export function getCrudTableConfig(tableName: string): CrudTableConfig | null {
  return CRUD_TABLE_CONFIG_MAP.get(tableName) ?? null
}

export function isAllowedCrudTable(tableName: string): boolean {
  return CRUD_TABLE_CONFIG_MAP.has(tableName)
}
