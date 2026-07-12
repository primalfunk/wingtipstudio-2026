# Hold'em Coach Capability Expansion Plan

## Purpose

This document defines how to expand the personal Hold'em coach from a playable heads-up trainer into a stronger decision-coaching tool. It is written to guide implementation work by Codex. It is not a release plan, product pitch, or startup roadmap. It is an operating document for choosing and sequencing work.

## Source Context

The current application already includes:

- a functioning browser-only HU NLHE engine
- legal action enforcement and showdown handling
- a hand evaluator
- Monte Carlo equity estimation
- a coach recommendation layer
- a heuristic bot using the same recommendation engine
- glossary and UI support

The current weaknesses are also clear:

- coaching is heuristic and only lightly range-aware
- the app has no persistence, replay, or structured study loop
- there are no drills, curricula, or spot libraries
- opponent modeling is shallow
- strategy knowledge is embedded in JS logic rather than represented as configurable data
- engineering infrastructure is intentionally lightweight

## Guiding Objective

Make the coach materially better at teaching poker decisions in context.

That means prioritizing:

1. better spot understanding
2. better feedback quality
3. deliberate practice instead of random occurrence
4. memory of what the user studied and where they struggle
5. architecture that lets strategy content improve without hardcoding everything deeper into conditionals

## Core Principle

Teach the **spot** first, then the **action**.

The current system can recommend an action. The next system should first identify what strategic node the player is in, then explain the role of the hand class inside that node.

Examples:

- single-raised pot BTN c-bet spot
- BB defend on low connected flop
- turn barrel after flop c-bet gets called
- river bluff-catcher facing polar sizing
- limped pot stab opportunity

Each coaching message should increasingly answer:

- What spot is this?
- What are both players generally trying to do here?
- What hand classes want to continue aggressively?
- What hand classes mostly realize equity or bluff-catch?
- What sizing family fits the spot?
- What beginner mistake is common here?

## Expansion Themes

### Theme 1: Structured Spot Coaching

Target outcome: coaching becomes more transferable and less hand-specific.

Add a spot-classification layer that tags the decision node before recommendation logic runs. The tag should combine:

- street
- pot type
- position
- initiative
- prior action pattern
- basic board class
- facing action or unopened state

Example spot keys:

- `preflop_btn_open_hu`
- `flop_srp_ip_cbet_dry_high`
- `flop_srp_oop_defend_low_connected`
- `turn_barrel_after_flop_call`
- `river_bluffcatch_vs_large_bet`

This layer should drive:

- explanation templates
- common-mistake notes
- drill grouping
- progress metrics
- future strategy-data lookup

### Theme 2: Scenario Drills

Target outcome: important decisions become repeatable instead of waiting for live-play occurrence.

Implement drill modes built from saved scenario definitions. Begin with a small set of high-frequency, teachable spots:

1. preflop open / defend quiz
2. flop c-bet trainer
3. flop defend-vs-c-bet trainer
4. turn barrel / check-back trainer
5. river bluff-catcher trainer

Each drill scenario should include:

- stack depth
- blinds
- positions
- hole cards
- board state if postflop
- pot size
- prior action sequence
- hero to act
- optional intended teaching note
- expected spot tag

The user flow should be fast:

- present spot
- choose action and size
- receive evaluation
- see explanation
- move to next similar spot

### Theme 3: Range Inference Upgrade

Target outcome: the coach stops using only coarse preflop assumptions and starts narrowing ranges through the hand.

Implement a lightweight range-tracking system that updates action-conditioned hand-class weights across streets.

Do not attempt full solver-style node trees. Use practical buckets.

Recommended representation:

- start from preflop range seed
- map combos into coarse postflop hand classes
- update class weights based on action taken
- derive explanation and equity framing from weighted classes

Useful classes:

- nutted made hands
- strong value
- medium showdown
- weak showdown
- strong draws
- weak draws
- air / give-ups

This should support better feedback such as:

- villain is becoming more polarized
- this line retains many one-pair hands
- your hand blocks natural bluffs
- this sizing is better against condensed ranges

### Theme 4: Study Loop and Memory

Target outcome: the tool becomes usable as a study companion, not only a live table toy.

Add local persistence for:

- session summaries
- individual hand histories
- decision records
- drill attempts
- bookmarked mistakes

