# ERP V2 NVL Stock Truth Model

## Goal

This document defines the stock-truth model for raw materials in `v2`.

It complements:

- `V2_NVL_ARCHITECTURE.md`
- `V2_NVL_MOVEMENT_CONTRACT.md`

The purpose is to lock one principle:

- planning may change
- purchasing may change
- stock truth must remain explicit and auditable

## Source of truth

Raw-material stock truth must come from stock state plus normalized stock movements.

Recommended structures:

- `material_stock_balance`
- `material_stock_movement`

These names can still be refined, but the concepts must exist.

## What the stock truth layer must answer

For each material, warehouse, and optional location:

1. how much is physically in stock
2. how much is available for issue
3. how much is blocked / defective / pending
4. when the last movement happened
5. why the current quantity is what it is

## What this layer must not do

It must not:

- recompute from planning only
- assume open PO means stock already exists
- assume all defective quantities are usable
- assume demand equals issue

## Required stock fields

At minimum, a stock read-model should expose:

- `materialId`
- `materialCode`
- `materialName`
- `warehouseId`
- `warehouseLabel`
- `stockQty`
- `availableQty`
- `blockedQty`
- `defectiveQty`
- `lastMovementDate`

## Why this matters for the decision cockpit

The cockpit needs:

- demand
- open inbound
- reusable coverage
- stock truth

Without stock truth, purchase recommendations are incomplete.

Therefore the cockpit must clearly indicate whether stock truth is:

- connected
- or still pending schema / implementation

## Phase 1 expectation

For now, `v2` may expose a stock-truth screen even if the schema is not ready yet.

That screen should be honest:

- show that the stock-truth contract exists
- show whether schema is ready
- never invent warehouse quantities

