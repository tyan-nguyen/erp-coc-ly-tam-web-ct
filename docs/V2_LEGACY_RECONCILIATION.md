# V2 Legacy Reconciliation

## Goal

This document defines how `v2` handles older shipment/return data where quantity changed but serial assignment was not captured at the time of operation.

The purpose is:

- preserve truthful serial-level inventory
- avoid fake serial history
- give the warehouse a controlled way to reconcile old documents
- keep summary inventory useful while detail inventory stays honest

---

## 1. Problem statement

Legacy flows in `v1` allowed cases such as:

- shipment confirmed by quantity only
- return proposed/confirmed after quantity-only shipment
- stock totals known from vouchers
- exact serial identity unknown

This creates a gap between:

- `summary stock math`
- `serial-detail truth`

`v2` must treat this as a first-class business case.

---

## 2. Core rule

Until reconciliation is completed, the system must distinguish between:

1. `known serialized stock`
2. `legacy quantity gap`

Summary screens may reflect both.

Serial drill-down may only reflect the first one.

This means:

- totals can be adjusted
- serial detail must not overclaim certainty

---

## 3. Reconciliation scope

A reconciliation session should always target a concrete legacy document context.

Supported targets:

- one shipment voucher
- one shipment line
- one return voucher
- one item key inside a legacy voucher

The session must never be a vague bulk edit without document context.

---

## 4. Warehouse workflow

Recommended warehouse flow:

1. open legacy voucher needing reconciliation
2. review unresolved quantity gap by item
3. assign serials by one of these methods:
   - choose from eligible serial list
   - scan QR
   - paste serial code
   - upload QR image
4. confirm reconciliation
5. system writes explicit reconciliation records
6. summary gap decreases and serial detail becomes trustworthy for those serials

---

## 5. Reconciliation result types

A reconciliation action may result in one of these outcomes:

### 5.1 Legacy shipment assignment

Meaning:
- these serials are now confirmed to have left stock under an older shipment voucher

Effect:
- create explicit reconciliation-out records
- mark those serials as no longer in warehouse control
- reduce unresolved shipment gap

### 5.2 Legacy return assignment

Meaning:
- these serials are now confirmed to have come back under an older return flow

Effect:
- create explicit reconciliation-in records
- restore those serials into inventory visibility according to return direction
- reduce unresolved return gap

### 5.3 Remaining unresolved gap

Meaning:
- quantity mismatch still exists after partial reconciliation

Effect:
- summary may continue to show adjusted totals
- detail remains guarded
- system must continue showing reconciliation warning

---

## 6. Eligibility rules

A serial can only be assigned to a legacy reconciliation if:

1. item key matches
2. current lifecycle does not make the assignment impossible
3. the serial is not already bound to a conflicting voucher outcome
4. the assignment does not create impossible stock history

Examples:

- a serial already clearly shipped under another voucher should not be silently reassigned
- a destroyed serial should not be assigned as warehouse stock return without explicit override flow

---

## 7. Audit rules

Each reconciliation must store:

- who performed it
- when it was performed
- which legacy document it was tied to
- which serials were assigned
- what gap remained before and after
- optional note / reason

This is mandatory because reconciliation is historical repair, not a normal stock action.

---

## 8. Inventory effect rule

Legacy reconciliation is not allowed to invent business meaning.

It only makes an old business event explicit at serial level.

So the movement should be interpreted as:

- `LEGACY_RECONCILIATION_OUT` when mapping missing shipment serials
- `LEGACY_RECONCILIATION_IN` when mapping missing return serials

The final inventory effect must still follow the original business context.

---

## 9. UX rule

The reconciliation UI must be warehouse-friendly.

That means:

- start from the legacy document
- show unresolved qty clearly
- allow serial assignment by scan or manual fallback
- never hide the remaining unresolved gap
- never imply the system already knows exact serials when it does not

---

## 10. Definition of done

Legacy reconciliation can be considered implemented when:

1. unresolved shipment/return gaps can be listed by voucher and item
2. warehouse can assign serials to close all or part of the gap
3. reconciliation writes explicit records with audit trail
4. summary inventory and serial detail converge as reconciliation progresses
5. no screen needs hidden one-off math for old quantity-only vouchers
