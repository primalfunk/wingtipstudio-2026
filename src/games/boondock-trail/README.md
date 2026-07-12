# Boondock Trail

WO-M2 delivers the canonical core game-state model for the RV solar journey game. The UI shell now reads from one centralized run object with documented policies, phases, derived warnings, clamping, and a temporary state inspector for milestone verification.

## Run

1. `npm install`
2. `npm run dev`
3. Open the local Vite URL shown in the terminal

For a production-style verification build, run `npm run build`.

## Structure

- `src/constants/gameConstants.js`: canonical internal values, thresholds, warning keys, and phase constants.
- `src/state/gameContent.js`: route presets, setup presets, and placeholder option metadata used by the run model.
- `src/state/gameState.js`: canonical run-state creation, reset, mutation, normalization, derived helpers, and debug snapshot functions.
- `src/ui/components.js`: shared layout, status band, route ribbon, action buttons, and selection tiles.
- `src/ui/illustrations.js`: original inline SVG placeholder scene art.
- `src/ui/screens.js`: screen renderers for title, setup, travel, camp, event, town, summary, and end-state views.
- `src/styles.css`: shared presentation system for the shell.
