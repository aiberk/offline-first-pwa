# Offline Persistence Layer  -  IndexedDB with Typed Error Hierarchy

## Problem

The app runs entirely in the browser with no backend. All user data (resumes, work experience, jobs, recruiters, audit reports, settings) must persist across sessions using IndexedDB. Needs to handle storage unavailability (private browsing), corrupted data, and schema migrations  -  without crashing the app.

## Solution

A Dexie-based persistence layer with a typed error hierarchy and per-entity CRUD operations. Every storage operation is wrapped in error handling that distinguishes between "storage unavailable" and "data corrupted"  -  the app can show different recovery UIs for each.

### Database Schema (`JobTrackerDB`)

Seven tables with auto-incrementing or explicit string keys:

- `clauses`  -  work experience entries with bullet points
- `categories`  -  grouping for clauses
- `resumes`  -  resume documents with selected clauses
- `jobs`  -  job listings being tracked
- `recruiters`  -  recruiter contacts
- `resumeVersions`  -  version history per resume (compound index on `[resumeId+versionNumber]`)
- `auditReports`  -  AI audit results per resume
- `settings`  -  key-value store for defaults, preferences

### Error Hierarchy

```
StorageError (base)
├── StorageUnavailableError   -  IndexedDB blocked (private browsing, etc.)
└── CorruptedDataError        -  data exists but can't be parsed/loaded
```

Every storage function catches at the boundary and wraps in the appropriate error type. The store layer can then show "storage unavailable" vs "data corrupted" with different recovery actions.

### Sync Import Bridge

The `resetAllData()` function handles the P2P sync import flow: checks `localStorage` for `sync-import` data, clears all existing tables, then bulk-inserts the received data. This is the bridge between the WebRTC sync layer and the persistence layer.

## Key Design Decisions

- **Dexie over raw IndexedDB**  -  Dexie provides typed tables, schema versioning, and a promise-based API. Raw IndexedDB is callback hell.
- **Per-entity save functions**  -  `saveClause()` vs `saveClauses()`. Single-entity saves use `put()` (upsert), bulk saves use `bulkPut()` with `allKeys: true` for atomicity.
- **Error wrapping at the boundary**  -  storage functions never throw raw Dexie errors. The store layer always gets a `StorageError` subclass.
- **Settings as key-value**  -  resume defaults, preferences, and feature flags all go through `loadSetting(key)` / `saveSetting(key, value)`. No schema migration needed for new settings.
- **Version history with compound index**  -  `[resumeId, versionNumber]` enables efficient queries for "all versions of resume X" and "next version number for resume X".

## Concepts Demonstrated

- IndexedDB persistence with Dexie ORM
- Typed error hierarchy for storage failure modes
- Schema versioning and migration
- Bulk operations with atomicity guarantees
- Cross-feature data bridge (sync import → persistence)
