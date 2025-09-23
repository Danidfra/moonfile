export type GameAsset = {
  cover?: string;
  icon?: string;
  banner?: string;
  screenshots: string[];
};

export type Game31996 = {
  id: string;             // from tag d
  title: string;          // name
  summary?: string;
  genres: string[];
  modes: string[];
  status?: "alpha" | "beta" | "released" | "prototype" | string;
  version?: string;
  credits?: string;
  platforms: string[];
  mime?: string;
  encoding?: "base64" | string;
  compression?: "none" | "gzip" | string;
  sizeBytes?: number;
  sha256?: string;
  assets: GameAsset;
  contentBase64?: string; // event.content
  event?: NostrEvent;     // raw event (optional, debugging)
};

export type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};