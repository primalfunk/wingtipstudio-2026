import { useCallback, useMemo, useState } from "react";
import PageMeta from "../components/PageMeta";
import catalogData from "../content/musicCatalog.json";
import SharedMediaPlayer from "../music/SharedMediaPlayer";
import TrackCard from "../music/TrackCard";
import type { MediaFormat, MusicCatalog, MusicTrack } from "../music/types";

const catalog = catalogData as MusicCatalog;
const composers = ["All composers", "Jared Menard", "K Daniel Menard"] as const;
type ComposerFilter = typeof composers[number];
const sections = [
  { id: "original", title: "Original Compositions", label: "Original", icon: "\u266a" },
  { id: "soundtrack", title: "Game Soundtracks", label: "Soundtrack", icon: "\u25c7" }
] as const;

export default function MusicPage() {
  const musicTracks = useMemo(() => catalog.tracks.filter((track) => track.section !== "video").sort((a, b) => a.sortOrder - b.sortOrder), []);
  const [composer, setComposer] = useState<ComposerFilter>("All composers");
  const visibleTracks = composer === "All composers" ? musicTracks : musicTracks.filter((track) => track.composer === composer);
  const featured = visibleTracks.find((track) => track.featured) ?? visibleTracks[0] ?? null;
  const [selected, setSelected] = useState<{ track: MusicTrack; format: MediaFormat } | null>(null);
  const selectTrack = useCallback((track: MusicTrack, format: MediaFormat) => setSelected({ track, format }), []);

  return (
    <main className={`site-page music-page${selected ? " has-shared-player" : ""}`}>
      <PageMeta title="Music | Wingtip Studio" description="Browse original compositions and game soundtracks by Jared Menard and K Daniel Menard." />
      <header className="page-intro music-intro"><p className="eyebrow">Wingtip Audio Department</p><h1>Music</h1><p>Original compositions and game soundtracks by Jared Menard and K Daniel Menard.</p></header>
      <section className="composer-filter" aria-labelledby="composer-filter-title">
        <div><p className="eyebrow">Browse by creator</p><h2 id="composer-filter-title">Composer</h2></div>
        <div className="composer-filter__controls" role="group" aria-label="Filter music by composer">{composers.map((name) => <button key={name} type="button" aria-pressed={composer === name} onClick={() => { setComposer(name); setSelected(null); }}>{name === "All composers" ? "All" : name.replace(" Menard", "")}</button>)}</div>
        <p aria-live="polite">Showing {visibleTracks.length} works</p>
      </section>
      {featured && (
        <section className="featured-track" aria-labelledby="featured-track-title">
          <div className="featured-track__art">{featured.thumbnail ? <img src={featured.thumbnail} alt="" /> : <span aria-hidden="true">{"\u266a"}</span>}</div>
          <div><p className="eyebrow">Featured Composition</p><h2 id="featured-track-title">{featured.title}</h2><p>{featured.description ?? `A composition by ${featured.composer}.`}</p><button type="button" onClick={() => selectTrack(featured, "audio")}>{"\u25b6"} Listen</button></div>
        </section>
      )}
      <section className="studio-collection" aria-labelledby="studio-collection-title">
        <header className="collection-heading"><p className="eyebrow">Curated Library</p><h2 id="studio-collection-title">{composer === "All composers" ? catalog.collection.title : composer}</h2></header>
        {sections.map((section, index) => {
          const sectionTracks = visibleTracks.filter((track) => track.section === section.id);
          return <section className={`music-section music-section--${section.id}`} key={section.id} aria-labelledby={`${section.id}-title`}><header className="music-section__header"><span className="music-section__number">0{index + 1}</span><span className="music-section__icon" aria-hidden="true">{section.icon}</span><div><p className="eyebrow">{section.label}</p><h2 id={`${section.id}-title`}>{section.title}</h2></div><span className="music-section__count">{sectionTracks.length} works</span></header>{sectionTracks.length ? <div className="music-card-grid">{sectionTracks.map((track) => <TrackCard key={track.id} track={track} onSelect={selectTrack} />)}</div> : <p className="empty-state">No {section.title.toLowerCase()} are registered for this composer.</p>}</section>;
        })}
      </section>
      <SharedMediaPlayer track={selected?.track ?? null} format={selected?.format ?? "audio"} onClose={() => setSelected(null)} />
    </main>
  );
}
