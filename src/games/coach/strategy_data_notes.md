# Strategy Data Notes

## Purpose

`src/strategy-data/` holds coach-facing poker content that should be easy to tune
without rewriting recommendation logic.

This layer is for:

- spot summaries and objectives
- common mistake notes
- action preferences by spot and broad hand class
- sizing family descriptions
- confidence annotations

It is not for engine legality, state transitions, or deck logic.

## Files

- `spotStrategy.ts`
  - one record per supported `spotKey`
- `actionPreferences.ts`
  - broad action guidance keyed by `spotKey` and `CoachHandClass`
- `sizingFamilies.ts`
  - shared small / medium / large / all-in definitions
- `loader.ts`
  - normalized accessors and fallback-aware lookup helpers

## Record Shapes

### Spot strategy

- `key`
- `label`
- `summary`
- `objective`
- `defaultNotes`
- `commonMistakes`
- `sizingFamilies`
- `confidence`
- optional `relatedConcepts`
- optional `relatedDrillSetIds`

### Action preference

- `id`
- `spotKey`
- `handClass`
- `preferredActions`
- `fallbackActions`
- optional `preferredSizing`
- `note`
- optional `caution`
- `confidence`

### Sizing family

- `key`
- `label`
- `thresholdDescription`
- `teachingNote`
- `typicalUseCases`

## Loading And Lookup Flow

1. `coach.ts` classifies the live spot.
2. `strategyHandClass.ts` maps the hero hand into a broad coaching bucket.
3. `loader.ts` looks up:
   - the spot strategy record
   - the matching action preference record
   - the relevant sizing family
4. The coach blends those data-backed notes with live context such as:
   - inferred range summary
   - blockers
   - pot odds
   - board texture

## Current Coverage

Initial externalized spots:

- `preflop_btn_open_hu`
- `preflop_bb_defend_hu`
- `flop_srp_ip_cbet`
- `flop_srp_oop_defend_vs_cbet`
- `turn_barrel_after_flop_call`
- `turn_checkback_after_cbet`
- `river_bluffcatch_vs_bet`
- `river_value_bet_opportunity`

## Fallback Behavior

If no strategy record or action preference exists:

- recommendation logic still runs
- the app does not crash
- `strategySelection.confidence` is set to `fallback`
- debug mode can show that no externalized record matched

## Debug

Set:

- `localStorage["coach.debugStrategy"] = "1"`

to show strategy debug details in the coach panel:

- spot key
- broad hand class
- confidence
- sizing family
- selected action-preference id

## Limitations

- This is still heuristic coaching, not solver output.
- Hand classes are intentionally broad.
- Coverage is partial and meant to expand gradually.
