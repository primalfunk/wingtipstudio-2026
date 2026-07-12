# Drill System Notes

This file documents the lightweight scenario drill system.

## Scenario Schema

Each drill scenario includes:

- `id`
- `spotKey`
- `title`
- optional `teachingNote`
- optional `focusArea`
- `effectiveStackBb`
- `blinds`
- `heroPosition`
- `villainPosition`
- `heroHole`
- `board`
- `pot`
- `heroCommitted`
- `botCommitted`
- `heroStack`
- `botStack`
- `currentBet`
- optional `minRaiseAmount`
- `street`
- `toAct`
- `actionHistory`
- `legalActions`

The schema maps directly into a single injected decision state. It is not a full hand generator.

## Drill Runner Flow

1. User selects a drill pack.
2. Runner loads one predefined scenario into the existing UI.
3. Hero takes one action at the decision point.
4. Existing coach recommendation and evaluation logic judge the action.
5. Feedback is shown immediately.
6. User advances to the next scenario.

## Pack Grouping

Drill packs are grouped by `spotKey` plus one mixed starter pack:

- preflop open
- preflop defend
- flop c-bet
- flop defend vs c-bet
- turn barrel
- river bluff-catcher

## Integration

- scenarios are validated against the spot classifier
- evaluations use the existing coach and range-inference stack
- results are stored in-memory on the drill session with:
  - `scenarioId`
  - `spotKey`
  - chosen action and size
  - evaluation tone
  - verdict/explanation
  - recommended mix snapshot

## Limitations

- no persistence yet
- no random generation yet
- no branching drill trees
- no advanced drill analytics yet

The system is intentionally lightweight so it can support future persistence, progress tracking, and larger scenario libraries.
