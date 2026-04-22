# ERP V2 Inventory Counting Model

## Goal

This document defines the inventory-counting model for `v2`.

It covers:

- opening balance setup before go-live
- periodic counting during operations
- discrepancy approval flow
- cost classification for shortage / overage
- movement-history expectations for auditability

This model must work for:

- raw materials (`NVL`)
- finished goods (`cọc thành phẩm`)
- tools / consumables (`công cụ dụng cụ`)
- assets tracked in warehouse-related inventory views

## Core principle

Inventory counting is not just a warehouse note.

It must be a controlled workflow that:

1. records what was physically counted
2. compares it with system stock truth
3. applies an approved adjustment
4. leaves a permanent movement history

## Primary business flow

### Step 1. Counter creates counting sheet

Role:

- `Kiểm kê viên`
- or warehouse staff delegated for counting

Action:

- create a counting sheet
- choose counting scope
- choose items to count
- enter counted quantities
- if item is serial-based finished goods, allow scan by serial

The counter does **not** directly change stock truth.

### Step 2. Warehouse confirms count result

Role:

- `Thủ kho`

Action:

- review counted quantity
- confirm physical result
- decide whether the count result should be applied as an inventory adjustment

After warehouse confirmation, the sheet becomes a candidate adjustment.

### Step 3. Procurement/accounting reviews discrepancy

Role:

- `KTMH`
- or a later dedicated accounting/finance reviewer if needed

Action:

- review discrepancy amount
- review allowed loss percentage for the material
- approve cost classification

This is where the system decides whether the discrepancy is:

- management / operating cost
- loss / shrinkage cost

### Step 4. Adjustment is posted to stock truth

Only after approval should the system create stock movements.

This ensures:

- stock truth remains auditable
- discrepancy handling is explicit
- cost treatment is not hidden inside warehouse arithmetic

## Counting sheet types

The system should support at least two modes.

### 1. Opening balance count

Used when starting the system.

Purpose:

- load real on-hand stock into `v2`
- establish the first trusted stock baseline

Expected movement family:

- `OPENING_BALANCE_IN`
- `OPENING_BALANCE_OUT` only if negative corrections are explicitly allowed

In practice, opening balance normally behaves like:

- counted quantity becomes the initial stock quantity

### 2. Operational count

Used during normal operations.

Purpose:

- periodic counting
- cycle counting
- spot checks
- surprise checks
- recount after suspected discrepancy

Expected movement family:

- `STOCK_COUNT_GAIN`
- `STOCK_COUNT_LOSS`

## Counting scope

A counting sheet should support different scopes.

Recommended:

- full warehouse
- material group
- selected materials
- selected PO / receipt context
- selected finished-goods item
- selected storage location

This allows the team to count:

- only raw materials
- only finished goods
- only one group such as `THÉP`
- only one urgent discrepancy item

## Required document structure

### Counting sheet header

Suggested fields:

- `countSheetId`
- `countSheetCode`
- `countType`: `OPENING_BALANCE | OPERATIONAL`
- `scopeType`
- `warehouseId`
- `locationId` optional
- `countDate`
- `status`
- `note`
- `createdBy`
- `warehouseConfirmedBy`
- `approvedBy`

### Counting sheet line

Suggested fields:

- `countLineId`
- `itemType`: `NVL | FINISHED_GOOD | TOOL | ASSET`
- `materialId` or `finishedGoodId`
- `itemCode`
- `itemName`
- `unit`
- `systemQty`
- `countedQty`
- `varianceQty`
- `variancePct`
- `allowedLossPct`
- `costClassification`
- `reasonCode`
- `note`

### Serial detail for finished goods

For finished goods, sheet line should allow:

- counted by quantity
- counted by serial scan
- serial mismatch review

For serial-counted goods, the system should know:

- serial exists in system but not counted
- serial counted but status invalid
- serial counted in wrong location

## Status flow

Recommended header statuses:

- `NHAP`
- `CHO_XAC_NHAN_KHO`
- `CHO_DUYET_CHENH_LECH`
- `DA_DUYET`
- `DA_DIEU_CHINH_TON`
- `HUY`

Meaning:

- `NHAP`: counter still editing
- `CHO_XAC_NHAN_KHO`: ready for warehouse review
- `CHO_DUYET_CHENH_LECH`: warehouse confirmed physical count, waiting approval
- `DA_DUYET`: discrepancy approved and classification locked
- `DA_DIEU_CHINH_TON`: stock movement posted
- `HUY`: cancelled sheet

## Role responsibilities

### `Kiểm kê viên`

Can:

