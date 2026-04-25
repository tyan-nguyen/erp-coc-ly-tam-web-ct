# ERP V2 NVL Architecture

## Core principle

Raw-material inventory must not treat production planning as stock truth.

The system should separate:

1. planning and forecast
2. purchasing commitments
3. warehouse truth

Planning may change. Purchases may be early, late, partial, or excessive. Stock truth must still remain correct.

## Business truth vs planning truth

### Planning truth

Planning is an input for:

- QLSX demand estimation
- purchase request justification
- accounting or management approval

Planning is not a hard obligation that all purchasing and stock records must always match exactly.

### Warehouse truth

Warehouse truth is driven only by real stock movements:

- purchase receipt
- issue to production
- return from production
- return to vendor
- adjustment in/out
- transfer in/out
- write-off or loss

This is the source of truth for actual raw-material stock.

## What changes stock and what does not

### Does not change stock

- approved estimate
- quote
- order
- production plan
- purchase request
- purchase order

These create expectation, demand, or commitment, but not physical stock.

### Changes stock

- warehouse receipt from vendor
- warehouse issue to production
- return from production back to warehouse
- return to vendor
- stock adjustment
- transfer between warehouses
- loss / disposal

## Three layers of NVL logic

### 1. Demand layer

Derived from:

- approved estimate
- active orders
- production plans
- manual planning window such as 1-2 weeks

This layer answers:

- what materials are expected to be needed
- in what quantity
- by what date or time window

This layer can change frequently.

### 2. Supply / coverage layer

Derived from:

- open purchase requests
- open purchase orders
- expected receipts
- reusable unconsumed material coverage

This layer answers:

- what quantities are already being covered
- what quantities are still not covered
- what supply is usable across changed plans

### 3. Stock layer

Derived from:

- stock movements only

This layer answers:

- what is physically in stock
- what is available for issue
- what is blocked, defective, or pending

## The key problem to solve

When plans change, users must not lose sight of what has already been purchased or committed.

Example:

- on `2026-02-28`, QLSX prepares material for `2026-03-01` to `2026-03-14`
- quote A needs `10` units of `Mui A`
- purchasing already places that order
- on `2026-03-01`, production switches away from quote A
- quote B now needs `8` units of `Mui A`

The system must not blindly propose another purchase of `8`.

Instead, it must show:

- material `Mui A` already has usable inbound or stock coverage of `10`
- current changed demand is `8`
- no additional purchase is required now
- if quote A returns later, only the remaining shortage should be proposed

## Reusable coverage

For standard materials, purchasing coverage should be reusable across quotes and plans for the same material.

### Meaning

- the system should keep traceability of why a purchase was created
- but should not hard-lock usage of a standard material to the original quote or plan

This is a soft reservation model, not a hard reservation model.

### Traceability

The system should still remember:

- which demand snapshot originally triggered the purchase request or order
- which quotes or plans contributed to that demand

### Usability

But if the material is standard and fungible, the same stock or open inbound can be used to cover another changed plan.

## Demand coverage model

Each material in a planning window should be represented by:

- demand quantity
- available stock
- open inbound quantity
- existing reusable coverage
- uncovered delta

Recommended formula:

`need_to_buy = demand_forecast - available_stock - open_inbound - reusable_coverage`

Where:

- `demand_forecast`: current expected requirement
- `available_stock`: current usable stock in warehouse
- `open_inbound`: open purchase receipts not fully received yet
- `reusable_coverage`: material already covered by previously approved procurement and still usable

## Why the UI matters

System calculations alone are not enough.

KTMH and QLSX must see the decision inputs clearly. Otherwise they will still buy twice or miss a shortage.

The interface must show, per material:

- current demand
- current stock
- open inbound
- existing coverage
- shortage or surplus
- recommendation
- explanation

## Decision UI requirements

### Screen 1: Material demand cockpit

Primary user:

- QLSX

Purpose:

- understand expected material demand for a date range
- see whether stock and open purchasing already cover it

Each row should show:

- material
- date window
- total demand
- current stock
- open inbound
- reusable coverage
- uncovered quantity
- status: covered / partial / shortage / excess

### Screen 2: Purchase decision screen

Primary user:

- KTMH
- approver

Purpose:

- decide whether to create or approve purchase requests

Each row should show:

- material
- demand
- stock on hand
- open PO quantity
- already covered quantity
- suggested purchase quantity
- reason or explanation

The screen must be able to say things like:

- "Do not buy more: already have 10 inbound, current demand is 8."
- "Buy 12 more: demand 20, stock 3, inbound 5, shortage 12."

### Screen 3: Stock truth screen

Primary user:

- warehouse
- purchasing
- management

Purpose:

- see physical stock and actual warehouse truth

This screen should not be driven by planning assumptions. It should only be driven by stock movements and current state.

## Recommended module boundaries

### Demand

- date-range demand snapshots
- derived from plans and approved source documents
- mutable and revisable

### Purchase requests

- user-created proposals
- justified by demand and stock situation
- not stock truth

### Purchase orders

- external commitment with vendors
- can be partially received, delayed, or cancelled
- still not stock truth

### Receipts

- actual received quantity
- accepted quantity
- rejected quantity
- defective quantity
- this is where stock truth begins

### Stock movements

- warehouse truth
- full audit trail

## Sub-flows that affect NVL inventory

### Positive movements

- purchase receipt accepted
- return from production
- adjustment in
- transfer in

### Negative movements

- issue to production
- return to vendor
- adjustment out
- transfer out
- loss / write-off

### Non-stock but still operationally important

- forecast demand creation
- purchase request creation
- purchase order issue
- expected delivery change

## Partial receipt and rejected goods

The system must support:

- received less than ordered
- defective or rejected material
- accepted and rejected quantities in the same receipt

Only accepted quantity increases stock truth.

Rejected or defective quantity must remain visible in procurement and receipt status, but not inflate usable stock.

## Recommended data concepts

### `material_demand_snapshot`

Stores:

- material
- date window
- source plans / orders / estimates
- demand quantity
- snapshot timestamp

### `material_procurement_coverage`

Stores:

- material
- planning window or demand bucket
- linked PR / PO / open inbound
- covered quantity
- reusable flag

### `material_purchase_request`

Stores:

- proposed buy quantity
- reason
- linked demand snapshot
- approval status

### `material_purchase_order`

Stores:

- vendor
- ordered quantity
- expected date
- status

### `material_purchase_receipt`

Stores:

- received quantity
- accepted quantity
- rejected quantity
- notes

### `material_stock_movement`

Stores:

- movement type
- quantity
- warehouse
- location if needed
- source document reference
- operation date
- actor

## Decision rules to enforce

1. never auto-buy just because current plan changed
2. always subtract open usable supply before suggesting new buying
3. keep original traceability, but allow reuse for standard materials
4. treat planning as a signal, not as stock truth
5. show the user why the recommendation exists

## Definition of done for NVL architecture

Before building full raw-material execution flows, v2 should have:

1. demand architecture locked
2. reusable coverage rule locked
3. decision UI fields agreed
4. stock movement types defined
5. receipt edge cases defined:
   - partial receipt
   - rejected receipt
   - defective receipt
   - delayed receipt

