# ERP V2 NVL Movement Contract

## Goal

This document defines the normalized movement contract for raw-material inventory in `v2`.

It exists so that:

- warehouse receipt
- purchase discrepancy handling
- issue to production
- return from production
- return to vendor
- stock adjustment
- warehouse transfer

all change stock through the same movement language.

This is a stock-truth contract, not a planning contract.

## Principle

Every real stock change for raw materials must be representable as a movement record.

Planning, demand, purchase requests, and purchase orders may justify decisions, but they do not change stock on their own.

Only warehouse movements change stock truth.

## Movement identity

Each movement should answer:

1. which material was affected
2. which warehouse or location was affected
3. what movement category occurred
4. which source document caused it
5. whether stock increased, decreased, or stayed non-usable
6. when it happened
7. who confirmed it

## Raw-material movement families

The agreed movement families for `v2` are:

- `PURCHASE_RECEIPT_ACCEPTED`
- `PURCHASE_RECEIPT_REJECTED`
- `PURCHASE_RECEIPT_DEFECTIVE`
- `RETURN_TO_VENDOR`
- `ISSUE_TO_PRODUCTION`
- `RETURN_FROM_PRODUCTION`
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`
- `TRANSFER_IN`
- `TRANSFER_OUT`
- `WRITE_OFF`
- `MANUAL_CORRECTION`

Not all of these must be implemented on day 1.

But new NVL stock logic should be built from this family, not from one-off page-local arithmetic.

## Effect model

Every movement family should declare a normalized effect:

- `physicalEffect`: `IN | OUT | NONE`
- `availableEffect`: `ENABLE | DISABLE | NONE`
- `blockedEffect`: `ENABLE | DISABLE | NONE`
- `qualityEffect`: `ACCEPTED | REJECTED | DEFECTIVE | NONE`

This makes the business meaning explicit.

### `PURCHASE_RECEIPT_ACCEPTED`

- physicalEffect: `IN`
- availableEffect: `ENABLE`
- blockedEffect: `DISABLE`
- qualityEffect: `ACCEPTED`

### `PURCHASE_RECEIPT_REJECTED`

- physicalEffect: `NONE`
- availableEffect: `NONE`
- blockedEffect: `NONE`
- qualityEffect: `REJECTED`

This means goods were presented but not admitted to usable stock.

### `PURCHASE_RECEIPT_DEFECTIVE`

- physicalEffect: `IN`
- availableEffect: `DISABLE`
- blockedEffect: `ENABLE`
- qualityEffect: `DEFECTIVE`

This means goods physically arrived but are not usable yet.

### `RETURN_TO_VENDOR`

- physicalEffect: `OUT`
- availableEffect: `DISABLE`
- blockedEffect: `DISABLE`
- qualityEffect: `NONE`

### `ISSUE_TO_PRODUCTION`

- physicalEffect: `OUT`
- availableEffect: `DISABLE`
- blockedEffect: `DISABLE`
- qualityEffect: `NONE`

### `RETURN_FROM_PRODUCTION`

- physicalEffect: `IN`
- availableEffect: `ENABLE`
- blockedEffect: `DISABLE`
- qualityEffect: `ACCEPTED`

### `ADJUSTMENT_IN`

- physicalEffect: `IN`
- availableEffect: `ENABLE`
- blockedEffect: `DISABLE`
- qualityEffect: `NONE`

### `ADJUSTMENT_OUT`

- physicalEffect: `OUT`
- availableEffect: `DISABLE`
- blockedEffect: `DISABLE`
- qualityEffect: `NONE`

### `WRITE_OFF`

- physicalEffect: `OUT`
- availableEffect: `DISABLE`
- blockedEffect: `DISABLE`
- qualityEffect: `DEFECTIVE`

## Source document linkage

Each movement should keep a normalized reference to the business document that caused it.

Supported source families:

- `PURCHASE_REQUEST`
- `PURCHASE_ORDER`
- `PURCHASE_RECEIPT`
- `PRODUCTION_PLAN`
- `PRODUCTION_ISSUE_VOUCHER`
- `PRODUCTION_RETURN_VOUCHER`
- `WAREHOUSE_TRANSFER`
- `STOCK_ADJUSTMENT`
- `MANUAL_CORRECTION`

Suggested linkage fields:

- `sourceType`
- `sourceId`
- `sourceLineId`

This prevents each module from inventing incompatible references.

## Receipt edge cases

Raw-material receipt must support:

- ordered quantity
- received quantity
- accepted quantity
- rejected quantity
- defective quantity
- multiple receipt batches for one PO line
- actual measured quantity different from nominal shipped quantity

### Rule

Only accepted quantity goes to available stock immediately.

Rejected quantity does not enter stock truth.

Defective quantity may physically enter the warehouse but must remain blocked until resolved.

For bulk materials, the actual measured receipt quantity is authoritative.

Examples:

- weighbridge quantity
- ship unloading tally
- truck scale quantity

The movement record must use the actual measured quantity, even if it differs from the vendor's nominal shipping quantity.

This is critical for materials such as:

- sand
- stone
- bulk aggregates

## Production issue and return

### Issue to production

When warehouse issues material to production:

- physical stock decreases
- usable stock decreases
- source production plan or voucher must be linked

### Return from production

When unused or recoverable material comes back:

- physical stock increases
- usable stock may increase again
- the return must remain linked to the production issue context

## Purchase order is not stock truth

This is a hard rule:

- purchase request does not change stock
- purchase order does not change stock
- expected inbound does not change stock

They only affect:

- planning
- coverage
- decision UI

Stock truth begins only at receipt.

## Coverage vs movement

This document only defines stock-changing movements.

Coverage is a separate concept:

- it explains what demand is already being served by stock or open supply
- it must not be confused with a stock movement

Example:

- open PO of 10 units may cover changed demand of 8 units
- but stock does not increase until receipt

This distinction must stay explicit in `v2`.

## Decision UI implications

The user must see:

- stock on hand
- available stock
- open inbound
- demand
- shortage delta

For receipts and PO balance, the user must also see:

- ordered quantity
- cumulative received quantity
- cumulative accepted quantity
- cumulative rejected / defective quantity
- remaining open quantity

But only movement-derived values are stock truth.

This prevents users from assuming that "ordered" means "already in warehouse".

## Recommended implementation shape

In code, `v2` should progressively move toward:

- movement type definitions
- a movement service layer
- stock summary selectors that consume movement families
- purchase and production modules that emit normalized movement records

## Definition of done

We can consider this contract adopted when:

1. all raw-material stock-changing actions map to a named movement family
2. purchase receipt edge cases are handled explicitly
3. production issue and return both write normalized movements
4. stock summary uses movement/state truth, not planning assumptions
5. users can distinguish clearly between:
   - demand
   - covered demand
   - ordered inbound
   - physical stock
