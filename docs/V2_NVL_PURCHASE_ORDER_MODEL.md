# ERP V2 NVL Purchase Order Model

## Goal

This document defines the first `purchase order` model for NVL in `v2`.

## Principle

Purchase order is:

- a vendor commitment
- a procurement execution document
- the parent document for multi-batch receipts

It is not stock truth.

## Input

A PO draft should normally come from an existing purchase request draft or approved purchase request.

This keeps traceability:

- demand cockpit
- purchase request
- purchase order

## Minimum PO header fields

- `po_code`
- linked `request_id`
- linked `request_code`
- `vendor_name`
- `expected_date`
- `status`
- `source_mode`
- `note`

## Minimum PO line fields

- `po_id`
- `request_id`
- `request_line_id`
- `line_no`
- `material_code`
- `material_name`
- `unit`
- `ordered_qty`
- `status`
- `reason`
- `payload_json`

## Statuses

- `DRAFT`
- `DA_GUI_NCC`
- `XAC_NHAN_MOT_PHAN`
- `DA_NHAN_MOT_PHAN`
- `DA_NHAN_DU`
- `HUY`

## Business rule

One PO may be received in many batches.

That means:

- PO remains open while receipts are still incomplete
- receipt totals must be accumulated
- over-delivery or under-delivery must remain visible at PO level

## Why this matters

The system must separate:

- proposal decision
- vendor commitment
- warehouse receipt truth

Without that separation, the user cannot clearly tell:

- what was proposed
- what was actually ordered
- what has physically arrived
