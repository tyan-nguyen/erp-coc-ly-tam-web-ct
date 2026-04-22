# ERP V2 NVL Procurement Flow

## Goal

This document defines the first operational workflow for raw-material procurement in `v2`.

The workflow is:

1. demand review
2. purchase proposal
3. purchase order
4. warehouse receipt

It must work even when plans change.

## Principle

Procurement documents are not stock truth.

They are:

- decision records
- external commitments
- receipt preparation

Stock truth starts only when warehouse confirms receipt.

## Workflow

### Step 1. Review demand

Users review:

- demand
- stock truth
- open inbound
- reusable coverage

This happens in:

- NVL demand cockpit
- NVL stock truth

### Step 2. Create purchase proposal

Purpose:

- ask for approval to buy

A purchase proposal line should show:

- material
- demand window
- current stock
- open inbound
- reusable coverage
- proposed buy qty
- reason
- urgency

Proposal statuses:

- `DRAFT`
- `CHO_DUYET`
- `DA_DUYET`
- `TU_CHOI`
- `DA_CHUYEN_DAT_HANG`

### Step 3. Create purchase order

Purpose:

- commit to the vendor

An order line should show:

- material
- ordered qty
- vendor
- expected date
- linked proposal
- coverage source

Order statuses:

- `DRAFT`
- `DA_GUI_NCC`
- `XAC_NHAN_MOT_PHAN`
- `DA_NHAN_MOT_PHAN`
- `DA_NHAN_DU`
- `HUY`

### Step 4. Warehouse receipt

Purpose:

- turn ordered inbound into stock truth

One purchase order may be received in multiple delivery batches.

This is especially important for bulk materials such as:

- sand
- stone
- loose aggregates

Example:

- ordered: `1000` tons of sand
- trip 1 delivered: `700`
- trip 2 delivered: `350`

The system must allow this and must not assume the vendor will deliver exactly one clean batch or exactly the ordered quantity.

Each receipt line should show:

- ordered qty
- received qty
- accepted qty
- rejected qty
- defective qty
- note

Receipt statuses:

- `DRAFT`
- `DA_NHAN`
- `DA_NHAN_MOT_PHAN`
- `DA_XU_LY_LOI`

## Edge cases

The receipt workflow must support:

- partial receipt
- defective receipt
- rejected receipt
- delayed receipt
- over-delivery if business allows
- multiple receipts against one purchase order
- real weighbridge quantity differing from nominal shipment quantity

## Critical business rule

Plan changes must not cause duplicate purchasing.

If open usable supply already exists for the same material:

- proposals must explain that
- orders must not be suggested blindly

## First implementation scope

Phase 1 in `v2` should provide:

1. a procurement workflow screen
2. document vocabulary and statuses
3. visible edge cases
4. a bridge from demand cockpit into procurement decisions

It does not need full execution schema yet.

## Receipt quantity truth

For bulk materials, the actual quantity recorded at receipt must be the warehouse truth.

If the truck, ship, or weighbridge result differs from the nominal delivery note:

- the actual measured quantity is the quantity used for receipt
- the remaining open quantity on the PO must be recalculated from real accepted receipt totals

This means a PO line can end in any of these states:

- still open because received less than ordered
- exactly complete
- over-delivered if business accepts the excess

## PO balance rule

For every PO line, the system should be able to show:

- ordered quantity
- total received quantity across all receipts
- total accepted quantity
- total rejected / defective quantity
- remaining open quantity

The remaining open quantity must be based on cumulative actual receipt quantities, not just the original plan.
