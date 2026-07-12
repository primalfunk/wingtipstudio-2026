# Spot Taxonomy

This file documents the current spot classification layer used by the coach.

## Spot Object

Every classified hero decision returns a structured object:

```ts
{
  key,
  label,
  street,
  position,
  potType,
  initiative,
  facingAction,
  texture,
  priorActionPattern,
  metadata
}
```

`metadata` repeats the core fields in one nested object for downstream systems.

## Starter Taxonomy

- `preflop_btn_open_hu`
- `preflop_bb_defend_hu`
- `flop_srp_ip_cbet`
- `flop_srp_oop_defend_vs_cbet`
- `turn_barrel_after_flop_call`
- `turn_checkback_after_cbet`
- `river_bluffcatch_vs_bet`
- `river_value_bet_opportunity`
- `unknown`

## Classification Rules

High level rules:

- unopened heads-up button decision -> `preflop_btn_open_hu`
- big blind facing button open -> `preflop_bb_defend_hu`
- single-raised flop, hero in position with initiative and no bet to face -> `flop_srp_ip_cbet`
- single-raised flop, hero out of position facing c-bet -> `flop_srp_oop_defend_vs_cbet`
- turn after hero flop c-bet gets called and villain checks:
  - safer / simpler turns -> `turn_barrel_after_flop_call`
  - wetter / more slowdown-prone turns -> `turn_checkback_after_cbet`
- river facing a bet -> `river_bluffcatch_vs_bet`
- river checked to hero -> `river_value_bet_opportunity`

## Texture Hooks

Current coarse texture buckets:

- `dry_high`
- `low_connected`
- `paired`
- `two_tone`
- `monotone`
- `neutral`

## Limitations

- only a small starter taxonomy is implemented
- spot keys are intentionally coarse
- turn barrel vs checkback is still heuristic rather than strategy-data driven
- unsupported states return `unknown`

The intent is to provide a stable, readable foundation for drills, progress tracking, history tagging, and future strategy-data lookup.
