# V2 Warehouse Location Model

## Goal

Warehouse location support in `v2` must answer one operational question first:

- which serial is currently stored in which yard / bay

This phase does **not** assume:

- a separate yard for good piles vs defective piles
- a staging outbound area before shipment

The real warehouse flow is:

- piles can be mixed in the same yard
- shipment lifts directly from the current yard to the truck

## Core principle

Warehouse location is a different concern from quality state.

Each pile serial has three separate dimensions:

1. serial identity
2. quality state
3. current yard / location

These dimensions must not be collapsed into a single status.

## Quality state

At the yard-management level, a pile only needs two quality states:

1. `DAT`
2. `LOI`

`LOI` can come from:

1. QC acceptance
2. return flow when the pile is cancelled / scrapped

## Location state

Each serial may point to one `warehouse_location` row through:

- `pile_serial.current_location_id`

The location is only about physical placement, for example:

- `A1`
- `A2`
- `B1`

The system must allow:

- a `DAT` serial and a `LOI` serial to exist in the same yard

## Operational movement picture

### Production confirmation

- warehouse confirms actual production
- system generates `lot` + `serial`
- serial may later be assigned to a yard

### QC

- QC decides whether the serial is `DAT` or `LOI`
- QC does not force a different yard by itself

### Shipment

- warehouse selects serials from their current yard
- once shipped, the serial leaves current inventory
- there is no intermediate staging-yard requirement

### Return

- if a returned serial is accepted back into stock, it can be assigned to a yard again
- if a returned serial is scrapped, it is `LOI` and no longer part of usable stock

## Phase 1 scope

Phase 1 only needs:

1. yard / location master data
2. current serial-to-yard mapping
3. read model by yard
4. read model by serial inside one yard

This is enough to answer:

- yard `A1` currently has which serials
- how many are `DAT`
- how many are `LOI`

## Phase 2 scope

After phase 1 is stable, we can add:

1. assign yard to serial
2. batch move serials between yards
3. scan serial + choose yard
4. later, yard audit / counting

## Data rules

### Source of truth

- current physical yard lives on `pile_serial.current_location_id`
- movement history lives in `pile_serial_history`

### Read model

Yard summary must be derived from serials that are still in current inventory.

Do not count serials that have already left inventory through shipment or scrapping.

### Detail model

When the user opens a yard:

- show exact serial list
- show quality state
- show item label
- show lot
- show note if any

## UI rules

Phase 1 screen should prioritize:

1. yard summary first
2. serial detail only when a yard is selected

This keeps the screen fast even when serial history grows for years.
