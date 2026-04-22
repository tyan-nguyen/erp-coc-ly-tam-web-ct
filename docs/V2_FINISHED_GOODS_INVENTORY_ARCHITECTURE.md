# V2 Finished Goods Inventory Architecture

## Goal

This document defines the inventory architecture for finished piles in `v2`.

The main objective is:

- one consistent inventory truth
- serial-level correctness
- summary screens that stay fast over years of data
- no hidden inventory math inside unrelated pages

This is the backbone for:

- actual production confirmation
- QC by serial
- shipment by serial
- shipment return
- retail stock
- project-visible stock
- warehouse location support later

---

## 1. Core principle

Finished-goods inventory must be derived from **serial state + explicit inventory movements**.

We do **not** want each screen to calculate inventory in its own way.

Every feature that affects stock must pass through the same inventory model.

---

## 2. Inventory truth

### 2.1 Primary entity

The primary inventory entity is:

- `pile_serial`

Each serial represents one physical finished pile.

At any moment, a serial must answer:

1. Does it physically exist in company control?
2. Is it eligible for project delivery?
3. Is it eligible for retail sale?
4. What lifecycle state is it in?
5. What is the latest business event that put it there?

### 2.2 Secondary truth

The second layer is:

- `pile_serial_history`

This is the business trace layer, not the fastest summary source.

It must tell us:

- what changed
- when
- by whom
- why

### 2.3 Supporting operational links

These tables/events affect inventory visibility:

- `production_lot`
- `shipment_voucher_serial`
- `return_voucher`
- `return_voucher_serial`
- QC result fields on `pile_serial`

### 2.4 Future movement layer

For `v2`, we should be ready to introduce a dedicated movement model if needed:

- `inventory_movement`

This is not mandatory on day 1 if `pile_serial` + history can cover the rules cleanly,
but all code should be written so we can add it later without rewriting business screens.

---

## 3. Inventory dimensions

For each stock summary row, we need to distinguish at least these dimensions:

### 3.1 Physical stock

`physical_stock`

Meaning:

- serials physically inside company control
- regardless of whether they are for project or retail

Examples included:

- newly produced finished serials in warehouse
- returned serials received back into warehouse
- retail-only defect serials still stored in company yard

Examples excluded:

- shipped serials not returned
- canceled/destroyed serials

### 3.2 Project-visible stock

`project_visible_stock`

Meaning:

- serials that can be considered available to the project/order logic

Included:

- normal accepted serials still in stock
- returned serials marked “Nhập về cho dự án”

Excluded:

- retail-only defect serials
- canceled serials
- shipped serials not returned

### 3.3 Retail-visible stock

`retail_visible_stock`

Meaning:

- serials that can appear in retail/stock-sale flow

Included:

- normal accepted serials still in stock
- QC defect serials marked `Thanh lý / khách lẻ`
- returned serials marked `Nhập về khách lẻ`
- returned serials marked `Nhập về cho dự án` because the agreed rule says project and retail both see them

Excluded:

- canceled serials
- shipped serials not returned

### 3.4 Pending / hold stock

`pending_stock`

Meaning:

- serials physically present but intentionally not sellable/deliverable yet

Examples:

- waiting QC
- quarantined
- waiting reconciliation

Current agreed rules reduced many “pending” branches,
but the architecture must still support this bucket because it will matter later.

---

## 4. Serial lifecycle

Each serial should move through a controlled lifecycle.

### 4.1 Suggested lifecycle states

At minimum, `pile_serial.lifecycle_status` should support meanings equivalent to:

- `MOI_TAO`
- `TRONG_KHO`
- `DA_XUAT`
- `TRA_LAI_DA_NHAN`
- `HUY`

Names can stay compatible with current schema, but the meaning must remain strict.

### 4.2 Visibility is separate from lifecycle

This is important.

A serial can be:

- physically in stock
- but only visible to retail

So lifecycle alone is not enough.

That is why `v2` must preserve separate visibility logic:

- `visible_in_project`
- `visible_in_retail`

or an equivalent derived rule set.

---

## 5. Business events that affect inventory

These are the only allowed categories that should change finished-goods stock state.

### 5.1 Actual production confirmation

Source:

- warehouse confirms actual production

Effect:

- create `production_lot`
- create `pile_serial`
- set lifecycle to in-stock
- physical stock increases
- project-visible usually increases
- retail-visible usually increases

### 5.2 QC serial disposition

Source:

- QC confirms defects by serial

Effect by rule:

#### Normal accepted

- physical stock remains
- project-visible = yes
- retail-visible = yes

#### `Thanh lý / khách lẻ`

- physical stock remains
- project-visible = no
- retail-visible = yes

#### `Hủy bỏ`

- physical stock = no
- project-visible = no
- retail-visible = no

### 5.3 Shipment confirmation

Source:

- warehouse confirms shipment

Effect:

- serial moves out of company control
- physical stock decreases
- project-visible decreases
- retail-visible decreases
- lifecycle becomes shipped

