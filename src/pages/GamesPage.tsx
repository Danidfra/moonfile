import { useSeoMeta } from '@unhead/react';
import { Header } from '@/components/Header';
import { useNostrGames } from '@/hooks/useNostrGames';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Game31996 } from '@/types/game';

const GamesPage = () => {
  useSeoMeta({
    title: 'Games - Retro Arcade',
    description: 'Browse and play retro games on our decentralized arcade.',
  });

  const { games, loading, error, refetch } = useNostrGames();

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
                onClick={refetch}
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
                {error}
              </p>
              <Button onClick={refetch} className="bg-purple-600 hover:bg-purple-700">
                Try Again
              </Button>
            </div>
          )}

          {/* Games Grid */}
          {!loading && !error && games.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {games.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && games.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Gamepad2 className="w-16 h-16 text-gray-600 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">No Games Found</h2>
              <p className="text-gray-400 mb-6 text-center max-w-md">
                No games are available right now. Check back later or try refreshing.
              </p>
              <Button onClick={refetch} className="bg-purple-600 hover:bg-purple-700">
                Refresh
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

function GameCard({ game }: { game: Game31996 }) {
  return (
    <Card className="border-gray-800 bg-gray-900 hover:border-purple-500 transition-colors">
      <CardHeader className="pb-3">
        {game.assets.cover && (
          <div className="aspect-video rounded-lg overflow-hidden mb-3">
            <img
              src={game.assets.cover}
              alt={game.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <CardTitle className="text-white line-clamp-1">{game.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {game.genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded"
              >
                {genre}
              </span>
            ))}
          </div>

          {game.status && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                game.status === 'released' ? 'bg-green-400' :
                game.status === 'beta' ? 'bg-blue-400' :
                'bg-orange-400'
              }`}></div>
              <span className="text-xs text-gray-400 capitalize">{game.status}</span>
            </div>
          )}

          <Link to={`/game/${game.id}`}>
            <Button className="w-full bg-purple-600 hover:bg-purple-700">
              <Play className="w-4 h-4 mr-2" />
              Play
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default GamesPage;