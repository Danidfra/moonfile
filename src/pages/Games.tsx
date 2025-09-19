import { useState, useMemo } from "react";
import { useSeoMeta } from '@unhead/react';
import { Header } from "@/components/Header";
import { GameCard } from "@/components/GameCard";
import { FilterSection, GameFilters } from "@/components/games/FilterSection";

interface Game {
  id: string;
  title: string;
  genre: string;
  mode: string;
  status: string;
  platform: string;
  tags: string[];
  author: string;
  rating: number;
  coverImage: string;
}

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

  // Expanded game data with filtering attributes
  const allGames: Game[] = [
    {
      id: "1",
      title: "Space Invaders",
      genre: "Shooter",
      mode: "Solo",
      status: "Released",
      platform: "NES ROM",
      tags: ["retro", "8-bit", "arcade", "shooter"],
      author: "Taito",
      rating: 5,
      coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop"
    },
    {
      id: "2",
      title: "Racing Thunder",
      genre: "Racing",
      mode: "Solo",
      status: "Released",
      platform: "HTML5",
      tags: ["racing", "3D", "arcade", "fast-paced"],
      author: "SpeedDev",
      rating: 4,
      coverImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"
    },
    {
      id: "3",
      title: "Puzzle Master",
      genre: "Puzzle",
      mode: "Solo",
      status: "Released",
      platform: "HTML5",
      tags: ["puzzle", "brain-teaser", "casual", "2D"],
      author: "Mind Games Studio",
      rating: 4,
      coverImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=300&fit=crop"
    },
    {
      id: "4",
      title: "Battle Arena",
      genre: "Fighting",
      mode: "PvP",
      status: "Beta",
      platform: "HTML5",
      tags: ["multiplayer", "fighting", "competitive", "2D"],
      author: "Fight Club Games",
      rating: 3,
      coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop"
    },
    {
      id: "5",
      title: "Snake Classic",
      genre: "Arcade",
      mode: "Solo",
      status: "Released",
      platform: "HTML5",
      tags: ["retro", "arcade", "casual", "classic"],
      author: "RetroDev",
      rating: 4,
      coverImage: "https://images.unsplash.com/photo-1614294148140-0d0c0d7f2f4d?w=400&h=300&fit=crop"
    },
    {
      id: "6",
      title: "Tetris Blitz",
      genre: "Puzzle",
      mode: "Solo",
      status: "Released",
      platform: "Game Boy",
      tags: ["puzzle", "retro", "8-bit", "addictive"],
      author: "Tetris Company",
      rating: 5,
      coverImage: "https://images.unsplash.com/photo-1516251193007-45ef94e65d4c?w=400&h=300&fit=crop"
    },
    {
      id: "7",
      title: "Street Fighter II",
      genre: "Fighting",
      mode: "PvP",
      status: "Released",
      platform: "SNES",
      tags: ["fighting", "retro", "16-bit", "competitive"],
      author: "Capcom",
      rating: 5,
      coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop"
    },
    {
      id: "8",
      title: "Maze Runner",
      genre: "Adventure",
      mode: "Solo",
      status: "Alpha",
      platform: "HTML5",
      tags: ["adventure", "puzzle", "maze", "3D"],
      author: "Labyrinth Studios",
      rating: 2,
      coverImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"
    },
    {
      id: "9",
      title: "Sokoban Pro",
      genre: "Puzzle",
      mode: "Solo",
      status: "Released",
      platform: "HTML5",
      tags: ["sokoban", "puzzle", "retro", "brain-teaser"],
      author: "PuzzleMaster",
      rating: 4,
      coverImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=300&fit=crop"
    },
    {
      id: "10",
      title: "Space Shooter",
      genre: "Shooter",
      mode: "Bot",
      status: "Beta",
      platform: "HTML5",
      tags: ["shooter", "space", "arcade", "bot"],
      author: "Cosmic Games",
      rating: 3,
      coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop"
    },
    {
      id: "11",
      title: "Co-op Quest",
      genre: "Adventure",
      mode: "Co-op",
      status: "Released",
      platform: "HTML5",
      tags: ["co-op", "multiplayer", "adventure", "RPG"],
      author: "TeamUp Studios",
      rating: 4,
      coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop"
    },
    {
      id: "12",
      title: "Pixel Platformer",
      genre: "Platformer",
      mode: "Solo",
      status: "Prototype",
      platform: "HTML5",
      tags: ["platformer", "pixel-art", "retro", "2D"],
      author: "PixelDev",
      rating: 1,
      coverImage: "https://images.unsplash.com/photo-1516251193007-45ef94e65d4c?w=400&h=300&fit=crop"
    }
  ];

  // Filter games based on current filters
  const filteredGames = useMemo(() => {
    return allGames.filter((game) => {
      // Search filter
      if (filters.search && !game.title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Genre filter
      if (filters.genres.length > 0 && !filters.genres.includes(game.genre)) {
        return false;
      }

      // Mode filter
      if (filters.modes.length > 0 && !filters.modes.includes(game.mode)) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(game.status)) {
        return false;
      }

      // Platform filter
      if (filters.platforms.length > 0 && !filters.platforms.includes(game.platform)) {
        return false;
      }

      // Tags filter
      if (filters.tags.length > 0 && !filters.tags.some(tag => game.tags.includes(tag))) {
        return false;
      }

      // Author filter
      if (filters.author && !game.author.toLowerCase().includes(filters.author.toLowerCase())) {
        return false;
      }

      // Rating filter
      if (filters.rating > 0 && game.rating < filters.rating) {
        return false;
      }

      return true;
    });
  }, [filters, allGames]);

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <Header />

      <main className="py-24 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              All Games
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover and play games from our decentralized library
            </p>
          </div>

          {/* Filter Section */}
          <FilterSection onFiltersChange={setFilters} />

          {/* Results Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-semibold text-gray-800">
              Games Found
              <span className="ml-2 text-lg text-gray-600">
                ({filteredGames.length} of {allGames.length})
              </span>
            </h2>
            {filteredGames.length === 0 && (
              <p className="text-gray-500">No games match your current filters</p>
            )}
          </div>

          {/* Games Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                title={game.title}
                genre={game.genre}
                coverImage={game.coverImage}
              />
            ))}
          </div>

          {/* Empty State */}
          {filteredGames.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎮</div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-2">
                No games found
              </h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters to see more games
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Games;