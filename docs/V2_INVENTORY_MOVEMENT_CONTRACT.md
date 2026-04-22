# V2 Inventory Movement Contract

## Goal

This document defines the contract for finished-goods inventory movements in `v2`.

It exists so that:

- production
- QC
- shipment
- return
- stock reconciliation
- warehouse-location work later

all speak the same language when they change finished-goods stock.

This is a contract document, not a UI document.

---

## 1. Principle

Every stock-changing business event must be representable as a movement record.

A movement is not the same thing as the current state.

- current state lives on `pile_serial`
- trace and reason live in history / movement form

The purpose of the movement contract is:

1. make stock changes explicit
2. avoid hidden stock math inside page loaders
3. let summary and serial-detail logic agree on the same event model

---

## 2. Movement identity

Each movement should answer these questions:

1. Which serial was affected?
2. What category of movement was this?
3. What business document caused it?
4. What changed in stock visibility/lifecycle?
5. When did it happen?
6. Who confirmed it?

---

## 3. Movement categories

The agreed categories for `v2` are:

- `PRODUCTION_IN`
- `QC_ACCEPTED`
- `QC_RETAIL_ONLY`
- `QC_CANCELLED`
- `SHIPMENT_OUT`
- `RETURN_TO_PROJECT`
- `RETURN_TO_RETAIL`
- `RETURN_CANCELLED`
- `LEGACY_RECONCILIATION_OUT`
- `LEGACY_RECONCILIATION_IN`
- `LOCATION_TRANSFER`
- `MANUAL_ADJUSTMENT`

Not every category must be implemented on day 1.

But new stock logic should only add from this family, not invent one-off page-specific math.

---

## 4. Effect model

Every movement category must declare a normalized effect:

- `physicalEffect`: `IN | OUT | NONE`
- `projectVisibilityEffect`: `ENABLE | DISABLE | NONE`
- `retailVisibilityEffect`: `ENABLE | DISABLE | NONE`
- `holdEffect`: `ENABLE | DISABLE | NONE`
- `lifecycleTarget`: optional lifecycle target after the movement

This keeps the business rule explicit.

Example:

### `SHIPMENT_OUT`
- physicalEffect: `OUT`
- projectVisibilityEffect: `DISABLE`
- retailVisibilityEffect: `DISABLE`
- holdEffect: `DISABLE`
- lifecycleTarget: `DA_XUAT`

### `RETURN_TO_PROJECT`
- physicalEffect: `IN`
- projectVisibilityEffect: `ENABLE`
- retailVisibilityEffect: `ENABLE`
- holdEffect: `DISABLE`
- lifecycleTarget: `TRA_LAI_DA_NHAN`

### `RETURN_TO_RETAIL`
- physicalEffect: `IN`
- projectVisibilityEffect: `DISABLE`
- retailVisibilityEffect: `ENABLE`
- holdEffect: `DISABLE`
- lifecycleTarget: `TRA_LAI_DA_NHAN`

### `RETURN_CANCELLED`
- physicalEffect: `NONE`
- projectVisibilityEffect: `DISABLE`
- retailVisibilityEffect: `DISABLE`
- holdEffect: `DISABLE`
- lifecycleTarget: `HUY`

---

## 5. Business document linkage

Each movement should keep a normalized reference to the document that caused it.

Supported source families:

- `PRODUCTION_PLAN`
- `QC_VOUCHER`
- `SHIPMENT_VOUCHER`
- `RETURN_VOUCHER`
- `LEGACY_RECONCILIATION`
- `WAREHOUSE_TRANSFER`
- `MANUAL_ADJUSTMENT`

Fields should be modelled as:

- `sourceType`
- `sourceId`
- `sourceLineId` when relevant

This prevents each feature from creating its own incompatible linkage style.

---

## 6. Reconciliation contract

`Legacy reconciliation` is special.

It exists to bridge old flows where quantity changed but serial assignment was missing.

### 6.1 Purpose

It should never invent fake serial history.

It should explicitly say:

- these serials are now considered mapped to an older shipment or return
- this reconciliation was done later for historical cleanup

### 6.2 Reconciliation outcomes

A reconciliation session should be able to result in:

- assign serials to old shipment outflow
- assign serials to old return inflow
- mark unresolved quantity gap still remaining

### 6.3 UI implication

Until a legacy gap is reconciled:

- summary numbers may be adjusted by gap logic
- serial drill-down must not claim precision it does not have

This matches the current `v2` direction.

---

## 7. Summary query rule

Summary inventory should be derived from:

1. current serial state
2. explicit legacy gap adjustments only when necessary

It should not be derived by loosely mixing quantities from unrelated pages.

This means summary logic must stay in one inventory module, not inside shipment page logic.

---

## 8. Serial detail rule

Serial detail must always stay truthful.

If there is not enough information to know whether a specific serial is still in stock:

- do not pretend it is known
- show a reconciliation warning instead

This is a hard rule for `v2`.

---

## 9. Implementation guidance

In code, `v2` should progressively move toward:

- `types.ts` for movement contracts
- a movement service / adapter layer
- selectors that consume normalized movement effects
- page loaders that do not invent stock rules locally

---

## 10. Definition of done

We can consider this contract adopted when:

1. production, QC, shipment, and return code paths use the same movement vocabulary
2. inventory summary and serial detail both read from the same stock logic layer
3. legacy reconciliation has an explicit contract, not hidden exceptions
4. adding warehouse locations later does not require rewriting stock math
