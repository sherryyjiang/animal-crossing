# Local Storage Approach (IndexedDB)

## Goal
Select a browser storage library that keeps the memory system reliable and easy to evolve, with a safe fallback when IndexedDB is unavailable.

## Options Considered

### `idb` (lightweight promise wrapper)
**Pros**
- Small footprint and minimal API surface.
- Straightforward to wrap with typed helpers.
- Easy to keep close to the native IndexedDB model.

**Cons**
- Less ergonomic for complex queries.
- Requires more manual transaction management.

### `dexie`
**Pros**
- Rich querying and declarative schema.
- Great developer ergonomics for larger datasets.
- Built-in upgrade/version helpers.

**Cons**
- Heavier dependency for this project size.
- More abstraction than needed for simple key/value stores.

## Decision
**Choose `idb` for Iteration 2**, with a thin typed wrapper to keep the API consistent. The current data needs are modest (per-NPC logs and memory records), and `idb` keeps the bundle small while still providing reliable IndexedDB access.

## Fallback Plan
- If `indexedDB` is missing or open fails, use `localStorage`.
- Provide a single storage interface that selects the backend at runtime.
- Store serialized JSON in `localStorage` with versioned keys.
- On IndexedDB recovery, migrate from `localStorage` if present.

