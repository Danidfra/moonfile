import { useSeoMeta } from '@unhead/react';
import { Header } from "@/components/Header";
import { GameCard } from "@/components/GameCard";

const Games = () => {
  useSeoMeta({
    title: 'Games - MoonFile',
    description: 'Browse and play games on MoonFile, the decentralized arcade powered by Nostr.',
  });

  const games = [
    {
      title: "Space Invaders",
      genre: "Arcade",
      coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop"
    },
    {
      title: "Racing Thunder",
      genre: "Racing",
      coverImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"
    },
    {
      title: "Puzzle Master",
      genre: "Puzzle",
      coverImage: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=300&fit=crop"
    },
    {
      title: "Battle Arena",
      genre: "Multiplayer",
      coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop"
    },
    {
      title: "Snake Classic",
      genre: "Arcade",
      coverImage: "https://images.unsplash.com/photo-1614294148140-0d0c0d7f2f4d?w=400&h=300&fit=crop"
    },
    {
      title: "Tetris Blitz",
      genre: "Puzzle",
      coverImage: "https://images.unsplash.com/photo-1516251193007-45ef94e65d4c?w=400&h=300&fit=crop"
    },
    {
      title: "Street Fighter",
      genre: "Fighting",
      coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop"
    },
    {
      title: "Maze Runner",
      genre: "Adventure",
      coverImage: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"
    }
  ];

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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {games.map((game, index) => (
              <GameCard
                key={index}
                title={game.title}
                genre={game.genre}
                coverImage={game.coverImage}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Games;