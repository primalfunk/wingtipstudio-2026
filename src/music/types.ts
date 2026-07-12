export type MusicSection = "original" | "soundtrack" | "video";
export type MediaFormat = "audio" | "video";

export type MusicTrack = {
  id: string;
  title: string;
  section: MusicSection;
  description: string | null;
  author: string;
  composer: string;
  duration: string | null;
  releaseYear: number | null;
  releaseDate: string | null;
  composerNotes: string | null;
  audioSrc: string | null;
  videoSrc: string | null;
  thumbnail: string | null;
  featured: boolean;
  sortOrder: number;
  gameTitle: string | null;
};

export type StudioCollection = {
  id: string;
  title: string;
  description: string;
  artwork: string | null;
};

export type MusicCatalog = { collection: StudioCollection; tracks: MusicTrack[] };
