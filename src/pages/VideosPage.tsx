import { useCallback, useMemo, useState } from "react";
import PageMeta from "../components/PageMeta";
import catalogData from "../content/musicCatalog.json";
import SharedMediaPlayer from "../music/SharedMediaPlayer";
import TrackCard from "../music/TrackCard";
import type { MediaFormat, MusicCatalog, MusicTrack } from "../music/types";

const catalog = catalogData as MusicCatalog;

export default function VideosPage() {
  const videos = useMemo(() => catalog.tracks.filter((track) => track.section === "video").sort((a, b) => a.sortOrder - b.sortOrder), []);
  const [selected, setSelected] = useState<{ track: MusicTrack; format: MediaFormat } | null>(null);
  const selectTrack = useCallback((track: MusicTrack, format: MediaFormat) => setSelected({ track, format }), []);

  return (
    <main className={`site-page music-page videos-page${selected ? " has-shared-player" : ""}`}>
      <PageMeta title="Videos | Wingtip Studio" description="Watch music videos and moving-image work from Wingtip Studio." />
      <header className="page-intro music-intro"><p className="eyebrow">Wingtip Moving Image Department</p><h1>Videos</h1><p>Music videos, films, and audiovisual experiments by Jared Menard.</p></header>
      <section className="music-section music-section--video" aria-labelledby="videos-title">
        <header className="music-section__header"><span className="music-section__number">01</span><span className="music-section__icon" aria-hidden="true">{"\u25b6"}</span><div><p className="eyebrow">Moving Image</p><h2 id="videos-title">Music Videos</h2></div><span className="music-section__count">{videos.length} works</span></header>
        {videos.length ? <div className="music-card-grid">{videos.map((track) => <TrackCard key={track.id} track={track} onSelect={selectTrack} />)}</div> : <p className="empty-state">No videos are registered yet.</p>}
      </section>
      <SharedMediaPlayer track={selected?.track ?? null} format={selected?.format ?? "video"} onClose={() => setSelected(null)} />
    </main>
  );
}
