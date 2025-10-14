/**
 * Game Page
 *
 * Displays and runs NES games from Nostr events (kind 31996).
 * Now uses an iframe-based Emulator (EmulatorIFrame + public/embed.html).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNostr } from '@jsr/nostrify__react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, RefreshCw } from 'lucide-react';

// Import ROM utilities for parsing Nostr events
import { decodeBase64ToBytes, parseINesHeader, sha256, validateNESRom } from '@/emulator/utils/rom';
import { analyzeRom, generateRecommendations, quickCompatibilityCheck } from '@/emulator/utils/romDebugger';
import { isMultiplayerGame, getMaxPlayers } from '@/lib/gameUtils';
import EmulatorIFrame, { EmulatorJSRef } from '@/components/EmulatorIFrame';
import GameInteractionCard from '@/components/GameInteractionCard';
import MultiplayerCard from '@/components/MultiplayerCard';
import MultiplayerChat from '@/components/MultiplayerChat';
import GameControls from '@/components/GameControls';

import type { NostrEvent } from '@jsr/nostrify__nostrify';

/**
 * Helper functions for flexible tag parsing
 */
function getTag(event: NostrEvent, name: string) {
  return event.tags.find(t => t[0] === name);
}

function getTagValuesFlex(event: NostrEvent, name: string) {
  const out = [];
  for (const t of event.tags) {
    if (t[0] === name) {
      out.push(...t.slice(1).filter(Boolean));
    }
  }
  return out;
}

