# Opponent Archetypes Notes

## Purpose

The archetype layer gives the training bot recognizable opponent profiles and
lets the coach reference exploit ideas against them.

## Files

- `src/bot/archetypes.ts`
  - archetype definitions
  - legacy style normalization
  - coach-facing exploit note helper
- `src/strategy/bot.ts`
  - probability and sizing adjustments driven by archetype modifiers

## Archetypes

Current core profiles:

- `station`
- `nit`
- `maniac`
- `fit_or_fold`
- `straightforward_reg`
- `tricky_reg`

Legacy values are still normalized for compatibility:

- `balanced` -> `straightforward_reg`
- `passive` -> `fit_or_fold`
- `aggressive` -> `maniac`

## Behavior Modifiers

Each profile includes:

- `preflopLooseness`
- `aggressionLevel`
- `bluffFrequencyBias`
- `callingTendency`
- `foldingTendency`
- `cBetFrequencyBias`
- `raiseFrequencyBias`

These act as lightweight multipliers over the existing heuristic bot logic.

## Integration Points

- The bot still starts from `recommend(state, "bot")`.
- Archetype modifiers then shift:
  - preflop continue width
  - postflop aggression
  - bluff frequency
  - calling/folding behavior
  - bet/raise sizing bias

The coach uses the active archetype to add exploit-focused guidance to hero
recommendations.

## UI

The settings panel exposes a selectable archetype dropdown plus a short
description.

Debug:

- `localStorage["coach.debugArchetypes"] = "1"`

shows parameter summaries in the settings text and coach context pills.

## Limitations

- This is still heuristic and lightweight.
- Archetypes bias behavior; they do not create full opponent models or solver trees.
- The goal is training clarity and exploit practice, not realism-for-its-own-sake.
