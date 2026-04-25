# ERP V2 Architecture

## Goal

`erp-coc-ly-tam-web-v2` is the rebuild workspace.

We keep:

- the current business rules
- the current database model that has already been validated in real flows
- the existing app as a reference

We rebuild:

- page architecture
- data-loading strategy
- mutation flow
- feature boundaries
- performance-sensitive inventory and shipment screens

Related design docs:

- `docs/V2_FINISHED_GOODS_INVENTORY_ARCHITECTURE.md`
- `docs/V2_INVENTORY_MOVEMENT_CONTRACT.md`
- `docs/V2_LEGACY_RECONCILIATION.md`

## Principles

### 1. Domain first

Business rules must live in feature services, not in page components.

Examples:

- shipment return rules
- QC default-pass logic
- inventory visibility rules for project vs retail

### 2. Query and mutation separation

Each feature should separate:

- read models / queries
- write actions / commands

This keeps slow summary screens from being tied to mutation-heavy flows.

### 3. Summary-first UI

For data that grows over years, the UI must default to:

- summaries first
- detail on demand
- serial drill-down only when explicitly opened

### 4. Minimal refreshes

Avoid full-page `router.refresh()` after every mutation.

Preferred order:

1. mutate
2. update local UI state
3. refetch only the affected slice when needed

### 5. Database truth with controlled bridges

For old flows that used quantity-only operations, we may need bridge logic.
Those bridges must be explicit and temporary, never hidden inside random UI code.

### 6. Inventory-first contracts

Before rebuilding production, QC, shipment, return, and stock screens,
the inventory contract must be defined explicitly.

That contract is documented in:

- `docs/V2_FINISHED_GOODS_INVENTORY_ARCHITECTURE.md`
- `docs/V2_INVENTORY_MOVEMENT_CONTRACT.md`
- `docs/V2_LEGACY_RECONCILIATION.md`

## Proposed app shape

```text
app/
  (protected)/
  api/

components/
  ui/
  layout/

features/
  auth/
  master-data/
  boc-tach/
  bao-gia/
  don-hang/
  san-xuat/
  qc/
  xuat-hang/
  ton-kho-thanh-pham/

lib/
  core/
  shared/
```

## Feature shape

Each feature will converge toward:

```text
features/<feature>/
  domain/
  data/
  ui/
```

### `domain/`

Pure business rules and orchestration.

Examples:

- `createShipmentReturnRequest`
- `confirmReturnedSerials`
- `deriveInventoryVisibility`

### `data/`

Supabase queries, DTO mapping, persistence helpers.

### `ui/`

Feature-specific components, local state, interaction helpers.

## Rebuild order

1. shared shell and navigation
2. auth/session boundaries
3. master data
4. bóc tách
5. báo giá
6. đơn hàng
7. sản xuất and lot/serial generation
8. QC
9. xuất hàng
10. trả hàng
11. tồn kho thành phẩm
12. vị trí kho

## Performance targets

### Shipment page

- split list, source summary, voucher detail, and serial detail
- no full data reload after each scan

### Finished goods inventory

- summary via optimized query/view
- detail and serial pages fetched only on demand
- legacy reconciliation isolated into its own workflow

### Bóc tách

- reference data loaded predictably
- no heavy reload on each save

## Non-goals

- rewriting all database tables from scratch
- carrying over every old page as-is
- adding new business rules before the feature boundary is clean
