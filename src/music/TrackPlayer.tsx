import { useEffect, useRef, useState } from "react";
import type { MusicTrack } from "./types";

export default function TrackPlayer({ track, activeId, onActivate }: { track: MusicTrack; activeId: string | null; onActivate: (id: string) => void }) {
  const mediaRef = useRef<HTMLMediaElement>(null);
  const [format, setFormat] = useState<"audio" | "video">(track.audioSrc ? "audio" : "video");
  const [mediaError, setMediaError] = useState(false);
  const isActive = activeId === track.id;
  const source = format === "audio" ? track.audioSrc : track.videoSrc;

  useEffect(() => {
    if (!isActive) mediaRef.current?.pause();
  }, [isActive]);

  useEffect(() => setMediaError(false), [format, track.id]);

  if (!track.audioSrc && !track.videoSrc) return <p className="media-unavailable">Media not yet available.</p>;

  return (
    <div className="track-player">
      {track.audioSrc && track.videoSrc && (
        <div className="format-switch" aria-label={`Choose format for ${track.title}`}>
          <button type="button" aria-pressed={format === "audio"} onClick={() => setFormat("audio")}>Audio</button>
          <button type="button" aria-pressed={format === "video"} onClick={() => setFormat("video")}>Video</button>
        </div>
      )}
      {mediaError ? <p className="media-unavailable">This media file is unavailable or unsupported.</p> : !isActive ? (
        <button className="track-play" type="button" onClick={() => onActivate(track.id)}>Load {format}</button>
      ) : source ? format === "audio" ? (
        <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} controls preload="metadata" onError={() => setMediaError(true)} onPlay={() => onActivate(track.id)} aria-label={`Audio player for ${track.title}`}>
          <source src={source} type="audio/mpeg" />Your browser does not support MP3 audio.
        </audio>
      ) : (
        <video ref={mediaRef as React.RefObject<HTMLVideoElement>} controls preload="metadata" onError={() => setMediaError(true)} onPlay={() => onActivate(track.id)} aria-label={`Video player for ${track.title}`}>
          <source src={source} type="video/mp4" />Your browser does not support MP4 video.
        </video>
      ) : <p className="media-unavailable">This format is unavailable.</p>}
    </div>
  );
}
