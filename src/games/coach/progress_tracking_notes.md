# Progress Tracking Notes

## Purpose

The progress layer turns saved decision history into concept-level study feedback.
It is intentionally simple and deterministic.

## Files

- `src/progress/concepts.ts`
  - concept definitions
- `src/progress/progressTracker.ts`
  - decision-to-concept mapping
  - aggregation
  - weak/best concept helpers
  - drill recommendations

## Concept Definitions

Initial concepts:

- `preflop_opening`
- `preflop_defending`
- `flop_cbet`
- `flop_defend_vs_cbet`
- `turn_barrel`
- `turn_checkback`
- `river_bluffcatch`
- `river_value_bet`
- `bet_sizing`
- `bluff_selection`
- `overfold_tendency`
- `overcall_tendency`

Each concept includes:

- `id`
- `label`
- `description`
- `relatedSpotKeys`
- optional `drillPackIds`

## Mapping Rules

Primary mapping is spot-based:

- `preflop_btn_open_hu` -> `preflop_opening`
- `preflop_bb_defend_hu` -> `preflop_defending`
- `flop_srp_ip_cbet` -> `flop_cbet`
- `flop_srp_oop_defend_vs_cbet` -> `flop_defend_vs_cbet`
- `turn_barrel_after_flop_call` -> `turn_barrel`
- `turn_checkback_after_cbet` -> `turn_checkback`
- `river_bluffcatch_vs_bet` -> `river_bluffcatch`
- `river_value_bet_opportunity` -> `river_value_bet`

Secondary mappings:

- aggressive or sized actions -> `bet_sizing`
- aggressive flop c-bet / turn barrel decisions -> `bluff_selection`
- bad or mixed folds -> `overfold_tendency`
- bad or mixed calls -> `overcall_tendency`

## Aggregation Logic

Saved decisions are grouped by concept and counted as:

- `good` -> correct
- `mixed` -> acceptable
- `bad` -> mistake

Per-concept summaries include:

- total attempts
- correct / acceptable / mistake counts
- success rate = `(correct + acceptable) / total`
- mistake rate = `mistake / total`
- recent success rate over the latest window when enough data exists
- trend label: improving / flat / slipping / insufficient_data

## Data Source

The tracker uses saved decision records from `studyStore`.
Drill attempts are not aggregated separately because drill actions already create
saved decision records with `sourceType: "drill"`.

## Drill Recommendations

Weak concepts with linked drill packs can suggest practice packs directly.
This is intentionally lightweight and does not create an adaptive curriculum.

## Limitations

- No advanced statistical modeling
- No solver-backed grading
- Trend signals are simple recent-versus-overall comparisons
- Concepts are broad by design and should expand gradually
