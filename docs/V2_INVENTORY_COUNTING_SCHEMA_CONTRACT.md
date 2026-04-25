# ERP V2 Inventory Counting Schema Contract

## Goal

This document locks the schema contract for inventory counting in `v2`.

It complements:

- `V2_INVENTORY_COUNTING_MODEL.md`
- `V2_NVL_MOVEMENT_CONTRACT.md`
- `V2_INVENTORY_MOVEMENT_CONTRACT.md`

The purpose is to ensure that:

- count sheets
- discrepancy approval
- stock adjustments
- movement history

all use one durable data contract.

## Main documents

Recommended tables:

- `inventory_count_sheet`
- `inventory_count_line`
- `inventory_count_serial`

These should work for both:

- raw materials
- finished goods
- tools / consumables
- assets

## 1. `inventory_count_sheet`

Header document for one counting session.

### Suggested columns

- `count_sheet_id` uuid primary key
- `count_sheet_code` text unique
- `count_type` text
  - `OPENING_BALANCE`
  - `OPERATIONAL`
- `scope_type` text
  - `FULL_WAREHOUSE`
  - `MATERIAL_GROUP`
  - `SELECTED_ITEMS`
  - `SELECTED_LOCATION`
  - `SELECTED_PO_CONTEXT`
- `warehouse_id` text null
- `location_id` text null
- `count_date` date not null
- `status` text not null
  - `NHAP`
  - `CHO_XAC_NHAN_KHO`
  - `CHO_DUYET_CHENH_LECH`
  - `DA_DUYET`
  - `DA_DIEU_CHINH_TON`
  - `HUY`
- `note` text null
- `payload_json` jsonb
- `is_active` boolean
- `deleted_at` timestamptz null
- `created_at` timestamptz
- `updated_at` timestamptz
- `created_by` uuid null
- `updated_by` uuid null
- `warehouse_confirmed_by` uuid null
- `warehouse_confirmed_at` timestamptz null
- `approved_by` uuid null
- `approved_at` timestamptz null
- `posted_by` uuid null
- `posted_at` timestamptz null

## 2. `inventory_count_line`

Line-level quantity comparison.

### Suggested columns

- `count_line_id` uuid primary key
- `count_sheet_id` uuid not null references `inventory_count_sheet`
- `line_no` integer not null
- `item_type` text not null
  - `NVL`
  - `FINISHED_GOOD`
  - `TOOL`
  - `ASSET`
- `item_id` text null
- `item_code` text not null
- `item_name` text not null
- `item_group` text null
- `unit` text null
- `warehouse_id` text null
- `location_id` text null
- `system_qty` numeric(18,3) not null default 0
- `counted_qty` numeric(18,3) not null default 0
- `variance_qty` numeric(18,3) not null default 0
- `variance_pct` numeric(18,4) not null default 0
- `allowed_loss_pct` numeric(18,4) not null default 0
- `cost_classification` text null
  - `CHI_PHI_QUAN_LY`
  - `CHI_PHI_THAT_THOAT`
  - `TON_TANG`
  - `KHONG_AP_DUNG`
- `reason_code` text null
- `note` text null
- `payload_json` jsonb
- `is_active` boolean
- `deleted_at` timestamptz null
- `created_at` timestamptz
- `updated_at` timestamptz
- `created_by` uuid null
- `updated_by` uuid null

### Required rules

- `variance_qty = counted_qty - system_qty`
- `variance_pct` should be stored or recomputable
- `allowed_loss_pct` should snapshot the master-data value at count time
- line should keep enough data to explain approval even if master data changes later

## 3. `inventory_count_serial`

Optional serial detail, mainly for finished goods.

### Suggested columns

- `count_serial_id` uuid primary key
- `count_sheet_id` uuid not null references `inventory_count_sheet`
- `count_line_id` uuid not null references `inventory_count_line`
- `serial_id` uuid null
- `serial_code` text not null
- `count_status` text not null
  - `COUNTED`
  - `MISSING_IN_COUNT`
  - `UNEXPECTED_FOUND`
  - `WRONG_LOCATION`
- `system_location_id` text null
- `counted_location_id` text null
- `note` text null
- `payload_json` jsonb
- `created_at` timestamptz
- `updated_at` timestamptz
- `created_by` uuid null
- `updated_by` uuid null

## Posting and movement linkage

Counting sheets must never silently overwrite balances.

Once approved, they must create movement records linked by:

- `source_type = INVENTORY_COUNT_SHEET`
- `source_id = count_sheet_id`
- `source_line_id = count_line_id`

### Recommended movement families

For raw materials:

- `OPENING_BALANCE_IN`
- `OPENING_BALANCE_OUT`
- `STOCK_COUNT_GAIN`
- `STOCK_COUNT_LOSS`

For finished goods / serial-aware items:

- keep serial-history linkage explicit
- if aggregate movement is used, still keep serial drill-down rows

## Cost-classification snapshot rule

Approval must not depend on today's master data only.

Each count line should snapshot:

- `allowed_loss_pct`
- `item_group`
- `item_type`

So later audit can still answer:

- why was this shortage classified as management cost?
- why was this one classified as loss?

## Approval rules by item type

### `NVL`

- if shortage percentage `<= allowed_loss_pct`
  - `cost_classification = CHI_PHI_QUAN_LY`
- if shortage percentage `> allowed_loss_pct`
  - `cost_classification = CHI_PHI_THAT_THOAT`

### `FINISHED_GOOD`, `TOOL`, `ASSET`

- shortage goes directly to `CHI_PHI_THAT_THOAT`
- positive variance becomes `TON_TANG`

## Required indexes

Recommended indexes:

- `inventory_count_sheet(status, count_date desc)`
- `inventory_count_sheet(count_type, count_date desc)`
- `inventory_count_line(count_sheet_id, line_no)` unique
- `inventory_count_line(item_code)`
- `inventory_count_line(item_type, item_group)`
- `inventory_count_serial(count_sheet_id)`
- `inventory_count_serial(count_line_id)`
- `inventory_count_serial(serial_code)`

## Reopen policy

Suggested rule:

- before stock posting: `Admin` may reopen
- after stock posting: no silent reopen
- any correction after posting should happen through a new counting or manual-correction document

This protects movement-history integrity.

## Read-model expectations

The following read-models should later consume this schema:

### `Inventory Count List`

Shows:

- sheet code
- type
- date
- scope
- status
- line count
- variance summary

### `Inventory Count Detail`

Shows:

- system qty
- counted qty
- variance
- variance %
- allowed loss %
- classification
- serial detail if applicable

### `Movement History by Item`

Must be able to include counting-driven movements alongside:

- purchase receipts
- issue to production
- production returns
- transfers
- manual corrections
- opening balance

## Definition of done

This schema contract is ready when:

1. one count sheet can cover NVL / finished goods / tools / assets
2. warehouse confirmation and KTMH approval are represented explicitly
3. count approval can post auditable stock movements
4. every item can later explain current stock through movement history
