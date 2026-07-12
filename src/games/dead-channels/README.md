# Dead Channels

Dead Channels is an HTML5/Phaser browser game where typing is the control system. You stabilize moving text streams, choose route forks by typing branch phrases, manage hazards and instability, use tactical powerups, and build run identity through upgrades.

This is a local public-playtest release candidate. Progress is saved locally in this browser/device using `localStorage`; it does not sync across devices and can be lost if browser storage is cleared.

## Setup

```bash
npm install
npm run dev
npm run build
npm run preview
```

Optional content check:

```bash
npm run validate-content
```

## Controls

- `Enter`: begin / advance / confirm
- Type letters: resolve the active phrase
- `Backspace`: remove the most recent correct character
- `Escape`: return to menu or leave menu overlays
- `Tab`: switch focused stream in multi-stream encounters
- `1`, `2`, `3`: activate active powerups or choose rewards
- `F3`: toggle debug overlay
- `R`: restart same seed from summary
- `N`: restart new seed from summary
- `C`: copy run report from summary when clipboard is available

Menu controls:

- `T`: tutorial
- `D`: cycle difficulty mode
- `P`: profile screen
- `A`: archive collection
- `M`: reduce motion
- `G`: reduce glow
- `H`: high contrast
- `X`: text scale
- `S`: screen shake

## Current Features

- Complete seeded runs with finale win/loss
- Single-stream typing core
- Branching route forks
- Multi-stream priority encounters
- Hazards and cognitive debt
- Tactical powerups
- Run upgrades and classes
- Data-driven phrase/content selection
- Local profile persistence, archive collection, unlocks, and run history
- Visual accessibility options
- Music loops and minimal gameplay/menu sound effects
- Short onboarding tutorial
- Beginner, Standard, and Redline difficulty modes

## Playtest Focus

Useful feedback:

- Does the current target character stay obvious under pressure?
- Do forks and multi-stream encounters feel readable?
- Does the first run feel survivable on Beginner?
- Which phrases feel too long or unclear?
- Are hazards interesting without feeling unfair?
- Are powerups/upgrades understandable when offered?

Suggested test length: 2-3 complete runs, including one Beginner or Redline run.

## Known Prototype Limitations

- Audio settings/mixing are first-pass only.
- Challenge modifiers are persisted/unlocked but not fully selectable or gameplay-active.
- Save export/import exists at the manager level but has no full UI.
- The summary screen is dense because it exposes many playtest stats.
- Large production JS bundle warning is expected because Phaser is bundled directly.
