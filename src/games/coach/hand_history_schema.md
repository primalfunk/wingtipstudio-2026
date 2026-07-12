# Hand History Schema

## Storage

- Local only: browser `localStorage`
- Storage key: `coach.handHistory`
- Schema version: `1`
- Retention: newest `60` hands, trimming oldest non-bookmarked hands first

Malformed or missing storage data is treated as empty history and rewritten to a safe shape when possible.

## Saved hand shape

Each saved hand stores:

- `id`
- `version`
- `timestamp`
- `table`
  - `bigBlind`
  - `smallBlind`
  - `startingStack`
  - `startingStackBb`
  - `botStyle`
- `players`
  - `heroName`
  - `villainName`
  - `heroSeat`
  - `villainSeat`
- `initial`
  - private hole cards for both players
  - starting board
  - replay state snapshot
- `events`
  - ordered action events
  - street-transition events
  - showdown event
- `actionLog`
- `summary`
  - winner / outcome
  - showdown / all-in flags
  - final pot
  - stack deltas in chips and BB
  - final stacks
  - coach agreement counts
- `tags`
  - `bookmarked`
  - `spotTags`
  - `reviewTags`

## Replay architecture

Replay does not rerun the coach or the game engine.

Instead it renders from saved snapshots:

1. `initial.state` provides the hand-start frame.
2. Each saved `event` carries a `stateAfter` snapshot.
3. Replay navigation moves a cursor over those events.
4. The current frame is derived from `initial.state` or the selected event snapshot.

This makes all-in runouts and original coach text stable even if coach logic changes later.
