import { getCurrentSessionProfile } from '@/lib/auth/session'
import { ProtectedSessionProvider } from '@/components/auth/protected-session-provider'
import { ProtectedShellClient } from '@/components/layout/protected-shell-client'
import { createClient } from '@/lib/supabase/server'
import {
  isAdminRole,
  isCommercialRole,
  isInventoryCounterRole,
  isPurchaseRole,
  isQcRole,
  isQlsxRole,
  isSalesAccountingRole,
  isTechnicalRole,
  isWarehouseRole,
} from '@/lib/auth/roles'
import { canAccessMasterData, type MasterDataPermissionKey } from '@/lib/master-data/permissions'
import { loadWarehouseLocationAssignmentPageData } from '@/lib/ton-kho-thanh-pham/location-assignment-page-data'
import { loadSerialReprintSearchOptions } from '@/lib/pile-serial/repository'

export const dynamic = 'force-dynamic'

const MASTER_DATA_ITEMS = [
  { href: '/master-data/dm-kh', label: 'Khách hàng', permissionKey: 'dm_kh' },
  { href: '/master-data/dm-duan', label: 'Dự án', permissionKey: 'dm_duan' },
  { href: '/master-data/dm-ncc', label: 'Nhà cung cấp', permissionKey: 'dm_ncc' },
  { href: '/master-data/khu-vuc-ton', label: 'Khu vực tồn', permissionKey: 'dm_khu_vuc_ton' },
  { href: '/master-data/nvl', label: 'Nguyên vật liệu', permissionKey: 'nvl' },
  { href: '/master-data/dm-coc-template', label: 'Loại cọc mẫu', permissionKey: 'dm_coc_template' },
  { href: '/master-data/dm-dinh-muc-phu-md', label: 'Định mức phụ', permissionKey: 'dm_dinh_muc_phu_md' },
  { href: '/master-data/dm-capphoi-bt', label: 'Cấp phối bê tông', permissionKey: 'dm_capphoi_bt' },
  { href: '/master-data/dm-thue-loi-nhuan', label: 'Thuế + lợi nhuận', permissionKey: 'dm_thue_loi_nhuan' },
  { href: '/master-data/dm-chi-phi-khac', label: 'Chi phí khác / md', permissionKey: 'dm_chi_phi_khac' },
]

type NavItem = {
  href?: string
  label: string
  children?: Array<{
    href?: string
    label: string
    kind?: 'link' | 'section'
  }>
}