Then add review tools:

- hand replay
- node-by-node review
- mistake list
- saved interesting hands
- repeat similar spot

Track performance by concept rather than only aggregate coach agreement.

Recommended dimensions:

- preflop
- c-bet spots
- check-back discipline
- river bluff-catching
- betting size choice
- overfold / overcall tendencies
- bluff selection

### Theme 5: Strategy Data Externalization

Target outcome: strategy content becomes tunable and versionable.

Move strategy knowledge out of deeply embedded JS conditionals into data/config artifacts.

What should become data first:

- spot definitions
- action preferences by spot and hand class
- sizing families
- default teaching notes
- common mistakes
- confidence annotations
- drill definitions

Do not try to externalize every rule at once. Keep engine legality and core state transitions in code. Move coach-facing strategy content into data progressively.

### Theme 6: Opponent Archetypes for Training

Target outcome: bots become teaching instruments rather than just style sliders.

Replace or augment passive/balanced/aggressive with recognizable training villains:

- station
- nit
- maniac
- fit-or-fold
- straightforward reg
- tricky reg

Each archetype should express:

- preflop looseness / tightness
- aggression tendencies
- bluff frequency bias
- overfold / overcall patterns
- c-bet frequency bias
- raise frequency bias

The coach can then teach exploit adjustments in plain language.

## Priority Order

### Priority 1: Strengthen coaching quality inside current HU scope

Work on these first:

1. spot classification
2. scenario data model and drill mode
3. local persistence for decisions and scenarios
4. range inference upgrade
5. replay / review support

Reason: this produces the biggest increase in coaching value without multiplying game-format complexity.

### Priority 2: Make strategy content maintainable

Next:

1. strategy-data files
2. explanation templates by spot
3. progress metrics by concept
4. test coverage around coaching and engine boundaries

Reason: after this, future expansions become less brittle.

### Priority 3: Enrich training variety

After the above:

1. opponent archetypes
2. lesson bundles / curated study packs
3. additional drill categories
4. optional broader formats if still desired

Reason: variety is most useful once the coach can actually teach consistently and remember performance.

## Explicit Non-Priorities For Now

Avoid spending early cycles on:

- 6-max support
- tournament support
- ICM
- online accounts / backend
- telemetry / analytics stacks
- production infrastructure beyond lightweight tests and code organization

Those may become useful later, but they do not currently offer the best return for a personal coaching tool.

## Proposed Target Architecture Direction

Keep and respect the strongest current separation:

- `engine`
- `coach`
- `bot`
- `ui`

Add the following conceptual layers without overengineering:

- `spot/` for spot classification and taxonomy
- `strategy-data/` for JSON or JS data artifacts
- `history/` for persistence and replay serialization
- `drills/` for scenario definitions and drill orchestration
- `progress/` for concept metrics and summaries

Possible future layout:

```text
js/
  engine/
  coach/
  bot/
  ui/
  spot/
  drills/
  history/
  progress/
  strategy-data/
```

The point is not to rebuild everything immediately. The point is to stop adding major new capability directly into the current global-conditionals style.

## Working Method For Codex

When doing implementation work:

1. prefer thin, reversible increments
2. preserve current playability at all times
3. avoid simultaneous large refactors and feature additions
4. make new coaching concepts visible in the UI early
5. add fixtures/tests around engine legality and new classification logic
6. represent strategic assumptions explicitly where possible

## Decision Standard

A proposed feature is good if it does at least one of the following:

- makes the coach more accurate about the spot
- makes the explanation more reusable as a concept
- makes important situations repeatable via drills
- makes mistakes reviewable later
- makes future strategy updates easier

A proposed feature is weak if it mostly:

- adds surface area without improving instruction quality
- adds a new poker format while keeping shallow heuristics
- increases UI complexity without improving study flow

## Immediate Direction

The first work should establish the minimum infrastructure for **spot-based coaching** and **repeatable scenarios**.

That means the first implementation target is not a giant strategy rewrite. It is a practical wedge:

- introduce a spot taxonomy
- classify a small initial set of spots
- define a scenario schema
- add a basic drill mode that can run a scenario and evaluate the hero decision

Once that exists, the rest of the expansion becomes easier to build around.