type PlayerState = 'loading' | 'ready' | 'error';
type SessionStatus = 'idle' | 'creating' | 'available' | 'full' | 'error';

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
  const [romData, setRomData] = useState<Uint8Array | null>(null);
  const [platform, setPlatform] = useState<string>('nes-rom');
  const [gameEvent, setGameEvent] = useState<NostrEvent | null>(null);
  const [multiplayerSessionStatus, setMultiplayerSessionStatus] = useState<SessionStatus>('idle');
  const [reloadToken, setReloadToken] = useState(0);

  // Refs for multiplayer integration
  const emulatorRef = useRef<EmulatorJSRef>(null);

  // Handle multiplayer stream start
  const handleStreamStart = (_stream: MediaStream) => {
    console.log('[GamePage] Multiplayer stream started');
  };

  // Get canvas stream for multiplayer
  const getGameCanvas = () => {
    if (emulatorRef.current) {
      return emulatorRef.current.getCanvasStream();
    }
    return null;
  };

  /**
   * Fetch game event and prepare ROM
   */
    const loadGameData = useCallback(async () => {
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

        // Store the event for multiplayer detection
        setGameEvent(event);

        // Parse game metadata from event
        const meta = parseGameMetadata(event);
        setGameMeta(meta);
        console.log('[GamePage] Game metadata parsed:', meta);

        // Extract platform from platforms tag
        const platforms = getTagValuesFlex(event, 'platforms');
        const detectedPlatform = platforms[0] || 'nes-rom';
        setPlatform(detectedPlatform);
        console.log('[GamePage] Platform detected:', detectedPlatform);

        // Check encoding tag
        const encodingTag = getTag(event, 'encoding');
        const encoding = encodingTag?.[1];

        console.log('[GamePage] Encoding detected:', encoding || 'base64 (legacy)');

        // Decode ROM based on encoding
        let romBytes: Uint8Array;

        if (encoding === 'url') {
          console.log('[GamePage] Loading ROM from URL (Blossom)');

          // Get URL from url tag
          const urlTag = getTag(event, 'url');
          const romUrl = urlTag?.[1];

          if (!romUrl) {
            throw new Error('encoding=url specified but no url tag found');
          }

          console.log('[GamePage] Fetching ROM from URL:', romUrl);

          try {
            const response = await fetch(romUrl, {
              method: 'GET',
              mode: 'cors',
              credentials: 'omit'
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            romBytes = new Uint8Array(arrayBuffer);
            console.log('[GamePage] ROM fetched from URL, size:', romBytes.length, 'bytes');

          } catch (fetchError) {
            throw new Error(`Failed to fetch ROM from URL: ${fetchError instanceof Error ? fetchError.message : 'Network error'}`);
          }

        } else if (encoding === 'base64' || !encoding) {
          // Legacy base64 encoding
          console.log('[GamePage] Decoding base64 ROM from event content');

          try {
            romBytes = decodeBase64ToBytes(event.content);
            console.log('[GamePage] ROM decoded, size:', romBytes.length, 'bytes');
          } catch (decodeError) {
            throw new Error(`Failed to decode base64 ROM: ${decodeError instanceof Error ? decodeError.message : 'Invalid base64 data'}`);
          }

        } else {
          throw new Error(`Unsupported encoding: ${encoding}. Expected 'base64' or 'url'.`);
        }

        // Map platform to emulator core
        const platformToCore: Record<string, string> = {
          'nes-rom':  'nes',
          'snes-rom': 'snes',
          'gb-rom':   'gb',
          'gbc-rom':  'gbc',
          'gba-rom':  'gba',
          'n64-rom':  'n64',
        };
        const emuCore = platformToCore[detectedPlatform] ?? detectedPlatform;
        setPlatform(emuCore);
        console.log('[GamePage] Platform mapped to core:', detectedPlatform, '→', emuCore);

        // Integrity check for Blossom URLs
        if (encoding === 'url') {
          console.log('[GamePage] Performing integrity check for Blossom ROM');

          // Get expected hash from various possible tags
          const expectedHash = getTag(event, 'sha256')?.[1] ||
                              getTag(event, 'x')?.[1] ||
                              getTag(event, 'ox')?.[1];

          if (expectedHash) {
            console.log('[GamePage] Expected hash found:', expectedHash);
            const actualHash = await sha256(romBytes);

            if (actualHash !== expectedHash) {
              throw new Error(`ROM integrity check failed. Expected SHA256: ${expectedHash.substring(0, 8)}..., got: ${actualHash.substring(0, 8)}...`);
            }
            console.log('[GamePage] Integrity check passed');
          } else {
            console.log('[GamePage] No integrity hash found, skipping verification');
          }
        }

        // Platform-specific ROM validation and processing
        if (emuCore === 'nes') {
          console.log('[GamePage] Performing NES ROM validation and analysis');

          // Validate ROM format
          validateNESRom(romBytes);

          // Perform detailed ROM analysis
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

          console.log('[GamePage] NES ROM validation passed');

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
        } else {
          // For non-NES ROMs, skip NES validation and just compute hash
          console.log('[GamePage] Processing non-NES ROM, skipping NES validation');

          const hash = await sha256(romBytes);
          const info: RomInfo = {
            size: romBytes.length,
            sha256: hash,
            header: {
              mapper: 0,
              prgBanks: 0,
              chrBanks: 0,
            }
          };
          setRomInfo(info);
        }

        // Store ROM data for EmulatorJS
        setRomData(romBytes);
        setStatus('ready');
        console.log('[GamePage] Game ready to play');

      } catch (err) {
        console.error('[GamePage] Error loading game:', err);
        setError(err instanceof Error ? err.message : 'Failed to load game');
        setStatus('error');
      }
    }, [id, nostr]);

    useEffect(() => {
      loadGameData();
    }, [loadGameData, reloadToken]);

  /**
   * Retry loading the game
   */
  const handleRetry = () => {
    setRomData(null);
    setRomInfo(null);
    setError(null);
    setStatus('loading');
    setReloadToken(t => t + 1);
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

  if (!gameMeta || !romData || !gameEvent) {
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

  // Detect if this is a multiplayer game
  const isMultiplayer = isMultiplayerGame(gameEvent);
  const maxPlayers = getMaxPlayers(gameEvent);

  // Show chat when session is available or full
  const showMultiplayerChat = isMultiplayer && ['available', 'full'].includes(multiplayerSessionStatus);

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
                  {platform === 'nes' && romInfo?.header.mapper !== undefined && (
                    <span className="bg-gray-800 px-2 py-1 rounded text-xs">
                      Mapper {romInfo.header.mapper}
                    </span>
                  )}
                  {romInfo && (
                    <span className="text-xs">
                      {Math.round(romInfo.size / 1024)}KB
                    </span>
                  )}
                  {gameMeta.version && (
                    <span className="bg-blue-800 px-2 py-1 rounded text-xs">
                      v{gameMeta.version}
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
            <EmulatorIFrame
              key={`${id}-${romInfo?.sha256?.slice(0,8) ?? 'nohash'}-${reloadToken}`}
              romData={romData}
              platform={platform}
              title={gameMeta.title}
              className="w-full"
              ref={emulatorRef}
              isHost={isMultiplayer}
              addVideoTrackToPeerConnection={undefined} // This will be passed from MultiplayerCard if needed
            />
          </div>

          {/* Side panel */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Conditional rendering: MultiplayerCard for multiplayer games, GameInteractionCard for single-player */}
              {isMultiplayer ? (
                <MultiplayerCard
                  gameMeta={gameMeta}
                  onSessionStatusChange={setMultiplayerSessionStatus}
                  onStreamStart={handleStreamStart}
                  getGameStream={getGameCanvas}
                  maxPlayers={maxPlayers}
                />
              ) : (
                <GameInteractionCard />
              )}

              {/* Show chat panel for multiplayer when session is active */}
              {showMultiplayerChat && (
                <MultiplayerChat
                  onlineCount={3}
                  currentUser="You"
                  isHost={true}
                />
              )}

              {/* Game controls for multiplayer games */}
              {isMultiplayer && (
                <GameControls />
              )}

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
                          {platform === 'nes' ? (
                            <>
                              <div>PRG Banks: {romInfo.header.prgBanks}</div>
                              <div>CHR Banks: {romInfo.header.chrBanks}</div>
                              <div>Mapper: {romInfo.header.mapper}</div>
                            </>
                          ) : (
                            <div>Platform: {platform.toUpperCase()}</div>
                          )}
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

  // Get genres and modes from new taxonomy (mode/genre tags)
  // Fall back to legacy t tags for backward compatibility
  const newGenres = getTagValuesFlex(event, 'genre');
  const newModes = getTagValuesFlex(event, 'mode');

  const legacyTags = getTagValuesFlex(event, 't');
  const knownModes = ['singleplayer', 'multiplayer', 'co-op', 'competitive'];

  // If we have new taxonomy tags, use them
  const genres = newGenres.length > 0 ? newGenres : legacyTags.filter(t => !knownModes.includes(t));
  const modes = newModes.length > 0 ? newModes : legacyTags.filter(t => knownModes.includes(t));

  // Get asset URLs, supporting both new ["image","type",url] and legacy ["image",url] formats
  const getAssetUrl = (assetType: string): string | undefined => {
    // Try new format first: ["image", "cover", url]
    const newFormatTag = event.tags.find(t => t[0] === 'image' && t[1] === assetType);
    if (newFormatTag?.[2]) {
      return newFormatTag[2];
    }

    // Fall back to legacy format: ["image", url] (treated as cover)
    if (assetType === 'cover') {
      const legacyTag = event.tags.find(t => t[0] === 'image' && t.length === 2);
      return legacyTag?.[1];
    }

    return undefined;
  };

  // Parse version: try 'ver' first, fallback to 'version'
  const version = getTagValue('ver') || getTagValue('version');

  return {
    id: getTagValue('d') || event.id,
    title: getTagValue('name') || 'Unknown Game',
    summary: getTagValue('summary'),
    genres,
    modes,
    status: getTagValue('status'),
    version,
    credits: getTagValue('credits'),
    platforms: getTagValuesFlex(event, 'platforms'),
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