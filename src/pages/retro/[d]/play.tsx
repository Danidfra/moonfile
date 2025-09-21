import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostrGames } from '@/hooks/useNostrGames';
import { RetroPlayer } from '@/components/retro/RetroPlayer';
import { ROMLoader, type ROMSource } from '@/lib/rom/romLoader';
import type { Game31996 } from '@/types/game';

export default function RetroPlayPage() {
  const { d } = useParams<{ d: string }>();
  const navigate = useNavigate();
  const { games, loading, error } = useNostrGames();
  const [game, setGame] = useState<Game31996 | null>(null);
  const [romSource, setRomSource] = useState<ROMSource | null>(null);

  useEffect(() => {
    if (!d || !games.length) return;

    // Find the game by d-tag
    const foundGame = games.find(g => g.id === d);
    if (!foundGame) {
      // Game not found, redirect back to games page
      navigate('/games');
      return;
    }

    setGame(foundGame);

    // Phase 1: Load ROM from static URL for testing
    // In a real implementation, this would come from the game's configuration
    // or from the Nostr event content in Phase 2
    const testRomUrl = `/roms/${d}.nes`;
    
    setRomSource({
      source: 'url',
      url: testRomUrl
    });
  }, [d, games, navigate]);

  const handleBack = () => {
    navigate('/games');
  };

  const handleFullscreen = () => {
    // Custom fullscreen handling if needed
    // The RetroPlayer component has basic fullscreen support
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Games</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button 
            onClick={handleBack}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  if (!game || !romSource) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-6xl mb-4">🎮</div>
          <h2 className="text-2xl font-bold text-white mb-4">Game Not Found</h2>
          <p className="text-gray-400 mb-6">
            The game you're looking for doesn't exist or couldn't be loaded.
          </p>
          <button 
            onClick={handleBack}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  return (
    <RetroPlayer 
      meta={game}
      romSource={romSource}
      onBack={handleBack}
      onFullscreen={handleFullscreen}
    />
  );
}