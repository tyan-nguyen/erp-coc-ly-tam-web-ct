# ERP V2 NVL Receipt Model

## Goal

This document defines the first `receipt` model for NVL in `v2`.

## Principle

Receipt is:

- a warehouse inbound document
- a batch-specific receipt record
- the bridge from PO into stock truth

Receipt is not:

- the same thing as PO
- guaranteed to match ordered quantity
- a single-batch assumption

## Multi-batch rule

One PO may produce many receipts.

Examples:

- batch 1
- batch 2
- batch 3

This is required for:

- sand
- stone
- bulk materials
- staggered deliveries

## Receipt line truth

Each receipt line must be able to store:

- ordered quantity
- received quantity
- accepted quantity
- defective quantity
- rejected quantity

The actual measured or weighed quantity at receipt is the truth for that batch.

## Business meaning

- `received_qty`: what physically came on that batch
- `accepted_qty`: what warehouse accepts into usable stock
- `defective_qty`: what came but is defective
- `rejected_qty`: what is not accepted

## Why this matters

This is how the system can support:

- under-delivery
- over-delivery
- partial receipt
- quality issues
- cumulative PO balance

## Future stock truth link

Only accepted receipt quantities should later generate:

- `PURCHASE_RECEIPT_ACCEPTED`

Defective or rejected quantities must stay visible in procurement and receipt history, but must not inflate usable stock.
