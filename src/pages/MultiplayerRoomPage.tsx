import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, Users, Settings } from 'lucide-react';

// Import ROM utilities for parsing Nostr events
import { decodeBase64ToBytes, parseINesHeader, sha256, validateNESRom } from '@/emulator/utils/rom';
import { analyzeRom, generateRecommendations, quickCompatibilityCheck } from '@/emulator/utils/romDebugger';
import NesPlayer from '@/components/NesPlayer';
import MultiplayerChatPanel from '@/components/MultiplayerChatPanel';
import MultiplayerWaitingScreen from '@/components/MultiplayerWaitingScreen';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';

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

export default function MultiplayerRoomPage() {
  const { gameId, roomId } = useParams<{ gameId: string; roomId: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();

  // Multiplayer room state
  const {
    roomState,
    startGame,
    isHost,
    sendChatMessage,
    setEmulatorStartCallback,
    joinGame,
    isJoining,
    connectionState,
    iceConnectionState,
    isWebRTCConnected,
    hasConnectionTimedOut,
    retryConnection
  } = useMultiplayerRoom(roomId || '', gameId || '');

  // Game state
  const [status, setStatus] = useState<PlayerState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [gameMeta, setGameMeta] = useState<GameMetadata | null>(null);
  const [romInfo, setRomInfo] = useState<RomInfo | null>(null);
  const [romPath, setRomPath] = useState<string | null>(null);
  const [shouldStartEmulator, setShouldStartEmulator] = useState(false);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  /**
   * Fetch game event and prepare ROM
   */
  useEffect(() => {
    const loadGameData = async () => {
      if (!nostr || !gameId) return;

      try {
        console.log('[MultiplayerRoomPage] Fetching game event with id:', gameId);
        setStatus('loading');
        setError(null);

        // Fetch the kind:31996 event by d-tag
        const events = await nostr.query([{
          kinds: [31996],
          '#d': [gameId],
          limit: 1
        }], {
          signal: AbortSignal.timeout(10000)
        });

        if (events.length === 0) {
          throw new Error(`Game with id "${gameId}" not found`);
        }

        const event = events[0] as NostrEvent;
        console.log('[MultiplayerRoomPage] Event fetched successfully, id:', event.id);

        // Parse game metadata from event
        let meta: GameMetadata;
        try {
          meta = parseGameMetadata(event);
          setGameMeta(meta);
          console.log('[MultiplayerRoomPage] Game metadata parsed:', meta);
        } catch (parseError) {
          console.error('[MultiplayerRoomPage] Error parsing game metadata:', parseError);
          throw new Error(`Failed to parse game metadata: ${parseError instanceof Error ? parseError.message : 'Invalid event format'}`);
        }

        // Check encoding tag
        const encodingTag = event.tags.find(tag => tag[0] === 'encoding');
        const encoding = encodingTag?.[1];

        if (encoding !== 'base64') {
          throw new Error(`Unsupported encoding: ${encoding || 'none'}. Expected base64.`);
        }

        console.log('[MultiplayerRoomPage] Decoding base64 ROM from event content');

        // Decode ROM from event content
        let romBytes: Uint8Array;
        try {
          romBytes = decodeBase64ToBytes(event.content);
          console.log('[MultiplayerRoomPage] ROM decoded, size:', romBytes.length, 'bytes');
        } catch (decodeError) {
          throw new Error(`Failed to decode base64 ROM: ${decodeError instanceof Error ? decodeError.message : 'Invalid base64 data'}`);
        }

        // Validate ROM format
        validateNESRom(romBytes);

        // Perform detailed ROM analysis
        console.log('[MultiplayerRoomPage] Performing detailed ROM analysis...');
        const romAnalysis = analyzeRom(romBytes);
        const recommendations = generateRecommendations(romAnalysis);
        const compatCheck = quickCompatibilityCheck(romBytes);

        console.log('[MultiplayerRoomPage] ROM analysis complete:', {
          compatible: compatCheck.compatible,
          reason: compatCheck.reason,
          recommendations
        });

        if (!compatCheck.compatible) {
          console.warn('[MultiplayerRoomPage] ROM compatibility warning:', compatCheck.reason);
        }

        // Parse header and compute hash
        const header = parseINesHeader(romBytes);
        const hash = await sha256(romBytes);

        console.log('[MultiplayerRoomPage] ROM validation passed');

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
        console.log('[MultiplayerRoomPage] Game ready to play');

      } catch (err) {
        console.error('[MultiplayerRoomPage] Error loading game:', err);
        setError(err instanceof Error ? err.message : 'Failed to load game');
        setStatus('error');
      }
    };

    loadGameData();

    // Cleanup - no blob URLs to revoke anymore
    return () => {
      // No cleanup needed for binary strings
    };
  }, [gameId, nostr]);

  /**
   * Set up emulator start callback for host
   */
  useEffect(() => {
    if (isHost) {
      setEmulatorStartCallback(() => {
        console.log('[MultiplayerRoomPage] 🔥 Emulator start callback triggered (host)');
        setShouldStartEmulator(true);
      });
    }
  }, [isHost, setEmulatorStartCallback]);

  /**
   * Auto-scroll to game area when all players are connected
   */
  useEffect(() => {
    if (roomState.connectedPlayers.length >= roomState.requiredPlayers && gameAreaRef.current) {
      console.log('[MultiplayerRoomPage] All players connected, scrolling to game area');
      gameAreaRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [roomState.connectedPlayers.length, roomState.requiredPlayers]);

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

  /**
   * Leave the current room and go back to games
   */
  const handleLeaveRoom = () => {
    console.log('[MultiplayerRoomPage] User leaving room');
    navigate('/games');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl border-gray-800 bg-gray-900">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-white mb-2">Loading Multiplayer Room</h3>
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
            <h3 className="text-xl font-semibold text-white mb-2">Error Loading Multiplayer Room</h3>
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

  if (!gameMeta || !romPath || !roomId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-2xl border-gray-800 bg-gray-900">
          <CardContent className="p-8 text-center">
            <p className="text-gray-400">Multiplayer room data not available</p>
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

              <div className="flex items-center gap-3">
                {gameMeta.assets?.cover && (
                  <img
                    src={gameMeta.assets.cover}
                    alt={gameMeta.title}
                    className="w-10 h-10 rounded object-cover"
                  />
                )}
                <div>
                  <h1 className="text-xl font-bold text-white">{gameMeta.title}</h1>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Badge variant="secondary" className="bg-purple-900 text-purple-300 border-purple-700">
                      <Users className="w-3 h-3 mr-1" />
                      Multiplayer Room
                    </Badge>
                    <span className="text-xs">Room: {roomId}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-gray-300">
                <Settings className="w-4 h-4 mr-2" />
                Room Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Game Summary */}
      {gameMeta.summary && (
        <div className="bg-gray-900/50 border-b border-gray-800">
          <div className="container mx-auto px-4 py-3">
            <p className="text-sm text-gray-300">{gameMeta.summary}</p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main game area */}
          <div ref={gameAreaRef} className="lg:col-span-3">
            {/* Show waiting screen if WebRTC is not connected yet */}
            {!isWebRTCConnected || roomState.status === 'error' || roomState.status === 'room_full' ? (
              <MultiplayerWaitingScreen
                status={roomState.status}
                connectedPlayers={roomState.connectedPlayers}
                requiredPlayers={roomState.requiredPlayers}
                hostPubkey={roomState.hostPubkey}
                isHost={isHost}
                onStartGame={startGame}
                error={roomState.error}
                shareableLink={roomState.shareableLink}
                canJoinGame={roomState.canJoinGame}
                onJoinGame={joinGame}
                isJoining={isJoining}
                connectionState={connectionState}
                iceConnectionState={iceConnectionState}
                hasConnectionTimedOut={hasConnectionTimedOut}
                onRetryConnection={retryConnection}
                onLeaveRoom={handleLeaveRoom}
              />
            ) : (
              /* Show emulator or stream view based on role */
              <div>
                {shouldStartEmulator ? (
                  /* Host: Show actual emulator */
                  <NesPlayer
                    romPath={romPath}
                    title={gameMeta.title}
                    className="w-full"
                  />
                ) : isHost ? (
                  /* Host: WebRTC connected but emulator not started yet */
                  <Card className="border-gray-800 bg-gray-900">
                    <CardContent className="py-12 px-8 text-center">
                      <div className="max-w-sm mx-auto space-y-4">
                        <div className="text-green-400 text-4xl mb-4">✅</div>
                        <h3 className="text-lg font-semibold text-white">WebRTC Connected!</h3>
                        <p className="text-gray-400">
                          Emulator will start automatically when connection is fully established.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  /* Guest: Show stream placeholder */
                  <Card className="border-gray-800 bg-gray-900">
                    <CardContent className="py-12 px-8 text-center">
                      <div className="max-w-sm mx-auto space-y-4">
                        <div className="text-blue-400 text-4xl mb-4">📺</div>
                        <h3 className="text-lg font-semibold text-white">Receiving Stream</h3>
                        <p className="text-gray-400">
                          You're connected! The host will stream the game to you.
                        </p>
                        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                          <span className="text-gray-500">Game stream will appear here</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Game Info Card below emulator (only show when emulator is running) */}
            {shouldStartEmulator && (
              <div className="mt-8">
                <Card className="border-gray-800 bg-gray-900">
                  <CardHeader>
                    <CardTitle className="text-white">Game Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {gameMeta.assets?.cover && (
                      <div className="aspect-video rounded-lg overflow-hidden">
                        <img
                          src={gameMeta.assets.cover}
                          alt={gameMeta.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="space-y-3 text-sm">
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
                        <div className="pt-3 border-t border-gray-800">
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
            )}
          </div>

          {/* Side panel - Multiplayer Chat */}
          <div className="lg:col-span-1">
            <MultiplayerChatPanel
              gameTitle={gameMeta.title}
              roomId={roomId}
              connectedPlayers={roomState.connectedPlayers}
              hostPubkey={roomState.hostPubkey}
              chatMessages={roomState.chatMessages || []}
              isWebRTCConnected={isWebRTCConnected}
              onSendMessage={sendChatMessage}
            />
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