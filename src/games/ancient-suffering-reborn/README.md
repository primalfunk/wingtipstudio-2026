# Ancient Suffering

Milestone 2, "The Ash-Crown Curse", expands the original reliquary slice into a map-limited adventure. The player claims the Ash-Crown, identifies its curse, gathers ritual components from generated zone anchors, and can formally seal the relic for victory.

Run regression tests with:

```sh
npm test
```

Create a compact runtime build with:

```sh
npm run build
```

The build is written to `dist/`. From there, run `npm start` and open `http://localhost:4173`.

Run a headless AI simulation with:

```sh
npm run sim -- --seed=demo-reliquary --policy=reliquary --maxSteps=80
```

Available policies:
- `reliquary`: goal-directed policy for the current vertical slice.
- `explorer`: simple bounded exploration policy.

Add `--json` for machine-readable output.
