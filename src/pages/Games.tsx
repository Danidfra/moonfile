import { useState, useMemo } from "react";
import { useSeoMeta } from '@unhead/react';
import { Header } from "@/components/Header";
import { FilterSection, GameFilters } from "@/components/games/FilterSection";
import { GameCardNostr } from "@/components/games/GameCardNostr";
import { GamesEmptyState } from "@/components/games/GamesEmptyState";
import { useNostrGames } from "@/hooks/useNostrGames";
import type { Game31985 } from "@/types/game";

const Games = () => {
  useSeoMeta({
    title: 'Games - MoonFile',
    description: 'Browse and play games on MoonFile, the decentralized arcade powered by Nostr.',
  });

  const [filters, setFilters] = useState<GameFilters>({
    genres: [],
    modes: [],
    statuses: [],
    platforms: [],
    tags: [],
    author: "",
    rating: 0,
    search: ""
  });

  const { games: allGames, loading, error, refetch } = useNostrGames();

  // Filter games based on current filters
  const filteredGames = useMemo(() => {
    return allGames.filter((game) => {
      // Search filter
      if (filters.search && !game.title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Genre filter
      if (filters.genres.length > 0 && !filters.genres.some(genre => game.genres.includes(genre))) {
        return false;
      }

      // Mode filter
      if (filters.modes.length > 0 && !filters.modes.some(mode => game.modes.includes(mode))) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(game.status)) {
        return false;
      }

      // Platform filter
      if (filters.platforms.length > 0 && !filters.platforms.some(platform => game.platforms.includes(platform))) {
        return false;
      }

      // Tags filter
      if (filters.tags.length > 0 && !filters.tags.some(tag => game.genres.includes(tag) || game.modes.includes(tag))) {
        return false;
      }

      // Author filter
      if (filters.author && game.credits && !game.credits.toLowerCase().includes(filters.author.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [filters, allGames]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      <Header />
      
      <main className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              All Games
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Discover and play games from our decentralized library
            </p>
          </div>

          {/* Filter Section - Only show if we have games or not loading */}
          {!loading && !error && allGames.length > 0 && (
            <FilterSection onFiltersChange={setFilters} />
          )}
          
          {/* Results Header */}
          {!loading && !error && allGames.length > 0 && (
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-semibold text-white">
                Games Found 
                <span className="ml-2 text-lg text-gray-400">
                  ({filteredGames.length} of {allGames.length})
                </span>
              </h2>
            </div>
          )}
          
          {/* Games Grid */}
          {!loading && !error && filteredGames.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredGames.map((game) => (
                <GameCardNostr 
                  key={game.id}
                  game={game}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && (allGames.length === 0 || filteredGames.length === 0) && (
            <GamesEmptyState 
              loading={loading}
              error={error}
              onRefresh={refetch}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Games;