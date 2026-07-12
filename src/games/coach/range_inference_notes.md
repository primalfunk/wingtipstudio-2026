# Range Inference Notes

The range inference layer is intentionally heuristic and coaching-oriented.

## State Shape

Each inferred opponent state contains:

- seed metadata
  - `sourcePreflopLine`
  - `position`
  - `initiative`
- normalized class weights
  - `nutted_made`
  - `strong_value`
  - `medium_showdown`
  - `weak_showdown`
  - `strong_draw`
  - `weak_draw`
  - `air`
- structural flags
  - `polarized`
  - `condensed`
  - `capped`
  - `drawHeavy`
  - `showdownHeavy`

## Hand Classes

- `nutted_made`: near-top made hands such as boats, quads, many flushes/straights on coordinated boards
- `strong_value`: strong top-pair+, overpairs, strong trips/two-pair
- `medium_showdown`: one-pair hands that can continue but mostly bluff-catch
- `weak_showdown`: thin pairs and underpairs
- `strong_draw`: flush draws, open-enders, combo draws
- `weak_draw`: gutshots, overcard-heavy floats, weaker draw continues
- `air`: hands with little showdown value and few live draws

## Action Rules

Opponent postflop actions apply explicit multipliers by:

- street
- sizing bucket
- whether the line is passive or aggressive
- whether a raise is a check-raise
- basic board texture

High level behavior:

- checks reduce nutted density and push ranges toward showdown hands
- calls keep medium showdown and draw classes
- small bets stay more merged and condensed
- medium and large bets become progressively more polarized
- check-raises heavily weight strong value and strong draws

## Sizing Buckets

- `none`: no money invested
- `small`: under 40% pot
- `medium`: 40% to under 80% pot
- `large`: 80% pot or larger

## Limitations

- no solver integration
- no combo-perfect equilibrium trees
- no player-specific adaptation
- no exhaustive blocker accounting
- equity is still approximate and Monte Carlo based

The goal is readable coaching language, not solver precision.
