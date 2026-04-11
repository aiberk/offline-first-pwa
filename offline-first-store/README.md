# Offline-First Zustand Store  -  Sync Import, Demo Mode, and Persistence Bridge

## Problem

The app needs a global state store that: loads from IndexedDB on boot, persists every mutation back to IndexedDB, handles P2P sync imports (replacing all data atomically), supports a demo mode with pre-loaded data, and manages complex cross-entity operations (creating a resume auto-populates from user defaults, deleting a clause removes it from all resumes, etc.).

## Solution

A Zustand store with ~40 actions that bridges the UI layer to the IndexedDB persistence layer. Every action follows the pattern: mutate state → persist to storage. The `initialize()` function handles three boot paths: sync import, demo mode, or normal load.

### Boot Sequence (`initialize`)

```
1. Check localStorage for "sync-import" data (from P2P sync)
   → If found: resetAllData() → bulk import → clear flag → load from DB
2. Check if demo mode is active
   → If yes: load demo data constants
3. Normal boot
   → Load all entities from IndexedDB in parallel
```

### Cross-Entity Operations

- `createResume()`  -  creates a resume pre-populated with the user's saved defaults (header, education, skills, achievements, leadership) loaded from IndexedDB settings
- `toggleResumeClause()`  -  adds/removes a clause from a resume's selected clauses, persists immediately
- `deleteClause()`  -  removes from the clauses table AND from every resume that references it
- `deleteCategory()`  -  removes from categories AND strips the category ID from all clauses that reference it
- `runAudit()`  -  takes a resume, resolves its selected clauses, runs the ATS auditor, saves the report to IndexedDB, updates state

### Persistence Pattern

Every mutation follows:

```typescript
set((state) => ({ clauses: [...state.clauses, newClause] }));
await storage.saveClause(newClause);
```

State updates are synchronous (instant UI), persistence is async (non-blocking). If persistence fails, the UI still works for the session  -  data is in memory.

## Key Design Decisions

- **Zustand over Redux/Context**  -  minimal boilerplate, no providers, works with async actions natively
- **Optimistic updates**  -  state mutates first, then persists. UI is never blocked by IndexedDB writes.
- **Parallel initialization**  -  all entity types load concurrently via `Promise.all`, not sequentially
- **Sync import as atomic reset**  -  P2P import doesn't merge, it replaces. Avoids conflict resolution complexity entirely.
- **User defaults from settings**  -  resume defaults are stored as a JSON blob in the settings key-value store, loaded once at resume creation time

## Concepts Demonstrated

- Zustand store with async persistence
- Offline-first architecture (IndexedDB + in-memory state)
- Cross-entity referential integrity in a client-side store
- Multi-path initialization (sync import / demo / normal)
- Optimistic state updates with async persistence
