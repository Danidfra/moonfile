/**
 * EmulatorJS Player Component
 *
 * React component that uses EmulatorJS to play retro games.
 * Supports multiple systems based on MIME type detection.
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize, AlertTriangle } from 'lucide-react';
import NesPlayer from '@/components/NesPlayer';

interface EmulatorJSPlayerProps {
  romData: string; // Base64 ROM data
  mimeType?: string; // MIME type to determine core
  title?: string;
  className?: string;
  isHost?: boolean;
  peerConnectionRef?: React.MutableRefObject<RTCPeerConnection | null>;
  addVideoTrackToPeerConnection?: (videoTrack: MediaStreamTrack, stream: MediaStream) => void;
}

export interface EmulatorJSPlayerRef {
  getCanvasStream: () => MediaStream | null;
}

// MIME type to EmulatorJS core mapping
const MIME_TO_CORE: Record<string, string> = {
  'application/x-nes-rom': 'nes',
  'application/x-snes-rom': 'snes',
  'application/x-nintendo-ds-rom': 'nds',
  'application/x-gameboy-rom': 'gb',
  'application/x-gameboy-advance-rom': 'gba',
  'application/x-nintendo-64-rom': 'n64',
  'application/x-sega-genesis-rom': 'segaMD',
  'application/x-sega-master-system-rom': 'segaMS',
  'application/x-sega-game-gear-rom': 'segaGG',
  'application/x-sega-32x-rom': 'sega32x',
  'application/x-sega-cd-rom': 'segaCD',
  'application/x-sega-saturn-rom': 'segaSaturn',
  'application/x-atari-2600-rom': 'atari2600',
  'application/x-atari-5200-rom': 'atari5200',
  'application/x-atari-7800-rom': 'atari7800',
  'application/x-atari-lynx-rom': 'lynx',
  'application/x-atari-jaguar-rom': 'jaguar',
  'application/x-playstation-rom': 'psx',
  'application/x-psp-rom': 'psp',
  'application/x-virtual-boy-rom': 'vb',
  'application/x-arcade-rom': 'arcade',
  'application/x-3do-rom': '3do',
  'application/x-colecovision-rom': 'coleco',
  'application/x-commodore-64-rom': 'vice_x64sc',
  'application/x-commodore-128-rom': 'vice_x128',
  'application/x-commodore-vic20-rom': 'vice_xvic',
  'application/x-commodore-plus4-rom': 'vice_xplus4',
  'application/x-commodore-pet-rom': 'vice_xpet',
  'application/x-pc-engine-rom': 'pce',
  'application/x-neo-geo-pocket-rom': 'ngp',
  'application/x-wonderswan-rom': 'ws',
};

const EmulatorJSPlayer = forwardRef<EmulatorJSPlayerRef, EmulatorJSPlayerProps>(({
  romData,
  mimeType,
  title = "Retro Game",
  className = "",
  isHost = false,
  peerConnectionRef,
  addVideoTrackToPeerConnection
}: EmulatorJSPlayerProps, ref) => {
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emulatorKey, setEmulatorKey] = useState(0);
  const [useFallback, setUseFallback] = useState(false);

  const emulatorContainerRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const emulatorInstanceRef = useRef<any>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getCanvasStream: () => {
      console.log('[EmulatorJSPlayer] 📹 getCanvasStream called via ref');
      // EmulatorJS canvas streaming would need to be implemented
      // For now, return null as this needs EmulatorJS API integration
      return null;
    }
  }));

  // Determine core from MIME type
  const getCore = (mime?: string): string => {
    if (!mime) {
      console.warn('[EmulatorJSPlayer] No MIME type provided, defaulting to NES');
      return 'nes';
    }

    const core = MIME_TO_CORE[mime];
    if (!core) {
      console.warn(`[EmulatorJSPlayer] Unknown MIME type: ${mime}, defaulting to NES`);
      return 'nes';
    }

    console.log(`[EmulatorJSPlayer] MIME type ${mime} mapped to core: ${core}`);
    return core;
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Initialize EmulatorJS
  useEffect(() => {
    const initializeEmulator = async () => {
      try {
        console.log('[EmulatorJSPlayer] Initializing EmulatorJS...');
        setError(null);
        setUseFallback(false);

        if (!romData) {
          throw new Error('No ROM data provided');
        }

        // Determine the core to use
        const core = getCore(mimeType);

        // Convert base64 to blob URL for EmulatorJS
        const binaryString = atob(romData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes]);
        const gameUrl = URL.createObjectURL(blob);

        // Clear previous game container
        if (gameContainerRef.current) {
          gameContainerRef.current.innerHTML = '';
        }

        // Check if EmulatorJS files exist before trying to load them
        const loaderResponse = await fetch('/emulatorjs/loader.js');
        if (!loaderResponse.ok) {
          throw new Error('EmulatorJS loader.js not found');
        }

        // Set up EmulatorJS configuration
        (window as any).EJS_player = `#game-${emulatorKey}`;
        (window as any).EJS_gameName = title;
        (window as any).EJS_biosUrl = "";
        (window as any).EJS_gameUrl = gameUrl;
        (window as any).EJS_core = core;
        (window as any).EJS_pathtodata = "/emulatorjs/";
        (window as any).EJS_startOnLoaded = true;
        (window as any).EJS_DEBUG_XX = false;
        (window as any).EJS_disableDatabases = true;
        (window as any).EJS_threads = false;

        // Load EmulatorJS CSS first
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/emulatorjs/emulator.css';
        document.head.appendChild(cssLink);

        // Load EmulatorJS script with timeout
        const script = document.createElement('script');
        script.src = '/emulatorjs/loader.js';

        const loadPromise = new Promise<void>((resolve, reject) => {
          script.onload = () => {
            console.log('[EmulatorJSPlayer] EmulatorJS script loaded');
            resolve();
          };
          script.onerror = (error) => {
            console.error('[EmulatorJSPlayer] Script load error:', error);
            reject(new Error('Failed to load EmulatorJS script'));
          };

          // Timeout after 10 seconds
          setTimeout(() => {
            reject(new Error('EmulatorJS script load timeout'));
          }, 10000);
        });

        document.head.appendChild(script);

        await loadPromise;
        setIsReady(true);

        // Cleanup function
        return () => {
          URL.revokeObjectURL(gameUrl);
          // Note: We don't remove the script/css as they might be used by other instances
        };

      } catch (err) {
        console.error('[EmulatorJSPlayer] Error initializing emulator:', err);

        // If it's a NES ROM, try falling back to the original NES player
        if (getCore(mimeType) === 'nes') {
          console.log('[EmulatorJSPlayer] Attempting fallback to NES player');
          setUseFallback(true);
          setIsReady(true);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to initialize emulator');
        }
      }
    };

    initializeEmulator();
  }, [romData, mimeType, title, emulatorKey]);

  // Toggle fullscreen function
  const toggleFullscreen = () => {
    if (!emulatorContainerRef.current) return;

    if (!document.fullscreenElement) {
      const elem = emulatorContainerRef.current;
      if (elem?.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  const handlePlayPause = () => {
    // EmulatorJS pause/resume would need to be implemented via their API
    setIsPaused(!isPaused);
    console.log(`[EmulatorJSPlayer] ${isPaused ? 'Resuming' : 'Pausing'} game`);
  };

  const handleReset = () => {
    // Force remount of emulator component to reset game
    setEmulatorKey(prev => prev + 1);
    setIsPaused(false);
    setIsReady(false);
    console.log('[EmulatorJSPlayer] Resetting game');
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    console.log(`[EmulatorJSPlayer] Audio ${newMutedState ? 'muted' : 'unmuted'}`);
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Card className="w-full max-w-4xl border-destructive">
          <CardContent className="p-8 text-center">
            <div className="text-destructive text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-destructive mb-2">Error Loading Game</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Card className="w-full max-w-4xl">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading {title}...</p>
            <p className="text-xs text-muted-foreground mt-2">
              Core: {getCore(mimeType)} | MIME: {mimeType || 'unknown'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use fallback NES player if EmulatorJS failed to load and it's a NES ROM
  if (useFallback && getCore(mimeType) === 'nes') {
    // Convert base64 back to binary string for NES player
    const binaryString = atob(romData);

    return (
      <div className={className}>
        <Card className="w-full max-w-4xl mb-4 border-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">
                Using fallback NES emulator (EmulatorJS unavailable)
              </span>
            </div>
          </CardContent>
        </Card>
        <NesPlayer
          romPath={binaryString}
          title={title}
          className="w-full"
          ref={ref}
          isHost={isHost}
          peerConnectionRef={peerConnectionRef}
          addVideoTrackToPeerConnection={addVideoTrackToPeerConnection}
        />
      </div>
    );
  }

  return (
    <div
      ref={emulatorContainerRef}
      className={`flex flex-col items-center space-y-4 ${className} ${isFullscreen ? 'fullscreen-mode' : ''}`}
    >
      {/* Game Title - Hidden in fullscreen */}
      {!isFullscreen && (
        <Card className="w-full max-w-4xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-center">{title}</CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Game Display */}
      <Card className={`w-full max-w-4xl bg-black border-2 ${isFullscreen ? 'fullscreen-card' : ''}`}>
        <CardContent className={`p-4 ${isFullscreen ? 'fullscreen-content' : ''}`}>
          <div
            className={`relative bg-black rounded-lg overflow-hidden flex items-center justify-center ${isFullscreen ? 'fullscreen-canvas' : ''}`}
            style={{ minHeight: isFullscreen ? '100vh' : '600px' }}
          >
            <div
              id={`game-${emulatorKey}`}
              ref={gameContainerRef}
              className="w-full h-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Controls - Hidden in fullscreen */}
      {!isFullscreen && (
        <>
          <Card className="w-full max-w-4xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={handlePlayPause}
                  variant={isPaused ? "default" : "secondary"}
                  size="lg"
                >
                  {isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
                  {isPaused ? 'Play' : 'Pause'}
                </Button>

                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Reset
                </Button>

                <Button
                  onClick={handleMuteToggle}
                  variant="ghost"
                  size="lg"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>

                <Button
                  onClick={toggleFullscreen}
                  variant="ghost"
                  size="lg"
                  title="Toggle fullscreen (F)"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </Button>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${
                    isPaused ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></div>
                  {isPaused ? 'Paused' : 'Running'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card className="w-full max-w-4xl">
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <h4 className="font-semibold text-sm">System Information</h4>
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div className="space-y-1">
                    <div><strong>Core:</strong> {getCore(mimeType)}</div>
                    <div><strong>MIME:</strong> {mimeType || 'unknown'}</div>
                  </div>
                  <div className="space-y-1">
                    <div><strong>Engine:</strong> EmulatorJS</div>
                    <div><strong>Backend:</strong> RetroArch</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
});

EmulatorJSPlayer.displayName = 'EmulatorJSPlayer';

export default EmulatorJSPlayer;