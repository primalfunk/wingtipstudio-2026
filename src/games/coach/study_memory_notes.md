# Study Memory Notes

This file documents the local persistence layer for saved study data.

## Responsibilities

`src/history/studyStore.ts` is the storage abstraction.

It is responsible for:

- reading and normalizing browser-local study data
- migrating legacy hand-only storage into the current root store
- writing structured records for hands, decisions, drill attempts, and sessions
- providing retrieval helpers for recent and filtered records

`src/history/studyMemory.ts` builds explicit record objects from live-play and drill events.

## Stored Record Shapes

The root store contains:

- `hands`
- `decisions`
- `drillAttempts`
- `sessions`

### Hands

Completed live hands with:

- timestamp
- table and seat info
- initial cards and state
- action/event log
- result summary
- spot/review tags

### Decisions

Each hero decision stores:

- timestamp
- source type (`live` or `drill`)
- hand/scenario linkage
- street
- `spotKey`
- board and hero hand
- pot/effective stack
- action options shown
- user action and sizing
- coach recommendation snapshot
- coach evaluation snapshot
- explanation snapshot
- optional inferred range summary
- lightweight study tags

### Drill Attempts

Each completed drill choice stores:

- timestamp
- scenario id
- drill set id
- `spotKey`
- user action and sizing
- coach evaluation
- explanation snapshot
- recommended mix

### Sessions

Session summaries store:

- start/end timestamps
- mode (`live` or `drill`)
- hands played
- decisions tracked
- drill attempts
- mistakes flagged
- spot breakdown

## Save Triggers

- completed live hands are saved when a hand finishes
- hero decision records are saved immediately after coach evaluation
- drill attempts are saved when a drill action is evaluated
- live and drill session summaries are upserted incrementally as activity happens

## Retrieval Helpers

The store currently exposes helpers such as:

- `getRecentHands(limit)`
- `getRecentDecisions(limit)`
- `getRecentDrillAttempts(limit)`
- `getSessionSummaries(limit)`
- `getHandById(id)`
- `getDecisionById(id)`
- `getDecisionsBySpot(spotKey)`
- `getDrillAttemptsBySpot(spotKey)`

## Limitations

- browser-local only
- no cloud sync or accounts
- no full replay/review UI for decisions yet
- no analytics dashboards yet
- deletion/bookmark tooling is still deeper for hands than for decision/drill records
