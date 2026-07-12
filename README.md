# Wingtip Studio

> *An independent creative workshop exploring games, music, artificial intelligence, procedural generation, and experimental software.*

Wingtip Studio is the home of my independent projects—a place where software engineering, game design, music composition, and creative technology intersect.

This repository contains the source code for the Wingtip Studio website, which serves as both a portfolio and an evolving development journal. Visitors can browse released games, original music, videos, and follow the progress of projects currently under active development.

## Current Projects

- **LODEX** — A local-first AI software engineering assistant focused on planning, understanding, and safely modifying codebases.
- **Cinelingus** — An experimental filmmaking system that remixes dialogue, performances, and timing to produce entirely new cinematic experiences.
- **Billionaire Simulator** *(in development)* — A large-scale business, investment, and economic simulation.
- **Enchanted Castle Rebooted** *(planned)* — A modern parser adventure inspired by classic interactive fiction.
- **Angle Wars** *(Bureau of Bad Ideas)* — A chaotic artillery game carrying the spirit of classics like *Scorched Earth*.

---

# Website Sections

| Route | Description |
|-------|-------------|
| `/` | Home |
| `/arcade` | Game collection |
| `/music` | Original music and game soundtracks |
| `/videos` | Music videos and moving-image work |
| `/contact` | About Wingtip Studio, current projects, GitHub, and contact information |

Existing game routes (such as `/plasmodyne`) continue to function independently.

---

# Technology

- React
- TypeScript
- Vite
- Responsive design
- Shared media player architecture

---

# Repository Structure

```
src/
    components/
    content/
    music/
    pages/
    styles/

public/
    assets/
    media/
```

Key editable content:

| File | Purpose |
|------|---------|
| `src/content/siteContent.ts` | Homepage and About page content |
| `src/content/gameCatalog.ts` | Arcade metadata |
| `src/content/musicCatalog.json` | Music and video catalog |
| `src/components/SiteShell.tsx` | Shared navigation and layout |
| `src/music/SharedMediaPlayer.tsx` | Audio/video playback |

---

# Music Library

Music and videos are driven entirely by metadata in `musicCatalog.json`.

Supported sections:

- Original compositions
- Game soundtracks
- Music videos

Each track includes metadata such as:

- title
- composer
- description
- duration
- release date
- artwork
- audio/video source
- featured status
- sort order

The homepage automatically highlights whichever track is marked:

```json
"featured": true
```

Only one media player instance exists on the page at a time.

---

# Media Pipeline

Raw media is never served directly.

Source folders:

```
new_media/
artwork_new/
```

Generate optimized assets with:

```bash
npm run prepare:media
```

This process:

- converts WAV → MP3
- optimizes artwork → WebP
- preserves original source files
- copies finished assets into `/public/media`

---

# Development

Run locally:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run dev
npm run validate:site
npm run validate:browser
npm run build
npm run build:deploy
```

---

# Wingtip Archives

The homepage features an ongoing fictional museum collection known as the **Wingtip Archives**.

Each artifact is presented as a recovered object with:

- Archive number
- Title
- Brief recovery caption
- Minimal accompanying lore

The intention is to evoke curiosity rather than explain everything outright.

---

# Philosophy

Wingtip Studio is built around a simple idea:

> **Build the projects that don't already exist.**

Some become games.

Some become music.

Some become AI tools.

Some become wonderfully strange experiments that don't fit neatly into any category.

If they spark curiosity or inspire someone else to build something interesting, they've done their job.

---

© Jared Menard  
Wingtip Studio