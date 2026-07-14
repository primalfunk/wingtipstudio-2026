# Wingtip Studio

> An independent software workshop exploring engineering, artificial intelligence, simulation, games, music, and unusual ideas.

- Website: [wingtipstudio.com](https://wingtipstudio.com)
- Current release: **1.0.0**
- GitHub: [github.com/primalfunk](https://github.com/primalfunk)
- LinkedIn: [linkedin.com/in/jared-d-menard](https://www.linkedin.com/in/jared-d-menard)

## Overview

This repository contains the Wingtip Studio website and its browser-playable game collection.

The site separates two related identities:

- **Jared Menard** is the systems engineer, software developer, analyst, and professional.
- **Wingtip Studio** is the independent workshop where software, games, simulation, music, and experimental creative technology are built.

The website serves as a professional profile, project notebook, creative portfolio, music and video library, and playable arcade.

## Navigation and Routes

The primary navigation follows this order:

**Home / Projects / Games / Music / Videos / Studio / Professional / Connect**

| Navigation label | Route | Responsibility |
|---|---|---|
| Home | **/** | Introduces Wingtip and directs visitors into the work |
| Projects | **/projects** | Documents active engineering projects and their current focus |
| Games | **/arcade** | Presents the playable game collection |
| Music | **/music** | Presents original compositions and game soundtracks |
| Videos | **/videos** | Presents music videos and moving-image work |
| Studio | **/about** | Explains Wingtip Studio's purpose and creative philosophy |
| Professional | **/professional** | Presents Jared Menard's experience, capabilities, career, and technologies |
| Connect | **/connect** | Provides email, LinkedIn, GitHub, and resume actions |

The legacy **/contact** route redirects to **/connect**. Unknown routes redirect to Home.

Individual games retain direct routes such as **/plasmodyne**, **/stone-horses**, and **/dead-channels**. These routes load independent game builds inside the shared game frame.

## Homepage

The homepage is an orientation layer rather than a duplicate of the destination pages. It contains:

- The Wingtip Studio hero and Imagination Engine artwork
- A three-button row for Arcade, Music, and Videos
- Distinct yellow, cyan, and green action highlights
- A concise **Currently building** signal for LODEX and Cinelingus
- An Explore the Work index
- Parallel Professional and Studio paths
- A final invitation to Connect

Detailed project, professional, and studio explanations remain on their owning pages.

## Editorial Ownership

The governing editorial principle is: **say something once, in the place where it belongs.**

| Page | Owns |
|---|---|
| Professional | Jared's professional value, experience, working method, career, and technologies |
| Projects | Detailed descriptions and current focus for active engineering work |
| Studio | Wingtip's philosophy, purpose, and creative identity |
| Connect | The shortest path to beginning a conversation |
| Home | Orientation and wayfinding |

Professional uses concise project references for hiring context. Projects owns the detailed project descriptions.

## Current Engineering Projects

- **LODEX** - A local-first AI software engineering assistant for understanding, planning, reviewing, and safely modifying software projects.
- **Cinelingus** - An experimental cinematic transformation platform focused on dialogue, speaker identity, semantic scene analysis, and composable filters. Source: [github.com/primalfunk/cinelingus](https://github.com/primalfunk/cinelingus)
- **Billionaire Simulator** - A large-scale simulation of business, investment, wealth creation, and emergent economic storytelling.
- **Enchanted Castle Rebooted** - A parser adventure emphasizing procedural storytelling, literary prose, and dynamic puzzles.
- **Angle Wars** - An artillery game built around expressive physics, unusual weapons, and emergent strategy.

## Playable Games

The Arcade catalog is defined in **src/content/gameCatalog.ts**.

| Game | Route | Primary format |
|---|---|---|
| Spy Hunter: Apex | **/spy-hunter-apex** | Desktop optimized |
| Plasmodyne | **/plasmodyne** | Desktop optimized |
| Concordant | **/concordant** | Desktop optimized |
| Boondock Trail | **/boondock-trail** | Mobile first |
| Stone Horses | **/stone-horses** | Desktop optimized |
| Streets Arcana | **/coach** | Desktop optimized |
| The Lords of Chaos | **/lords-of-chaos** | Desktop optimized |
| Ancient Suffering | **/ancient-suffering-reborn** | Mobile first |
| Math Blaster Neo | **/math-blaster-neo** | Mobile first |
| Dead Channels | **/dead-channels** | Desktop optimized |

Each game is an npm workspace with its own build command. The root build compiles every game, copies the finished game bundles into **public/games**, and then builds the main site.

## Music and Videos

Music and video content is driven by **src/content/musicCatalog.json**.

Supported catalog sections:

- Original compositions
- Game soundtracks
- Music videos

Track metadata includes:

- Stable ID and title
- Section and sort order
- Author and composer
- Description and composer notes
- Duration and release information
- Audio or video source
- Artwork
- Featured status
- Associated game, when applicable

The **featured** flag controls the featured composition on the Music page. It no longer creates a homepage feature.

Audio and video elements are mounted only after a visitor selects a work. The shared media player is fixed to the viewport, and only one player instance is active at a time.

## Interaction and Accessibility

- Responsive layouts are validated at five viewport sizes from phone to large desktop.
- Shared route transitions run for 300 ms with simultaneous outgoing and incoming layers.
- Outgoing pages fade and rise slightly; incoming pages fade in from below.
- Editorial hero rules draw from left to right during entry.
- Route changes always reset the viewport to the top before the destination paints.
- **prefers-reduced-motion** replaces movement with simple fades and disables the rule animation.
- Direct routes, keyboard focus, horizontal overflow, console errors, and media loading behavior are covered by browser validation.
- Each route sets its own title and description and publishes a canonical URL under **https://wingtipstudio.com**.

## Technology

- React 18
- TypeScript
- React Router
- Vite
- Playwright
- PowerShell media and deployment tooling
- npm workspaces for the embedded games

## Repository Structure

~~~text
resume.pdf                    Source resume bundled by Vite
src/
  App.tsx                     Route declarations
  arcade/                     Arcade presentation and game frame
  components/
    PageMeta.tsx              Document title, description, and canonical URL
    PageTransition.tsx        Shared route transition and scroll reset
    SiteShell.tsx             Header, navigation, footer, and routed page shell
  content/
    gameCatalog.ts            Arcade metadata
    musicCatalog.json         Music and video metadata
    siteContent.ts            Homepage and artwork metadata
    siteLinks.ts              Domain, email, profiles, project link, and resume URL
  games/                      Independent game workspaces
  music/                      Shared music and video player components
  pages/                      Main routed pages
  *.css                       Shared and page-specific styling
tools/
  browser-validation.mjs      Responsive production-browser acceptance suite
  copy-games.js               Copies built games into public/games
  package-deploy.ps1          Creates the deployment archive
  prepare-media.ps1           Prepares music, video, artwork, and soundtrack media
  validate-site.mjs           Fast structural and content validation
public/
  assets/                     Site artwork and brand assets
  games/                      Generated game bundles
  media/                      Prepared music, video, and artwork
~~~

## Primary Content Files

| File | Purpose |
|---|---|
| **src/pages/HomePage.tsx** | Homepage structure and wayfinding |
| **src/pages/ProfessionalPage.tsx** | Professional identity and career content |
| **src/pages/ProjectsPage.tsx** | Living engineering notebook |
| **src/pages/AboutPage.tsx** | Studio philosophy and Imagination Engine section |
| **src/pages/ConnectPage.tsx** | Contact and profile actions |
| **src/content/siteContent.ts** | Homepage copy and artwork metadata |
| **src/content/siteLinks.ts** | Production domain, email, GitHub, LinkedIn, Cinelingus, and resume links |
| **src/content/gameCatalog.ts** | Arcade titles, routes, descriptions, controls, and ordering |
| **src/content/musicCatalog.json** | Music, soundtrack, and video catalog |
| **src/components/SiteShell.tsx** | Navigation order and shared shell |
| **src/components/PageTransition.tsx** | Transition timing and scroll-to-top behavior |
| **src/editorial-pages.css** | Editorial layout and transition styling |
| **src/home-phase2.css** | Homepage layout and action styling |

## Development

Requirements:

- Node.js and npm
- Microsoft Edge for the configured Playwright browser suite
- FFmpeg only when preparing media

Install dependencies and start the local development server:

~~~bash
npm install
npm run dev
~~~

The development server binds to **127.0.0.1**.

## Validation

Run the fast content and structure checks:

~~~bash
npm run validate:site
~~~

Build only the main Wingtip site:

~~~bash
npm run build:arcade
~~~

Build every game and the main site:

~~~bash
npm run build
~~~

The browser suite runs against a production preview on port **4173**. Start the preview in one terminal:

~~~bash
npm run preview
~~~

Then run the browser checks in a second terminal:

~~~bash
npm run validate:browser
~~~

The browser suite verifies:

- All primary routes at five responsive widths
- One H1 per page
- No horizontal overflow
- No unexpected console errors
- Homepage artwork, action row, wayfinding, and current-building signal
- Simultaneous outgoing and incoming route transitions
- Editorial rule animation
- Reduced-motion behavior
- Scroll-to-top behavior after navigation
- Lazy media mounting and shared player behavior
- Legacy Contact redirect
- Email, resume, and canonical production URLs

## Media Preparation

Raw additions are read from:

~~~text
new_media/audio/
new_media/videos/
artwork_new/
~~~

Prepare optimized site media with:

~~~bash
npm run prepare:media
~~~

The media pipeline:

- Converts WAV files to MP3
- Copies existing MP3 and MP4 files
- Converts PNG artwork to WebP
- Extracts audio for the configured video exception
- Collects soundtrack files from the game workspaces
- Writes prepared output beneath **public/media/music**

Source media is preserved.

## Deployment

Create a complete production build and deployment archive:

~~~bash
npm run build:deploy
~~~

This command:

1. Builds every game workspace.
2. Copies game bundles into **public/games**.
3. Builds the main Vite site into **dist**.
4. Bundles the root **resume.pdf** as a versioned production asset.
5. Creates **deploy/wingtip-arcade-full.zip**.

The deployment host must support SPA fallback routing to **index.html** so direct visits to routes such as **/professional** and **/projects** resolve correctly.

## Release

Version metadata is maintained in both **package.json** and **package-lock.json**.

Release **1.0.0** establishes the current public Wingtip Studio information architecture, professional identity, project notebook, studio philosophy, Connect page, responsive navigation, page transitions, canonical domain, resume delivery, and production validation contract.

## Philosophy

Wingtip Studio is built around a simple idea:

> Build the projects that do not already exist.

Some become software. Some become games. Some become music. Some become strange experiments that resist categories.

The common thread is curiosity, careful systems thinking, and the desire to make difficult ideas real.

---

Jared Menard

Wingtip Studio
