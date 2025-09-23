/**
 * Game Page
 *
 * Displays and runs NES games from Nostr events (kind 31996).
 * Now uses the jsnes-based Emulator.tsx for game playback.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, RefreshCw } from 'lucide-react';

// Import ROM utilities for parsing Nostr events
import { decodeBase64ToBytes, parseINesHeader, sha256, validateNESRom } from '@/emulator/utils/rom';
import { analyzeRom, generateRecommendations, quickCompatibilityCheck } from '@/emulator/utils/romDebugger';
import NesPlayer from '@/components/NesPlayer';
import GameInteractionCard from '@/components/GameInteractionCard';

import type { NostrEvent } from '@nostrify/nostrify';

type PlayerState = 'loading' | 'ready' | 'error';

interface GameMetadata {
  id: string;
  title: string;
  summary?: string;
  genres: string[];
  modes: string[];
  status?: string;
  version?: string;
  credits?: string;
  platforms: string[];
  assets: {
    cover?: string;
    icon?: string;
    banner?: string;
    screenshots: string[];
  };
}

interface RomInfo {
  size: number;
  sha256: string;
  header: {
    mapper: number;
    prgBanks: number;
    chrBanks: number;
  };
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();

  // Game state
  const [status, setStatus] = useState<PlayerState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [gameMeta, setGameMeta] = useState<GameMetadata | null>(null);
  const [romInfo, setRomInfo] = useState<RomInfo | null>(null);
  const [romPath, setRomPath] = useState<string | null>(null);

  /**
   * Fetch game event and prepare ROM
   */
  useEffect(() => {
    const loadGameData = async () => {
      if (!nostr || !id) return;

      try {
        console.log('[GamePage] Fetching game event with id:', id);
        setStatus('loading');
        setError(null);

        // Fetch the kind:31996 event by d-tag
        const events = await nostr.query([{
          kinds: [31996],
          '#d': [id],
          limit: 1
        }], {
          signal: AbortSignal.timeout(10000)
        });

        if (events.length === 0) {
          throw new Error(`Game with id "${id}" not found`);
        }

        const event = events[0] as NostrEvent;
        console.log('[GamePage] Event fetched successfully, id:', event.id);

        // Parse game metadata from event
        const meta = parseGameMetadata(event);
        setGameMeta(meta);
        console.log('[GamePage] Game metadata parsed:', meta);

        // Check encoding tag
        const encodingTag = event.tags.find(tag => tag[0] === 'encoding');
        const encoding = encodingTag?.[1];

        if (encoding !== 'base64') {
          throw new Error(`Unsupported encoding: ${encoding || 'none'}. Expected base64.`);
        }

        console.log('[GamePage] Decoding base64 ROM from event content');

        // Decode ROM from event content
        let romBytes: Uint8Array;
        try {
          romBytes = decodeBase64ToBytes(event.content);
          console.log('[GamePage] ROM decoded, size:', romBytes.length, 'bytes');
        } catch (decodeError) {
          throw new Error(`Failed to decode base64 ROM: ${decodeError instanceof Error ? decodeError.message : 'Invalid base64 data'}`);
        }

        // Validate ROM format
        validateNESRom(romBytes);

        // Perform detailed ROM analysis
        console.log('[GamePage] Performing detailed ROM analysis...');
        const romAnalysis = analyzeRom(romBytes);
        const recommendations = generateRecommendations(romAnalysis);
        const compatCheck = quickCompatibilityCheck(romBytes);

        console.log('[GamePage] ROM analysis complete:', {
          compatible: compatCheck.compatible,
          reason: compatCheck.reason,
          recommendations
        });

        if (!compatCheck.compatible) {
          console.warn('[GamePage] ROM compatibility warning:', compatCheck.reason);
        }

        // Parse header and compute hash
        const header = parseINesHeader(romBytes);
        const hash = await sha256(romBytes);

        console.log('[GamePage] ROM validation passed');

        const info: RomInfo = {
          size: romBytes.length,
          sha256: hash,
          header: {
            mapper: header.mapper,
            prgBanks: header.prgBanks,
            chrBanks: header.chrBanks,
          }
        };

        setRomInfo(info);

        // Convert ROM bytes to binary string for jsnes
        let romBinaryString = '';
        for (let i = 0; i < romBytes.length; i++) {
          romBinaryString += String.fromCharCode(romBytes[i]);
        }

        setRomPath(romBinaryString);
        setStatus('ready');
        console.log('[GamePage] Game ready to play');

      } catch (err) {
        console.error('[GamePage] Error loading game:', err);
        setError(err instanceof Error ? err.message : 'Failed to load game');
        setStatus('error');
      }
    };

    loadGameData();

    // Cleanup - no blob URLs to revoke anymore
    return () => {
      // No cleanup needed for binary strings
    };
  }, [id, nostr]);

  /**
   * Retry loading the game
   */
  const handleRetry = () => {
    // Clean up current state
    setRomPath(null);
    setRomInfo(null);
    setError(null);

    // Restart loading process
    setStatus('loading');
  };

  /**
   * Navigate back to games list
   */
  const handleBack = () => {
    navigate('/games');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl border-gray-800 bg-gray-900">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-white mb-2">Loading Game</h3>
            <p className="text-gray-400">Fetching game data from Nostr...</p>
            <div className="mt-4">
              <Button onClick={handleBack} variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Games
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl border-red-500 bg-gray-900">
          <CardContent className="p-8 text-center">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-white mb-2">Error Loading Game</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={handleRetry} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={handleBack} variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Games
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameMeta || !romPath) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl border-gray-800 bg-gray-900">
          <CardContent className="p-8 text-center">
            <p className="text-gray-400">Game data not available</p>
            <div className="mt-4">
              <Button onClick={handleBack} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Games
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
              <Button variant="ghost" size="sm" onClick={handleBack} className="text-gray-300 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Games
              </Button>

              <div>
                <h1 className="text-xl font-bold text-white">{gameMeta.title}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  {romInfo?.header.mapper !== undefined && (
                    <span className="bg-gray-800 px-2 py-1 rounded text-xs">
                      Mapper {romInfo.header.mapper}
                    </span>
                  )}
                  {romInfo && (
                    <span className="text-xs">
                      {Math.round(romInfo.size / 1024)}KB
                    </span>
                  )}
                  {gameMeta.status && (
                    <span className="bg-purple-800 px-2 py-1 rounded text-xs">
                      {gameMeta.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main game area */}
          <div className="lg:col-span-3">
            <NesPlayer
              romPath={romPath}
              title={gameMeta.title}
              className="w-full"
            />
          </div>

          {/* Side panel */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Game Interaction Card */}
              <GameInteractionCard />

              {/* Game info */}
              <Card className="border-gray-800 bg-gray-900">
                <CardContent className="p-4 space-y-4">
                  <h3 className="text-lg font-semibold text-white">Game Info</h3>

                  {gameMeta.assets?.cover && (
                    <div className="aspect-video rounded-lg overflow-hidden">
                      <img
                        src={gameMeta.assets.cover}
                        alt={gameMeta.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {gameMeta.summary && (
                    <div>
                      <span className="text-gray-500">Description:</span>
                      <p className="text-gray-300 text-sm mt-1">{gameMeta.summary}</p>
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    {gameMeta.genres?.length > 0 && (
                      <div>
                        <span className="text-gray-500">Genre:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {gameMeta.genres.slice(0, 3).map((genre: string) => (
                            <span key={genre} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                              {genre}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {gameMeta.platforms?.length > 0 && (
                      <div>
                        <span className="text-gray-500">Platform:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {gameMeta.platforms.slice(0, 2).map((platform: string) => (
                            <span key={platform} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                              {platform}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {romInfo && (
                      <div className="pt-2 border-t border-gray-800">
                        <span className="text-gray-500">ROM Info:</span>
                        <div className="text-xs text-gray-400 mt-1 space-y-1">
                          <div>PRG Banks: {romInfo.header.prgBanks}</div>
                          <div>CHR Banks: {romInfo.header.chrBanks}</div>
                          <div>Mapper: {romInfo.header.mapper}</div>
                          <div>Size: {Math.round(romInfo.size / 1024)}KB</div>
                          <div>SHA256: {romInfo.sha256.substring(0, 8)}...</div>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-800 mt-4">
                      <Link
                        to="https://soapbox.pub/mkstack"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-purple-400 transition-colors"
                      >
                        Vibed with MKStack
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Parse game metadata from Nostr event
 */
function parseGameMetadata(event: NostrEvent): GameMetadata {
  const getTagValue = (tagName: string): string | undefined => {
    const tag = event.tags.find(t => t[0] === tagName);
    return tag?.[1];
  };

  const getTagValues = (tagName: string): string[] => {
    return event.tags
      .filter(t => t[0] === tagName)
      .map(t => t[1])
      .filter(Boolean);
  };

  const getAssetUrl = (assetType: string): string | undefined => {
    const tag = event.tags.find(t => t[0] === 'image' && t[1] === assetType);
    return tag?.[2];
  };

  return {
    id: getTagValue('d') || event.id,
    title: getTagValue('name') || 'Unknown Game',
    summary: getTagValue('summary'),
    genres: getTagValues('t').filter(t => !['singleplayer', 'multiplayer', 'co-op', 'competitive'].includes(t)),
    modes: getTagValues('t').filter(t => ['singleplayer', 'multiplayer', 'co-op', 'competitive'].includes(t)),
    status: getTagValue('status'),
    version: getTagValue('version'),
    credits: getTagValue('credits'),
    platforms: getTagValues('platform'),
    assets: {
      cover: getAssetUrl('cover'),
      icon: getAssetUrl('icon'),
      banner: getAssetUrl('banner'),
      screenshots: event.tags
        .filter(t => t[0] === 'image' && t[1] === 'screenshot')
        .map(t => t[2])
        .filter(Boolean)
    }
  };
}