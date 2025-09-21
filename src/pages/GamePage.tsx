import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, RefreshCw } from 'lucide-react';
import { decodeBase64ToBytes, parseINesHeader, sha256, validateNESRom } from '@/emulator/utils/rom';
import { FCEUXWebAdapter } from '@/emulator/cores/fceuxWebAdapter';
import { NesPlayer } from '@/emulator/NesPlayer';
import { useRetroStore } from '@/emulator/state/retroStore';
import type { NostrEvent } from '@/types/game';

type PlayerState = 'loading' | 'ready' | 'running' | 'paused' | 'error';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [player, setPlayer] = useState<NesPlayer | null>(null);
  const [core, setCore] = useState<FCEUXWebAdapter | null>(null);
  const [romData, setRomData] = useState<Uint8Array | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [controls, setControls] = useState({
    right: false,
    left: false,
    down: false,
    up: false,
    start: false,
    select: false,
    b: false,
    a: false,
  });
  const [gameMeta, setGameMeta] = useState<any>(null);
  const [romInfo, setRomInfo] = useState<any>(null);
  
  const { status, error, setStatus, setError, setRomInfo: setStoreRomInfo } = useRetroStore();

  // Debug logging helper
  const logDebug = (phase: string, data?: any) => {
    if (localStorage.getItem('debug')?.includes('retro:*')) {
      console.log(`[GamePage] ${phase}`, data || '');
    }
  };

  // Fetch game event and decode ROM
  useEffect(() => {
    const loadGameData = async () => {
      if (!nostr || !id) return;

      try {
        logDebug('Fetching game event', { id });
        setStatus('loading');

        // Fetch the kind:31996 event by d-tag
        const events = await nostr.query([{
          kinds: [31996],
          '#d': [id],
          limit: 1
        }], {
          signal: AbortSignal.timeout(10000)
        });

        if (events.length === 0) {
          throw new Error('Game not found');
        }

        const event = events[0] as NostrEvent;
        logDebug('Event fetched', { id: event.id });

        // Parse game metadata
        const meta = parseGameMetadata(event);
        setGameMeta(meta);
        logDebug('Game metadata parsed', meta);

        // Decode ROM from event content
        logDebug('Decoding ROM', { contentLength: event.content.length });
        const romBytes = decodeBase64ToBytes(event.content);
        
        // Validate ROM
        logDebug('Validating ROM', { size: romBytes.length });
        validateNESRom(romBytes);

        // Parse header and compute hash
        const header = parseINesHeader(romBytes);
        const hash = await sha256(romBytes);
        
        logDebug('ROM validated', {
          header,
          shortHash: hash.substring(0, 8),
          size: romBytes.length
        });

        const info = {
          size: romBytes.length,
          sha256: hash,
          header: {
            mapper: header.mapper,
            prgBanks: header.prgBanks,
            chrBanks: header.chrBanks,
          }
        };

        setRomInfo(info);
        setStoreRomInfo(info);
        setRomData(romBytes);
        setStatus('ready');

      } catch (err) {
        logDebug('Error loading game', err);
        setError(err instanceof Error ? err.message : 'Failed to load game');
        setStatus('error');
      }
    };

    loadGameData();
  }, [id, nostr, setStatus, setError, setStoreRomInfo]);

  // Initialize core and player on user gesture (Start button click)
  const handleStart = async () => {
    if (!romData || !canvasRef.current) return;

    try {
      logDebug('Starting emulator');
      setStatus('loading');

      // Lazy-load the core
      const fceuxCore = new FCEUXWebAdapter();
      await fceuxCore.init();
      
      logDebug('Core initialized');
      setCore(fceuxCore);

      // Load ROM into core
      const romLoaded = await fceuxCore.loadRom(romData);
      if (!romLoaded) {
        throw new Error('Failed to load ROM into emulator');
      }

      logDebug('ROM loaded into core');

      // Create player with canvas
      const nesPlayer = new NesPlayer(fceuxCore, canvasRef.current);
      setPlayer(nesPlayer);

      // Start playing
      nesPlayer.play();
      setStatus('running');
      logDebug('Emulator started');

    } catch (err) {
      logDebug('Error starting emulator', err);
      setError(err instanceof Error ? err.message : 'Failed to start emulator');
      setStatus('error');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (player) {
        player.dispose();
        logDebug('Player disposed');
      }
    };
  }, [player]);

  // Keyboard controls
  useEffect(() => {
    const keyMap: Record<string, number> = {
      'ArrowRight': 0,
      'ArrowLeft': 1,
      'ArrowDown': 2,
      'ArrowUp': 3,
      'Enter': 4,
      'Shift': 5,
      'z': 6,
      'x': 7,
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const button = keyMap[e.key.toLowerCase()];
      if (button !== undefined && !controls[Object.keys(controls)[button] as keyof typeof controls]) {
        setControls(prev => ({ ...prev, [Object.keys(controls)[button]]: true }));
        core?.setButton(button, true);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const button = keyMap[e.key.toLowerCase()];
      if (button !== undefined && controls[Object.keys(controls)[button] as keyof typeof controls]) {
        setControls(prev => ({ ...prev, [Object.keys(controls)[button]]: false }));
        core?.setButton(button, false);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [controls, core]);

  const handlePlayPause = () => {
    if (!player) return;

    if (status === 'running') {
      player.pause();
      setStatus('paused');
    } else {
      player.play();
      setStatus('running');
    }
  };

  const handleReset = () => {
    core?.reset();
    if (status === 'paused') {
      player?.play();
      setStatus('running');
    }
  };

  const handleRetry = () => {
    // Reset and try again
    setError(null);
    setStatus('loading');
    setPlayer(null);
    setCore(null);
    setRomData(null);
    setRomInfo(null);
    setStoreRomInfo(null);
  };

  const handleBack = () => {
    navigate('/games');
  };

  const handleFullscreen = () => {
    if (canvasRef.current?.requestFullscreen) {
      canvasRef.current.requestFullscreen();
    }
  };

  const handleToggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

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
                <h1 className="text-xl font-bold text-white">{gameMeta?.title || 'Loading Game...'}</h1>
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
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAudio}
                className={audioEnabled ? 'text-green-400' : 'text-red-400'}
              >
                {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>

              <Button variant="ghost" size="sm" onClick={handleFullscreen} className="text-gray-300 hover:text-white">
                <Maximize className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main game area */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* Game canvas */}
              <Card className="border-gray-800 bg-gray-900">
                <CardContent className="p-0">
                  <div className="relative bg-black flex items-center justify-center">
                    {/* Canvas container with proper aspect ratio */}
                    <div className="relative w-full aspect-[256/240]">
                      <canvas
                        ref={canvasRef}
                        width={256}
                        height={240}
                        className="absolute inset-0 w-full h-full"
                        style={{ imageRendering: 'pixelated' }}
                      />

                      {/* Loading overlay */}
                      {status === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                            <p className="text-gray-400">Loading game...</p>
                          </div>
                        </div>
                      )}

                      {/* Ready/Start overlay */}
                      {status === 'ready' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Card className="border-purple-500 bg-purple-900/20">
                            <CardContent className="p-6 text-center">
                              <h3 className="text-lg font-semibold text-white mb-4">Ready to Play</h3>
                              <Button onClick={handleStart} className="bg-purple-600 hover:bg-purple-700">
                                <Play className="w-4 h-4 mr-2" />
                                Start Game
                              </Button>
                              {romInfo && (
                                <p className="text-gray-400 text-xs mt-2">
                                  ROM: {romInfo.header.mapper} mapper, {romInfo.header.prgBanks}PRG, {romInfo.header.chrBanks}CHR
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Error overlay */}
                      {status === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
                          <div className="text-center p-8 max-w-md">
                            <div className="text-red-400 text-6xl mb-4">⚠️</div>
                            <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
                            <p className="text-gray-400 mb-4">{error}</p>
                            <div className="space-y-2">
                              <Button onClick={handleRetry} className="w-full">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Try Again
                              </Button>
                              <Button onClick={handleBack} variant="outline" className="w-full">
                                Back to Games
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Control bar */}
              {status === 'running' || status === 'paused' ? (
                <Card className="border-gray-800 bg-gray-900">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        onClick={handlePlayPause}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {status === 'running' ? 'Pause' : 'Play'}
                      </Button>

                      <Button
                        onClick={handleReset}
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:text-white"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>

                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className={`w-2 h-2 rounded-full ${
                          status === 'running' ? 'bg-green-400' : 'bg-yellow-400'
                        }`}></div>
                        {status === 'running' ? 'Running' : 'Paused'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Keyboard controls hint */}
              <Card className="border-gray-800 bg-gray-900">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-white mb-2">Keyboard Controls</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <kbd className="px-2 py-1 bg-gray-800 rounded text-white">↑ ↓ ← →</kbd>
                        <span>Direction</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <kbd className="px-2 py-1 bg-gray-800 rounded text-white">Enter</kbd>
                        <span>Start</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <kbd className="px-2 py-1 bg-gray-800 rounded text-white">Shift</kbd>
                        <span>Select</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-2 py-1 bg-gray-800 rounded text-white mr-2">Z</kbd>
                        <kbd className="px-2 py-1 bg-gray-800 rounded text-white">X</kbd>
                        <span>B / A</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Side panel */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Game info */}
              {gameMeta && (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to parse game metadata from Nostr event
function parseGameMetadata(event: NostrEvent) {
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