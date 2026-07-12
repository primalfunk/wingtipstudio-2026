# Space Surveyor

Space Surveyor is a retro-inspired 2D space exploration and combat game. Pilot a survey ship through procedurally generated sectors, dodge gravity wells, deliver survey data, and fight off raiders while your hidden beacon exposure quietly reshapes the universe.

## Highlights

- Deterministic sector generation with a persistent world seed.
- Ring-based difficulty escalation and zone tuning.
- Beacon Relic system that biases future sector generation.
- Calibration Gates with distinct visuals and gameplay effects.
- Fuel management, score multipliers, and high-score leaderboard.
- Local persistence via `localStorage` (no backend required to play).

## Recent Updates

- Autopilot now resists gravity wells, prioritizes nearby pursuers, and avoids throttle chatter.
- Upgrade Station menu includes a selectable Close button.
- Alert HUD visuals now feature scanline interference, a pulsing halo, and a flare sweep.

## Gameplay Loop

1) Explore a sector and locate the survey goal.
2) Deliver the survey to the end zone to complete the sector.
3) Earn score, increase the multiplier, and refuel.
4) Push to new rings for tougher hazards, enemy patrols, and rarer content.

## Beacon Relic (Signal Origin Sectors)

Signal Origin sectors are rare and only appear once the player reaches a minimum ring distance with a cooldown on new-sector generation. These sectors contain a Beacon Relic:

- Non-collectible, fixed-position relic.
- Observer zone tracks time spent near the relic.
- Exposure is hidden and persistent.
- Higher exposure influences future sector types, moods, and scan output.

Persistence is stored in `localStorage` so the world keeps its continuity across sessions.

## Calibration Gates

Calibration Gates are dynamic runtime objects that can appear in eligible sectors:

- Spawned at time intervals (not deterministic across visits).
- Only one non-chain gate active at a time.
- Spawn within player view and avoid star gravity wells.
- Fade in/out; no proximity-based pulsing.

Gate types (current):

- Chain Gate: 3-9 gates in a gentle arc. Each pass awards increasing points.
- Displacement Gate: Repositions ship near goal/end zone, aligns heading, clamps speed.
- Exit Alignment Gate: Aligns ship heading toward the end zone and sets exit speed.
- Shutdown Gate (red): Temporarily disables controls while preserving velocity.

## Persistence & Determinism

- `worldSeed` is stored per world and used to generate sectors.
- Minimal sector metadata is persisted; entities are regenerated deterministically.
- Start screen behavior:
  - Space = continue current world.
  - Shift+Space = reset world (new seed, clears history).

## Controls

- Movement: WASD or Arrow keys
- Fire: Space
- Zoom: Z (out), X (in), mouse wheel (optional)
- Quit when stranded: Q (when out of fuel)
- Return to start: Esc

## Scoring

- Asteroids, enemy ships, fuel pickups, and surveys all grant points.
- Each completed survey increases the multiplier by 1.
- Gates award points per pass; chain gates scale upward per gate.

Scoring values are defined in `src/game/config.js` under `SCORE` and `CALIBRATION`.

## Configuration

All tunables are centralized in `src/game/config.js`, including:

- Speeds, cooldowns, and probabilities
- Audio volumes and track lists
- Sector generation rules
- HUD colors and typography
- Visual effect timings

## Project Structure

```
/
  index.html
  src/
    game/
      config.js
      gameLoop.js
      sectorManager.js
      ...
    entities/
    ui/
  assets/
    ui/sprites/
    sounds/mp3/
  api/
    bootstrap.php
    score/index.php
    schema.sql
  .env.example
```

## Local Development

### Static (no leaderboard)

Serve the project root with any static server:

```
npx http-server
```

Then open `http://localhost:8080/`.

### PHP + MySQL (leaderboard)

1) Copy `.env.example` to `.env` and add credentials:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=game_scores
DB_USER=game_user
DB_PASS=your_password_here
```

2) Run the SQL in `api/schema.sql` in your MySQL client.
3) Start the PHP server:

```
php -S localhost:8000
```

Open:
- `http://localhost:8000/`
- `http://localhost:8000/api/score/`

Note: Some PHP setups require a trailing slash for directory index resolution.

## API Endpoints

- `GET /api/score`
  Returns the top 10 leaderboard entries.

- `POST /api/score`
  Body: `{ "name": "AAA", "score": 1234 }`

Leaderboard rules are enforced server-side:

- Scores are integers; minimum qualifying score is 100.
- Top 10 only, sorted by score (desc), then newest first.
- Ties replace the existing 10th place entry.
- Names are uppercased, filtered to `[A-Z0-9_]`, max 12 characters.
- Profanity is filtered server-side (fallback to `ANON`).

## Build & Deploy

- Build: `node tools/build.js`
- Upload: `dist/index.html` and `dist/game.js` (plus `assets/` if assets changed)
- Skip: `src/` and `tools/` for code-only updates

## Notes

- The leaderboard is optional; the game plays fully offline without it.
- `localStorage` persistence keys: `spaceGame_gameState_v1` and `spaceGame_sectorIndex_v1`.