function buildInventoryChildren(options?: {
  includeDemand?: boolean
  includeProcurement?: boolean
  includeRealInventory?: boolean
  includeFinishedGoodsInventory?: boolean
  includePileLookup?: boolean
  includeInternalScan?: boolean
  includeYardSerials?: boolean
  includeAssignYard?: boolean
  includeYardQr?: boolean
  includeReprintLabels?: boolean
  includeLegacyReconciliation?: boolean
}) {
  const {
    includeDemand = true,
    includeProcurement = true,
    includeRealInventory = true,
    includeFinishedGoodsInventory = true,
    includePileLookup = true,
    includeInternalScan = true,
    includeYardSerials = true,
    includeAssignYard = true,
    includeYardQr = true,
    includeReprintLabels = true,
    includeLegacyReconciliation = true,
  } = options ?? {}

  const children: NonNullable<NavItem['children']> = [
    { label: 'Kho NVL', kind: 'section' },
  ]

  if (includeDemand) children.push({ href: '/ton-kho/nvl/nhu-cau', label: 'Nhu cầu NVL' })
  if (includeProcurement) children.push({ href: '/ton-kho/nvl/mua-hang', label: 'Mua hàng NVL' })
  if (includeRealInventory) children.push({ href: '/ton-kho/nvl/ton-thuc', label: 'Tồn thực NVL' })

  children.push({ label: 'Kho thành phẩm', kind: 'section' })

  if (includeFinishedGoodsInventory) children.push({ href: '/ton-kho/thanh-pham', label: 'Tồn cọc thành phẩm' })
  if (includePileLookup) children.push({ href: '/ton-kho/thanh-pham/tra-cuu-coc', label: 'Tra cứu mã cọc' })
  if (includeInternalScan) children.push({ href: '/ton-kho/thanh-pham/vi-tri-bai/noi-bo', label: 'Scan nội bộ' })
  if (includeYardSerials) children.push({ href: '/ton-kho/thanh-pham/vi-tri-bai', label: 'Serial theo bãi' })
  if (includeAssignYard) children.push({ href: '/ton-kho/thanh-pham/vi-tri-bai/gan-bai', label: 'Gán serial vào bãi' })
  if (includeReprintLabels) children.push({ href: '/ton-kho/thanh-pham/in-tem', label: 'In tem cọc' })
  if (includeYardQr) children.push({ href: '/ton-kho/thanh-pham/vi-tri-bai/ma-qr', label: 'In QR bãi' })
  if (includeLegacyReconciliation) {
    children.push({ href: '/ton-kho/thanh-pham/doi-soat-legacy', label: 'Đối soát serial legacy' })
  }

  return children
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/v2', label: 'V2 Rebuild' },
  {
    label: 'Đơn hàng',
    children: [
      { href: '/boc-tach/boc-tach-nvl', label: 'Danh sách bóc tách' },
      { href: '/boc-tach/boc-tach-nvl/new', label: 'Lập dự toán' },
      { href: '/don-hang', label: 'Danh sách đơn hàng' },
      { href: '/don-hang/bao-gia', label: 'Danh sách báo giá' },
      { href: '/don-hang/phieu-xuat', label: 'Phiếu xuất hàng cọc TP' },
      { href: '/don-hang/phieu-xuat/nvl', label: 'Phiếu xuất hàng NVL' },
    ],
  },
  {
    label: 'Sản xuất',
    children: [
      { href: '/san-xuat/ke-hoach-ngay', label: 'Kế hoạch sản xuất ngày' },
      { href: '/san-xuat/mua-coc-ngoai', label: 'Mua cọc ngoài' },
      { href: '/san-xuat/qc-nghiem-thu', label: 'Nghiệm thu QC' },
    ],
  },
  {
    label: 'Tồn kho',
    children: buildInventoryChildren(),
  },
  {
    label: 'Kiểm kê',
    children: [
      { href: '/ton-kho/kiem-ke', label: 'Vật tư' },
      { href: '/ton-kho/thanh-pham/kiem-ke', label: 'Cọc thành phẩm' },
    ],
  },
] satisfies NavItem[]

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await getCurrentSessionProfile()
  const commercialViewer = isCommercialRole(profile.role)
  const salesAccountingViewer = isSalesAccountingRole(profile.role)
  const purchaseViewer = isPurchaseRole(profile.role)
  const technicalViewer = isTechnicalRole(profile.role)
  const qlsxViewer = isQlsxRole(profile.role)
  const warehouseViewer = isWarehouseRole(profile.role)
  const inventoryCounterViewer = isInventoryCounterRole(profile.role)
  const qcViewer = isQcRole(profile.role)
  const adminViewer = isAdminRole(profile.role)
  const canUseInternalScanOverlay = adminViewer || qlsxViewer || warehouseViewer
  const canAccessShipmentVoucher = commercialViewer || warehouseViewer || adminViewer
  const rawNavItems = salesAccountingViewer
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        {
          label: 'Sản xuất',
          children: [{ href: '/san-xuat/ke-hoach-ngay', label: 'Duyệt chốt KHSX ngày' }],
        },
        {
          label: 'Bán hàng',
          children: [
            { href: '/don-hang/bao-gia', label: 'Danh sách báo giá' },
            { href: '/don-hang/phieu-xuat', label: 'Phiếu xuất hàng cọc TP' },
            { href: '/don-hang/phieu-xuat/nvl', label: 'Phiếu xuất hàng NVL' },
          ],
        },
        {
          label: 'Tồn kho',
          children: buildInventoryChildren({
            includeDemand: false,
            includeProcurement: false,
            includeRealInventory: true,
            includeInternalScan: false,
            includeYardSerials: false,
            includeAssignYard: false,
            includeYardQr: false,
            includeReprintLabels: false,
            includeLegacyReconciliation: false,
          }),
        },
      ]
    : commercialViewer
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        {
          label: 'Đơn hàng',
          children: [
            { href: '/don-hang/bao-gia', label: 'Danh sách báo giá' },
            { href: '/don-hang/phieu-xuat', label: 'Phiếu xuất hàng cọc TP' },
            { href: '/don-hang/phieu-xuat/nvl', label: 'Phiếu xuất hàng NVL' },
          ],
        },
        {
          label: 'Tồn kho',
          children: buildInventoryChildren({ includeInternalScan: false, includeReprintLabels: false }),
        },
        {
          label: 'Kiểm kê',
          children: [
            { href: '/ton-kho/kiem-ke', label: 'Vật tư' },
            { href: '/ton-kho/thanh-pham/kiem-ke', label: 'Cọc thành phẩm' },
          ],
        },
      ]
    : purchaseViewer
      ? [
          { href: '/dashboard', label: 'Dashboard' },
          {
            label: 'Mua hàng',
            children: [
              { href: '/ton-kho/nvl/mua-hang', label: 'Nguyên vật liệu' },
              { href: '/san-xuat/mua-coc-ngoai', label: 'Cọc thành phẩm' },
            ],
          },
          {
            label: 'Kho',
            children: [{ href: '/ton-kho/nvl/ton-thuc', label: 'Nguyên vật liệu' }],
          },
      ]
      : technicalViewer
      ? [
          { href: '/dashboard', label: 'Dashboard' },
          {
            label: 'Đơn hàng',
            children: [
              { href: '/boc-tach/boc-tach-nvl', label: 'Danh sách bóc tách' },
              { href: '/don-hang', label: 'Danh sách đơn hàng' },
              { href: '/don-hang/bao-gia', label: 'Danh sách báo giá' },
            ],
          },
          {
            label: 'Tồn kho',
            children: buildInventoryChildren({
              includeDemand: false,
              includeProcurement: false,
              includeInternalScan: false,
              includeYardSerials: false,
              includeAssignYard: false,
              includeYardQr: false,
              includeReprintLabels: false,
              includeLegacyReconciliation: false,
            }),
          },
        ]
      : qlsxViewer
      ? [
          { href: '/dashboard', label: 'Dashboard' },
          {
            label: 'Đơn hàng',
            children: [
              { href: '/boc-tach/boc-tach-nvl', label: 'Duyệt dự toán' },
              { href: '/don-hang', label: 'Danh sách đơn hàng' },
            ],
          },
          {
            label: 'Sản xuất',
            children: [{ href: '/san-xuat/ke-hoach-ngay', label: 'Kế hoạch sản xuất ngày' }],
          },
          {
            label: 'Tồn kho',
            children: buildInventoryChildren({
              includeDemand: false,
              includeProcurement: false,
            }),
          },
          {
            label: 'Mua hàng',
            children: [
              { href: '/san-xuat/mua-coc-ngoai', label: 'Cọc thành phẩm' },
              { href: '/ton-kho/nvl/mua-hang', label: 'Nguyên vật liệu' },
            ],
          },
        ]
      : warehouseViewer
        ? [
            { href: '/dashboard', label: 'Dashboard' },
            {
              label: 'Kho',
              children: [
                { href: '/don-hang/phieu-xuat', label: 'Phiếu xuất hàng cọc TP' },
                { href: '/don-hang/phieu-xuat/nvl', label: 'Phiếu xuất hàng NVL' },
                { href: '/san-xuat/mua-coc-ngoai', label: 'Nhập kho cọc ngoài' },
                ...buildInventoryChildren({ includeDemand: false, includeProcurement: true }),
              ],
            },
            {
              label: 'Kiểm kê',
              children: [
                { href: '/ton-kho/kiem-ke', label: 'Vật tư' },
                { href: '/ton-kho/thanh-pham/kiem-ke', label: 'Cọc thành phẩm' },
              ],
            },
            {
              label: 'Sản xuất',
              children: [{ href: '/san-xuat/ke-hoach-ngay', label: 'Kế hoạch đã chốt' }],
            },
          ]
        : inventoryCounterViewer
          ? [
              { href: '/dashboard', label: 'Dashboard' },
              {
                label: 'Kiểm kê',
                children: [
                  { href: '/ton-kho/kiem-ke', label: 'Vật tư' },
                  { href: '/ton-kho/thanh-pham/kiem-ke', label: 'Cọc thành phẩm' },
                ],
              },
              {
                label: 'Kho',
                children: buildInventoryChildren({
                  includeDemand: false,
                  includeProcurement: false,
                  includeRealInventory: false,
                  includeFinishedGoodsInventory: false,
                  includeInternalScan: false,
                  includeYardSerials: false,
                  includeAssignYard: false,
                  includeYardQr: false,
                  includeLegacyReconciliation: false,
                }),
              },
            ]
        : qcViewer
          ? [
              { href: '/dashboard', label: 'Dashboard' },
              {
                label: 'Sản xuất',
                children: [{ href: '/san-xuat/qc-nghiem-thu', label: 'Nghiệm thu QC' }],
              },
            ]
    : adminViewer
      ? NAV_ITEMS
      : [{ href: '/dashboard', label: 'Dashboard' }]
  const navItems = rawNavItems.reduce<NavItem[]>((items, item) => {
    if (!item.children) {
      items.push(item)
      return items
    }

    const children = item.children.filter((child) =>
      child.href === '/don-hang/phieu-xuat' ? canAccessShipmentVoucher : true
    )

    if (children.length > 0) {
      items.push({ ...item, children })
    }

    return items
  }, [])
  const masterDataItems = MASTER_DATA_ITEMS.filter((item) =>
    canAccessMasterData(profile.role, item.permissionKey as MasterDataPermissionKey)
  ).map(({ href, label }) => ({ href, label }))
  const internalScanSupabase = canUseInternalScanOverlay ? await createClient() : null
  const [internalScanPageData, internalScanReprintOptions] =
    canUseInternalScanOverlay && internalScanSupabase
      ? await Promise.all([
          loadWarehouseLocationAssignmentPageData(internalScanSupabase),
          loadSerialReprintSearchOptions(internalScanSupabase),
        ])
      : [null, null]

  return (
      <ProtectedSessionProvider
        value={{ user: { id: user.id, email: user.email ?? null }, profile }}
      >
      <ProtectedShellClient
        userEmail={user.email ?? null}
        role={profile.role}
        originalRole={profile.original_role}
        isRoleOverridden={profile.is_role_overridden}
        navItems={navItems}
        masterDataItems={masterDataItems}
        canUseInternalScanOverlay={canUseInternalScanOverlay}
        internalScanPageData={internalScanPageData}
        internalScanReprintOptions={internalScanReprintOptions}
      >
        {children}
      </ProtectedShellClient>
    </ProtectedSessionProvider>
  )
}
