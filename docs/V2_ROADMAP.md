# ERP V2 Roadmap

## Phase 0

Set up rebuild workspace and architecture baseline.

Done:

- separate workspace created
- v2 architecture docs created
- feature skeleton created

## Phase 1

Shared foundation.

- navigation shell
- auth/session handling
- common table/filter patterns
- mutation feedback pattern

## Phase 2

Master data.

- customers
- projects
- suppliers
- materials
- pile templates
- auxiliary rate/config masters

## Phase 3

Bóc tách and báo giá.

- draft/save/send/approve flow
- quote generation from approved estimates

## Phase 4

Order and production preparation.

- order list/detail
- production planning inputs

Checkpoint before Phase 5:

- lock finished-goods inventory architecture
- align production/QC/shipment/return rules to one inventory contract

## Phase 5

Serial-native execution.

- warehouse actual production confirm
- production lot creation
- pile serial generation
- QR labels
- QC by serial

## Phase 6

Shipment and return.

- order-based shipment
- retail shipment
- shipment by serial
- return request by business
- returned serial confirmation by warehouse

## Phase 7

Finished goods inventory.

- summary inventory
- drill-down by item
- serial detail
- legacy serial reconciliation
- warehouse location support

## Definition of done for each phase

1. business flow matches agreed rules
2. list and detail loading are separated
3. no unnecessary full-page refresh after small actions
4. lint and typecheck pass
5. test notes are written before moving on
6. parity and role-flow checklist are updated:
   - `docs/V2_V1_PARITY_AUDIT.md`
   - `docs/V2_ROLE_FLOW_TEST_CHECKLIST.md`
- `docs/V2_KTBH_TEST_RUNBOOK.md`

## Architecture checkpoints

Before continuing deep into production and stock-related rebuild work, the team should review:

- `docs/V2_FINISHED_GOODS_INVENTORY_ARCHITECTURE.md`
- `docs/V2_INVENTORY_MOVEMENT_CONTRACT.md`
- `docs/V2_LEGACY_RECONCILIATION.md`
- `docs/V2_WAREHOUSE_LOCATION_MODEL.md`
- `docs/V2_NVL_ARCHITECTURE.md`

## Next architecture track

After finished-goods stock is stable, the next major architecture track is raw-material inventory.

Key rule:

- planning is a decision input, not stock truth

Raw-material rebuild must separate:

1. demand and planning snapshots
2. procurement coverage and open inbound
3. physical warehouse stock truth

The reference document for this track is:

- `docs/V2_NVL_ARCHITECTURE.md`
- `docs/V2_NVL_MOVEMENT_CONTRACT.md`

Inventory-counting and opening-balance work for this track must also follow:

- `docs/V2_INVENTORY_COUNTING_MODEL.md`
- `docs/V2_INVENTORY_COUNTING_SCHEMA_CONTRACT.md`
