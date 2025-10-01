import { useSeoMeta } from '@unhead/react';
import { Header } from '@/components/Header';
import { useNostr } from '@jsr/nostrify__react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { GameCardNostr } from '@/components/games/GameCardNostr';
import { GamesEmptyState } from '@/components/games/GamesEmptyState';

import { useNavigate } from 'react-router-dom';
import type { NostrEvent } from '@jsr/nostrify__nostrify';
import type { Game31996 } from '@/types/game';

const GamesPage = () => {
  useSeoMeta({
    title: 'Games - Retro Arcade',
    description: 'Browse and play retro games on our decentralized arcade.',
  });

  const { nostr } = useNostr();
  const _navigate = useNavigate();

  // Query for kind 31996 game events
  const { data: games = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['nostr-games'],
    queryFn: async () => {
      console.log('[GamesPage] Fetching kind 31996 game events');

      const events = await nostr.query([{
        kinds: [31996],
        limit: 50
      }], {
        signal: AbortSignal.timeout(10000)
      });

      console.log('[GamesPage] Found', events.length, 'game events');

      // Parse events into game metadata using the same parser as other pages
      const games = events.map(parseGameMetadata).filter((game): game is Game31996 => game !== null);

      console.log('[GamesPage] Parsed', games.length, 'valid games');

      return games;
    },
    enabled: !!nostr
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <Header />

      <main className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Retro Arcade
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Play classic NES games in your browser, powered by Nostr
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mb-4"></div>
              <p className="text-gray-400">Loading games...</p>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-white mb-4">Error Loading Games</h2>
              <p className="text-gray-400 mb-6 text-center max-w-md">
                {error instanceof Error ? error.message : 'Failed to load games'}
              </p>
              <Button onClick={() => refetch()} className="bg-purple-600 hover:bg-purple-700">
                Try Again
              </Button>
            </div>
          )}

          {/* Games Grid */}
          {!loading && !error && games.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {games.map((game) => (
                <GameCardNostr
                  key={game.id}
                  game={game}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && games.length === 0 && (
            <GamesEmptyState
              loading={false}
              error={null}
              onRefresh={refetch}
            />
          )}
        </div>
      </main>
    </div>
  );
};

/**
 * Parse game metadata from Nostr event using the same logic as gameParser.ts
 * This ensures consistency across all pages and proper image parsing
 */
function parseGameMetadata(event: NostrEvent): Game31996 | null {
  const getTagValue = (tagName: string): string | undefined => {
    const tag = event.tags.find(t => t[0] === tagName);
    return tag?.[1];
  };

  const getTagValues = (tagName: string): string[] => {
    const values: string[] = [];
    for (const t of event.tags) {
      if (t[0] === tagName && t.length > 1) {
        values.push(...t.slice(1));
      }
    }
    return values;
  };

  const d = getTagValue('d');
  const name = getTagValue('name');

  if (!d || !name) return null;

  const size = getTagValue('size');
  const assets: Game31996['assets'] = {
    screenshots: []
  };

  // Parse image assets - supports both ["image", "url"] and ["image", "cover", "url"] formats
  for (const t of event.tags) {
    if (t[0] === "image") {
      if (t.length === 2) {
        // Simple format: ["image", "url"]
        assets.cover ??= t[1];
      } else if (t[1] === "cover" && t[2]) {
        // Typed format: ["image", "cover", "url"] - overrides simple format
        assets.cover = t[2];
      } else if (t[1] === "screenshot" && t[2]) {
        // Screenshot format: ["image", "screenshot", "url"]
        assets.screenshots.push(t[2]);
      }
      // Handle other potential image types gracefully
      else if (t[1] && !t[2]) {
        // Handle case where there might be a type but no URL (fallback to simple format)
        assets.cover ??= t[1];
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
    summary: getTagValue('summary'),
    genres: getTagValues('genre'),
    modes: getTagValues('mode'),
    status: getTagValue('status') as "alpha" | "beta" | "released" | "prototype" | string | undefined,
    version: getTagValue('ver'),
    credits: getTagValue('credits'),
    platforms: getTagValues('platforms'),
    mime: getTagValue('mime'),
    encoding: getTagValue('encoding') as "base64" | string | undefined,
    compression: getTagValue('compression') as "none" | "gzip" | string | undefined,
    sizeBytes: size ? Number(size) : undefined,
    sha256: getTagValue('sha256'),
    assets,
    contentBase64: event.content,
    event
  };
}

export default GamesPage;