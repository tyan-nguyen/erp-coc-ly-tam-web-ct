# ERP V2 NVL Purchase Proposal Model

## Goal

This document defines how `purchase proposal` should behave in `v2` before the full purchasing execution schema is completed.

## Principle

Purchase proposal is a decision layer.

It is not:

- stock truth
- a warehouse movement
- a guaranteed final buy quantity

Its job is to turn visible demand into a reviewable buying decision.

## Two proposal modes

### 1. `LIVE_DEMAND_ONLY`

This mode is used when:

- real demand from production plans is ready
- but stock truth, open inbound, or reusable coverage is not fully connected yet

In this mode:

- proposal quantity is only a review draft
- proposal rows must stay in `DRAFT`
- UI must clearly explain that users still need to review:
  - current stock
  - open purchase commitments
  - reusable coverage from previous procurement

This mode prevents false confidence.

### 2. `FULL`

This mode is used when the cockpit has all required inputs:

- demand
- available stock
- open inbound
- reusable coverage

In this mode:

- proposal quantity can be treated as shortage-based recommendation
- rows with real shortage can move to `CHO_DUYET`

## Proposal row minimum fields

Each proposal row should show:

- material code
- material name
- demand window
- how many plans contribute to this demand
- proposed quantity
- unit
- basis label
- urgency label
- status
- reason
- explanation

## Business rule

When the system is still in `LIVE_DEMAND_ONLY` mode, the user must not mistake a proposal row for a final procurement command.

The UI should explicitly tell them:

- this proposal comes from real demand
- but it still requires procurement review

## Why this matters

This is the safe bridge between:

- planning insight
- actual procurement execution

It lets QLSX and purchasing start using the screen now, while keeping the system honest about what is still missing.