### 5.4 Shipment return request

Source:

- business proposes quantity-only return request

Effect:

- **no inventory change yet**

This is request workflow only.

### 5.5 Warehouse confirms returned serials

Source:

- warehouse confirms actual returned serials and final disposition

Effect by rule:

#### `Nhập về cho dự án`

- physical stock increases
- project-visible = yes
- retail-visible = yes

#### `Nhập về khách lẻ`

- physical stock increases
- project-visible = no
- retail-visible = yes

#### `Hủy bỏ`

- physical stock = no
- project-visible = no
- retail-visible = no

### 5.6 Legacy reconciliation

Source:

- old quantity-only shipment/return records without serial linkage

Effect:

- does not directly “invent” fake serial certainty
- instead creates explicit reconciliation state until resolved

This must be isolated, visible, and temporary.

---

## 6. Summary vs serial detail

This is one of the most important rules for `v2`.

### 6.1 Summary can be broader than serial certainty

For legacy data, summary numbers may reflect:

- shipped quantity
- returned quantity

even if exact serial identities were not captured historically.

### 6.2 Serial detail must never lie

If exact serials are unknown, the serial detail screen must not pretend to know them.

Allowed behavior:

- show summary numbers
- show a reconciliation warning
- block or limit serial drill-down until legacy reconciliation is done

Not allowed:

- show all serials as “still in stock” when some were shipped by quantity-only flow

---

## 7. Query strategy for performance

Inventory can grow over years, so query design matters from the start.

### 7.1 Default UI mode

Inventory screens should always default to:

1. summary list
2. filtered summary
3. on-demand item detail
4. on-demand serial detail

Never default to loading all serials.

### 7.2 Read model split

We should have separate read paths for:

#### Item summary

Grouped by:

- pile type
- segment
- length

This is the primary inventory dashboard.

#### Item detail

Adds:

- lot count
- latest production date
- legacy reconciliation warning

#### Serial detail

Loaded only when a user opens one specific item row.

### 7.3 Preferred implementation

For `v2`, summary inventory should move toward:

- SQL view
- RPC
- or optimized repository query

The goal is to avoid:

- loading all `pile_serial` rows into app memory for aggregation

### 7.4 Detail query

Serial detail should:

- filter by one item key only
- paginate if needed
- avoid joining large unrelated tables

---

## 8. Inventory item key

All inventory summary math should group by a stable item key equivalent to:

- pile type
- outer diameter / thickness identity
- segment
- length

This grouping rule must be identical across:

- production summary
- QC summary
- shipment availability
- finished-goods inventory

If each feature derives the key differently, stock will drift.

So `v2` should introduce one shared helper for this item key derivation.

---

## 9. Return rules to preserve

These are agreed business rules and should be treated as locked.

### 9.1 Project shipment view

For project-based shipment:

- show all lines from the quotation/order
- KTBH may propose beyond `Có thể giao`
- warehouse is the point that enforces physical/serial reality

### 9.2 Retail shipment view

For retail sale:

- show all currently sellable retail stock

### 9.3 Return disposition

#### `Nhập về cho dự án`

- visible in project
- visible in retail

#### `Nhập về khách lẻ`

- not visible in project
- visible in retail

#### `Hủy bỏ`

- visible nowhere

---

## 10. Legacy handling policy

`v2` must explicitly separate:

- serialized truth
- reconciled legacy quantity gaps

### 10.1 Legacy gap record

For any item where:

- quantity moved historically
- but serial linkage is missing

we should surface:

- `legacy_gap_qty`

This lets summary stay operational without corrupting serial detail.

### 10.2 Reconciliation workflow

There must be a dedicated flow for:

- selecting an old shipment/return
- attaching or resolving the missing serials

This should be treated as an explicit maintenance workflow,
not hidden inside normal shipment screens.

---

## 11. Suggested implementation order

### Phase A

Define shared helpers:

- item key derivation
- serial visibility derivation
- inventory state derivation

### Phase B

Make production, QC, shipment, and return code paths all call the shared helpers.

### Phase C

Build inventory summary read model on top of those shared rules.

### Phase D

Add serial detail + legacy reconciliation workflow.

### Phase E

Add warehouse location support.

---

## 12. Definition of done for inventory architecture

We can say the inventory architecture is healthy when:

1. summary inventory and shipment availability use the same item key
2. every stock-affecting business event maps through one shared rule set
3. serial detail never contradicts summary without an explicit reconciliation warning
4. legacy gaps are visible and isolated
5. retail/project visibility is derived consistently
6. large inventory screens do not require loading all serials by default

---

## 13. Practical decision for the next coding phase

Before rebuilding `san-xuat`, `qc`, `xuat-hang`, and `tra-hang` in `v2`,
we should treat this inventory architecture as the contract.

That means:

- no feature should introduce ad-hoc stock math
- all future rebuild work must align to this document

This is the guardrail that keeps `v2` from drifting back into patchwork.
