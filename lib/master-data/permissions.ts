import { redirect } from 'next/navigation'
import {
  isAdminRole,
  isPurchaseRole,
  isSalesAccountingRole,
  isTechnicalRole,
  isWarehouseRole,
} from '@/lib/auth/roles'

export type MasterDataPermissionKey =
  | 'dm_kh'
  | 'dm_duan'
  | 'dm_ncc'
  | 'dm_khu_vuc_ton'
  | 'nvl'
  | 'gia_nvl'
  | 'dm_coc_template'
  | 'dm_dinh_muc_phu_md'
  | 'dm_capphoi_bt'
  | 'dm_thue_loi_nhuan'
  | 'dm_chi_phi_khac'

const MASTER_DATA_ROLE_RULES: Record<MasterDataPermissionKey, (role: string | null | undefined) => boolean> = {
  dm_kh: (role) => isAdminRole(role) || isSalesAccountingRole(role) || isTechnicalRole(role),
  dm_duan: (role) => isAdminRole(role) || isSalesAccountingRole(role) || isTechnicalRole(role),
  dm_ncc: (role) => isAdminRole(role) || isPurchaseRole(role),
  dm_khu_vuc_ton: (role) => isAdminRole(role) || isWarehouseRole(role),
  nvl: (role) => isAdminRole(role) || isPurchaseRole(role) || isTechnicalRole(role),
  gia_nvl: (role) => isAdminRole(role) || isPurchaseRole(role) || isTechnicalRole(role),
  dm_coc_template: (role) => isAdminRole(role) || isTechnicalRole(role),
  dm_dinh_muc_phu_md: (role) => isAdminRole(role) || isTechnicalRole(role),
  dm_capphoi_bt: (role) => isAdminRole(role),
  dm_thue_loi_nhuan: (role) => isAdminRole(role),
  dm_chi_phi_khac: (role) => isAdminRole(role),
}

const TABLE_TO_PERMISSION_KEY: Partial<Record<string, MasterDataPermissionKey>> = {
  dm_kh: 'dm_kh',
  dm_duan: 'dm_duan',
  dm_ncc: 'dm_ncc',
  warehouse_location: 'dm_khu_vuc_ton',
  nvl: 'nvl',
  gia_nvl: 'gia_nvl',
  dm_coc_template: 'dm_coc_template',
  dm_dinh_muc_phu_md: 'dm_dinh_muc_phu_md',
  dm_capphoi_bt: 'dm_capphoi_bt',
  dm_thue_vat: 'dm_thue_loi_nhuan',
  dm_bien_loi_nhuan: 'dm_thue_loi_nhuan',
  dm_chi_phi_khac_md: 'dm_chi_phi_khac',
}

export function canAccessMasterData(role: string | null | undefined, permissionKey: MasterDataPermissionKey) {
  return MASTER_DATA_ROLE_RULES[permissionKey](role)
}

export function getMasterDataPermissionKeyForTable(tableName: string) {
  return TABLE_TO_PERMISSION_KEY[tableName] ?? null
}

export function assertMasterDataAccess(role: string | null | undefined, permissionKey: MasterDataPermissionKey) {
  if (!canAccessMasterData(role, permissionKey)) {
    redirect('/dashboard')
  }
}
