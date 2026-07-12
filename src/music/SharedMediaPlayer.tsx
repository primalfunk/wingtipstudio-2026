import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MediaFormat, MusicTrack } from "./types";

export default function SharedMediaPlayer({ track, format, onClose }: { track: MusicTrack | null; format: MediaFormat; onClose: () => void }) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [error, setError] = useState(false);
  const source = format === "audio" ? track?.audioSrc : track?.videoSrc;

  useEffect(() => {
    setError(false);
    if (!source) return;
    const media = mediaRef.current;
    media?.load();
    void media?.play().catch(() => undefined);
  }, [source]);

  if (!track) return null;
  return createPortal(
    <aside className={`shared-player shared-player--${format}`} aria-label={`Now playing ${track.title}`}>
      <div className="shared-player__info">
        <span aria-hidden="true">{format === "audio" ? "\u266a" : "\u25b6"}</span>
        <div><small>Now {format === "audio" ? "listening" : "watching"}</small><strong>{track.title}</strong><p>{track.composer}</p></div>
      </div>
      <div className="shared-player__media">
        {error || !source ? <p className="media-unavailable">This media file is unavailable or unsupported.</p> : format === "audio" ? (
          <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} controls preload="metadata" onError={() => setError(true)} aria-label={`Audio player for ${track.title}`}><source src={source} type="audio/mpeg" /></audio>
        ) : (
          <video ref={mediaRef as React.RefObject<HTMLVideoElement>} controls preload="metadata" onError={() => setError(true)} aria-label={`Video player for ${track.title}`}><source src={source} type="video/mp4" /></video>
        )}
      </div>
      <button className="shared-player__close" type="button" onClick={onClose} aria-label="Close media player">{"\u00d7"}</button>
    </aside>,
    document.body,
  );
}