- create count sheet
- choose items
- enter counted quantity
- scan serials for finished goods if enabled
- submit for warehouse confirmation

Cannot:

- post stock adjustment
- finalize discrepancy cost treatment

### `Thủ kho`

Can:

- review count sheet
- confirm counted quantity
- submit discrepancy for approval
- see resulting adjustment impact before posting

Cannot:

- silently classify cost impact for materials beyond allowed rules

### `KTMH`

Can:

- review discrepancy
- approve cost classification for raw-material discrepancy
- see whether discrepancy falls within allowed loss threshold

### `Admin`

Can:

- override when needed
- reopen before final posting if operational policy allows

## Cost-classification rules

This must be explicit and consistent.

### Raw materials (`NVL`)

Each material may have:

- `hao_hut_pct`

If discrepancy is a shortage:

- if `variancePct <= hao_hut_pct`
  - classify as `CHI_PHI_QUAN_LY`
  - interpreted as acceptable operational / handling / measurement loss

- if `variancePct > hao_hut_pct`
  - classify as `CHI_PHI_THAT_THOAT`

This is especially relevant for:

- sand
- stone
- bulk materials
- weighted materials where measured quantity naturally varies

### Finished goods (`cọc thành phẩm`)

Shortage should go directly to:

- `CHI_PHI_THAT_THOAT`

Reason:

- finished goods are discrete items
- count mismatch is not a normal measurement-loss case

### Tools / consumables / assets

For:

- `CÔNG CỤ DỤNG CỤ`
- `TÀI SẢN`

shortage should also go directly to:

- `CHI_PHI_THAT_THOAT`

Reason:

- these are not bulk measured materials
- a 1-to-1 missing count is a real loss event, not normal handling shrinkage

### Positive variance

If counted quantity is higher than system quantity:

- classify as inventory gain
- do not treat it as management cost or shrinkage cost
- require a reason such as missed receipt, missed return, or historical data cleanup

## Movement contract additions

Inventory counting requires additional normalized movement families.

Recommended additions:

- `OPENING_BALANCE_IN`
- `OPENING_BALANCE_OUT`
- `STOCK_COUNT_GAIN`
- `STOCK_COUNT_LOSS`

Each movement must keep linkage to:

- `countSheetId`
- `countLineId`
- approver
- reason code

## Posting rules

### Raw materials

If counted quantity is lower than system quantity:

- post `STOCK_COUNT_LOSS`

If counted quantity is higher than system quantity:

- post `STOCK_COUNT_GAIN`

### Finished goods by serial

If serial scanning is used:

- missing serials should be explicit
- serial status/location should be corrected through auditable serial-aware adjustment rules

The system must not simply decrement aggregate quantity without serial explanation.

## Required UI screens

### 1. `Kiểm kê vật tư`

For counter / warehouse.

Must support:

- create sheet
- select scope
- add lines from master data
- enter counted quantity
- serial scan for finished goods

### 2. `Xác nhận kiểm kê`

For warehouse.

Must show per line:

- system qty
- counted qty
- variance
- variance %
- note

### 3. `Duyệt chênh lệch kiểm kê`

For KTMH/Admin.

Must show per line:

- item group
- allowed loss %
- variance %
- proposed cost classification
- reason
- approval action

### 4. `Lịch sử biến động vật tư`

This is mandatory for trust.

When users open one material or finished good, they must see:

- purchase receipts
- production issue
- production return
- counting adjustments
- opening balance
- manual corrections
- transfers

For each movement:

- date/time
- movement type
- source document
- quantity in/out
- effect on available / blocked / defective
- resulting balance if possible
- who confirmed it
- why it happened

This screen is critical because users will ask:

- why is stock this quantity today?
- which receipt increased it?
- which production issue reduced it?
- which counting sheet adjusted it?

## Recommended build order

### Phase 1

- opening balance for raw materials
- opening balance for finished goods
- count sheet header/line schema
- warehouse confirmation
- stock movement posting

### Phase 2

- KTMH discrepancy approval
- cost classification by `hao_hut_pct`
- support finished goods / tools / assets treatment

### Phase 3

- serial scanning for finished-goods count
- movement-history drill-down by item
- richer recount / recount approval flow

## Hard rules

1. counting does not directly overwrite stock without a document
2. warehouse cannot silently hide discrepancy in local page arithmetic
3. shortage classification must be explicit
4. raw-material shortage may use allowed loss %
5. finished goods / tools / assets shortage must go to loss cost directly
6. every count-driven stock change must appear in movement history
7. users must be able to explain current stock by reading movement history
