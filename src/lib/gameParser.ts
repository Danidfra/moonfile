import type { Game31996, NostrEvent, GameAsset } from "@/types/game";

export function firstTagValue(tags: string[][], key: string): string | undefined {
  const t = tags.find(t => t[0] === key);
  return t?.[1];
}

export function multiTagValues(tags: string[][], key: string): string[] {
  const values: string[] = [];
  for (const t of tags) {
    if (t[0] === key && t.length > 1) {
      values.push(...t.slice(1));
    }
  }
  return values;
}

export function parseGame(e: NostrEvent): Game31996 | null {
  const d = firstTagValue(e.tags, "d");
  const name = firstTagValue(e.tags, "name");

  if (!d || !name) return null;

  const size = firstTagValue(e.tags, "size");
  const assets: GameAsset = {
    screenshots: []
  };

  // Parse image assets
  for (const t of e.tags) {
    if (t[0] === "image") {
      if (t.length === 2) {
        assets.cover ??= t[1];
      } else if (t[1] === "cover" && t[2]) {
        assets.cover = t[2];
      } else if (t[1] === "screenshot" && t[2]) {
        assets.screenshots.push(t[2]);
      }
    } else if (t[0] === "icon" && t[1]) {
      assets.icon = t[1];
    } else if (t[0] === "banner" && t[1]) {
      assets.banner = t[1];
    }
  }

  return {
    id: d,
    title: name,
    summary: firstTagValue(e.tags, "summary"),
    genres: multiTagValues(e.tags, "genre"),
    modes: multiTagValues(e.tags, "mode"),
    status: firstTagValue(e.tags, "status") as any,
    version: firstTagValue(e.tags, "ver"),
    credits: firstTagValue(e.tags, "credits"),
    platforms: multiTagValues(e.tags, "platforms"),
    mime: firstTagValue(e.tags, "mime"),
    encoding: firstTagValue(e.tags, "encoding") as any,
    compression: firstTagValue(e.tags, "compression") as any,
    sizeBytes: size ? Number(size) : undefined,
    sha256: firstTagValue(e.tags, "sha256"),
    assets,
    contentBase64: e.content,
    event: e
  };
}

export function mergeByD(events: NostrEvent[]): Game31996[] {
  const map = new Map<string, { e: NostrEvent, g: Game31996 }>();

  for (const e of events) {
    if (e.kind !== 31996) continue;

    const g = parseGame(e);
    if (!g) continue;

    const prev = map.get(g.id);
    if (!prev || e.created_at > prev.e.created_at) {
      map.set(g.id, { e, g });
    }
  }

  return Array.from(map.values()).map(x => x.g);
}