# ERP V2 NVL Demand Cockpit

## Goal

This document defines the first decision screen for raw-material planning in `v2`.

The cockpit is not a warehouse ledger screen.

It is a decision screen for:

- QLSX
- purchasing
- approvers

Its purpose is to help users answer:

- what is currently needed
- what is already covered
- what is still missing
- whether buying again would be redundant

## Why this screen exists

If the system only shows production plans, users will buy twice when plans change.

If the system only shows warehouse stock, users will miss already-open supply.

This screen must combine:

1. demand
2. current stock
3. open inbound
4. reusable coverage
5. delta and recommendation

## Primary decisions supported

The cockpit should support decisions such as:

- do not buy more because open inbound already covers changed demand
- buy a shortage now because stock plus inbound is not enough
- expect surplus because earlier buying now exceeds the revised plan
- escalate because receipt timing will miss the need date

## Main row fields

Each material row should show:

- material code and name
- planning window
- total demand
- current stock
- available stock
- open inbound
- reusable coverage
- uncovered shortage
- projected surplus
- recommendation
- explanation

## Recommendation language

The recommendation column should be human-readable.

Examples:

- `Không cần mua thêm`
- `Cần mua thêm 12`
- `Dư 5, theo dõi tiêu thụ`
- `Rủi ro giao chậm`

## Explanation language

Examples:

- `Đã có 10 đang mua, nhu cầu hiện tại 8.`
- `Tồn khả dụng 3, open inbound 5, nhu cầu 20 => thiếu 12.`
- `Nhu cầu giảm sau đổi kế hoạch, lượng đã đặt hiện dư 5.`

## Filters required

The cockpit should support:

- date window
- material group
- material search
- status: covered / shortage / surplus / risk

## Drill-down required

When opening one material, users should see:

- which plans or quotes create the demand
- which PR or PO already cover it
- what is in stock now
- what is still on the road
- why the recommendation is what it is

## First implementation scope

Phase 1 does not need to compute everything perfectly yet.

It should already establish the layout and vocabulary:

- demand
- stock
- inbound
- coverage
- delta
- recommendation

This is enough to guide the next build steps for:

- purchase requests
- purchase orders
- receipts
- material stock truth

