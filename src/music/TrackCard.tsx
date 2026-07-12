import { memo } from "react";
import type { MediaFormat, MusicTrack } from "./types";

const sectionLabels = { original: "Original Composition", soundtrack: "Game Soundtrack", video: "Music Video" } as const;
function TrackCard({ track, onSelect }: { track: MusicTrack; onSelect: (track: MusicTrack, format: MediaFormat) => void }) {
  const fallback = track.section === "original" ? "\u266a" : track.section === "soundtrack" ? "\u25c7" : "\u25b6";
  return <article className={`music-card music-card--${track.section}`}><div className="music-card__art">{track.thumbnail ? <img src={track.thumbnail} alt="" loading="lazy" /> : <span aria-hidden="true">{fallback}</span>}</div><div className="music-card__body"><p className="music-card__category">{track.gameTitle ?? sectionLabels[track.section]}</p><h3>{track.title}</h3><p className="music-card__meta">{track.composer}{track.duration ? ` ${"\u00b7"} ${track.duration}` : ""}</p>{track.description && <p className="music-card__description">{track.description}</p>}<div className="music-card__actions">{track.audioSrc && <button type="button" onClick={() => onSelect(track, "audio")} aria-label={`Listen to ${track.title}`}>{"\u25b6"} Listen</button>}{track.videoSrc && <button type="button" onClick={() => onSelect(track, "video")} aria-label={`Watch ${track.title}`}>{"\u25b6"} Watch</button>}{!track.audioSrc && !track.videoSrc && <span className="media-unavailable">Unavailable</span>}</div></div></article>;
}
export default memo(TrackCard);
