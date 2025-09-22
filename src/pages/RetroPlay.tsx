/**
 * Retro Game Player Page
 * 
 * Dedicated page for playing NES games using jsnes emulator with static ROM files.
 * Loads ROM files from /roms/ directory and provides full emulator experience.
 */

import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import NesPlayer from '@/components/NesPlayer';

// Mapping of game IDs to ROM files and metadata
const GAMES = {
  'super-mario': {
    romPath: '/roms/Super_mario_brothers.nes',
    title: 'Super Mario Bros',
    description: 'The classic platformer that started it all',
    genres: ['platformer', 'action'],
    year: 1985,
    publisher: 'Nintendo'
  },
  'test-game': {
    romPath: '/roms/test-rom.nes',
    title: 'Test Game',
    description: 'Test ROM for emulator development',
    genres: ['test', 'demo'],
    year: 2024,
    publisher: 'Development Team'
  }
};

export default function RetroPlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const game = GAMES[gameId as keyof typeof GAMES];

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-2xl border-destructive">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-destructive mb-4">Game Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The game "{gameId}" is not available.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate('/games')} variant="outline" className="w-full">
                Back to Games
              </Button>
              <Button onClick={() => navigate('/test-mario')} variant="default" className="w-full">
                Try Test Mario
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/games">
                <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Games
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">{game.title}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>{game.year}</span>
                  <span>•</span>
                  <span>{game.publisher}</span>
                  <span>•</span>
                  <span>{game.genres.join(', ')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Game Player */}
          <NesPlayer 
            romPath={game.romPath}
            title={game.title}
            className="w-full"
          />

          {/* Game Information */}
          <Card className="border-gray-800 bg-gray-900">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">About This Game</h2>
                  <p className="text-gray-300 mb-4">{game.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Year</span>
                      <div className="text-white font-medium">{game.year}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Publisher</span>
                      <div className="text-white font-medium">{game.publisher}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Genres</span>
                      <div className="text-white font-medium">{game.genres.join(', ')}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">System</span>
                      <div className="text-white font-medium">Nintendo Entertainment System</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">How to Play</h3>
                  <div className="space-y-4 text-sm text-gray-300">
                    <div>
                      <h4 className="font-medium text-white mb-2">Keyboard Controls</h4>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-gray-400 mb-1">Movement</div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <kbd className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">↑</kbd>
                                <kbd className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">↓</kbd>
                                <kbd className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">←</kbd>
                                <kbd className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">→</kbd>
                                <span className="text-gray-500 ml-2">D-Pad</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">Actions</div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <kbd className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">Enter</kbd>
                                <span className="text-gray-500 ml-2">Start</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <kbd className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">Shift</kbd>
                                <span className="text-gray-500 ml-2">Select</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <kbd className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">Z</kbd>
                                <kbd className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">X</kbd>
                                <span className="text-gray-500 ml-2">B / A Buttons</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-white mb-2">Tips</h4>
                      <ul className="space-y-1 text-gray-300">
                        <li>• Use keyboard controls for best gameplay experience</li>
                        <li>• Press Reset to restart from the beginning</li>
                        <li>• Game saves automatically when you close the page</li>
                        <li>• Make sure your browser allows audio for full experience</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-800 mt-6">
                <Link
                  to="https://soapbox.pub/mkstack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-primary transition-colors"
                >
                  Vibed with MKStack
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}