# Wingtip Studio

Wingtip Studio is a Vite + React site containing Home, Arcade, Music, and Contact pages. The games remain separately built applications loaded by the Arcade shell.

## Routes

- `/` - Home
- `/arcade` - categorized Arcade catalog
- `/music` - original compositions and game soundtracks, filterable by composer
- `/videos` - music videos and moving-image work
- `/contact` - editable About, mission, and email content
- Existing game routes such as `/plasmodyne` remain unchanged.

Direct route refreshes are handled by `public/_redirects` and `public/.htaccess`.

## Shared structure and editable content

- `src/components/SiteShell.tsx` - shared logo, navigation, active-page state, and footer
- `public/assets/wingtip-logo-transparent.png` - the one reused logo asset
- `src/content/siteContent.ts` - Home introduction and Contact text
- `src/content/gameCatalog.ts` - game descriptions, order, controls notes, and platform classification
- `src/content/musicCatalog.json` - the complete editable music metadata catalog
- `src/music/TrackCard.tsx` - reusable Original, Soundtrack, and Video card
- `src/music/SharedMediaPlayer.tsx` - the one audio/video player used by every card

## Music data model

Music and Videos share one `collection` named Studio Compositions and one flat `tracks` array. The Music page renders `original` and `soundtrack` records with an All/Jared/K Daniel composer filter; the Videos page renders `video` records. Every track has a `section` of `original`, `soundtrack`, or `video`. This supports future filtering by section, composer, year, title, featured state, or sort order without changing the page architecture.

Set exactly the track you want highlighted to `"featured": true`. The featured composition on Music and Home is selected from this metadata.

Track fields:

- `id`, `title`, `section`, `description`
- `author`, `composer`, `composerNotes`
- `duration`, `releaseYear`, `releaseDate`
- `audioSrc`, `videoSrc`, `thumbnail`
- `featured`, `sortOrder`, `gameTitle`

The shared player is created only after a visitor selects Listen or Watch. Choosing another work replaces the current source, so only one media element can play. Artwork priority is track `thumbnail`, then the branded section placeholder. The collection-level `artwork` field is ready for future use.

### Add an Original Composition

Use `"section": "original"`, supply `audioSrc`, and set `gameTitle` to `null`.

### Add a Game Soundtrack track

Use `"section": "soundtrack"`, supply `audioSrc`, and set `gameTitle` to the game name. Several tracks from one game remain separate track records but appear together in the Game Soundtracks section.

### Add a Music Video

Use `"section": "video"`, supply `videoSrc`, and set `audioSrc` to `null` unless a separate audio version is also available.

Example file:

`public/media/music/albums/night-signals/audio/01-glass-orbit.mp3`

Matching metadata in `src/content/musicCatalog.json`:

```json
{
  "id": "glass-orbit",
  "title": "Glass Orbit",
  "section": "original",
  "description": "Replace with final description.",
  "author": "Jared Menard",
  "composer": "Jared Menard",
  "duration": "3:42",
  "releaseYear": 2026,
  "releaseDate": "2026",
  "composerNotes": "Replace with final notes.",
  "audioSrc": "/media/music/albums/night-signals/audio/01-glass-orbit.mp3",
  "videoSrc": null,
  "thumbnail": "/media/music/artwork/glass-orbit.webp",
  "featured": false,
  "sortOrder": 27,
  "gameTitle": null
}
```

Uploaded media sources remain untouched in `new_media`, and artwork sources remain untouched in `artwork_new`. Run `npm run prepare:media` to regenerate normalized copies. WAV sources become high-quality VBR MP3 files; PNG artwork becomes web-optimized WebP in `public/media/music/artwork`.

## Exact media destinations

- Audio: `<project-root>\public\media\music\albums\<album-slug>\audio\`
- Videos: `<project-root>\public\media\music\albums\<album-slug>\video\`
- Current video collection: `<project-root>\public\media\music\collections\music-videos\video\`
- Artwork: `<project-root>\public\media\music\artwork\`

Supported formats are MP3, MP4, JPG, PNG, and WebP. Use lowercase, hyphen-separated filenames without spaces. Public files appear immediately in development; rebuild before deployment.

## Wingtip Archives visual identity

The homepage hero uses `artwork_new/wingtip_entity.png` as Archive Item 001, The Imagination Engine. `npm run prepare:media` produces the optimized `public/media/music/artwork/wingtip-entity.webp` derivative while preserving the source PNG. Hero copy, accessible alt text, archive number, title, and caption are editable in `src/content/siteContent.ts`.

Future archive artwork should use the same restrained pattern: sequential Archive Item number, artifact title, one-line recovery caption, dark archival background, and optional track `thumbnail` metadata. Keep lore brief so the artifacts remain suggestive rather than explanatory.

## Commands

- `npm run dev` - local development
- `npm run validate:site` - validate routes, sections, metadata IDs, and media paths
- `npm run validate:browser` - validate five responsive widths, media switching, console output, and contact email
- `npm run build` - build all games and the production site
- `npm run build:deploy` - create the uploadable archive


