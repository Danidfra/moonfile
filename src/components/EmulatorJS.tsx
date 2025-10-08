/**
 * EmulatorJS Component
 *
 * React component that loads EmulatorJS via CDN and supports multiple console systems
 * (NES, SNES, GBA, etc.) based on the platform tag from Nostr events.
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

// Extend Window interface to include EmulatorJS
declare global {
  interface Window {
    EJS_emulator?: any;
    EJS_player?: string;
    EJS_gameUrl?: string;
    EJS_core?: string;
    EJS_pathtodata?: string;
    EJS_startOnLoaded?: boolean;
    EJS_volume?: number;
    EJS_mute?: boolean;
    EJS_gameParent?: HTMLElement;
    EJS_loadStateOnStart?: boolean;
    EJS_saveStateOnUnload?: boolean;
    EJS_alignStartButton?: string;
    EJS_fullscreenOnDoubleClick?: boolean;
  }
}

interface EmulatorJSProps {
  romData: Uint8Array; // ROM bytes
  platform: string; // Platform from the platforms tag (e.g., "nes-rom", "snes-rom")
  title?: string;
  className?: string;
  isHost?: boolean;
  peerConnectionRef?: React.MutableRefObject<RTCPeerConnection | null>;
  addVideoTrackToPeerConnection?: (videoTrack: MediaStreamTrack, stream: MediaStream) => void;
}

export interface EmulatorJSRef {
  getCanvasStream: () => MediaStream | null;
}

/**
 * Load EmulatorJS script from CDN
 */
function loadEmulatorJSScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.EJS_emulator) {
      console.log('[EmulatorJS] Script already loaded');
      return resolve();
    }

    console.log('[EmulatorJS] Loading script from CDN...');
    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    script.async = true;
    script.onload = () => {
      console.log('[EmulatorJS] Script loaded successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('[EmulatorJS] Failed to load script');
      reject(new Error('Failed to load EmulatorJS'));
    };
    document.body.appendChild(script);
  });
}

/**
 * Map platform tag to EmulatorJS system
 */
function getEmulatorSystemFromPlatform(platform: string): string {
  switch (platform) {
    case 'nes-rom': return 'nes';
    case 'snes-rom': return 'snes';
    case 'gba-rom': return 'gba';
    case 'gb-rom': return 'gb';
    case 'gbc-rom': return 'gbc';
    case 'n64-rom': return 'n64';
    case 'nds-rom': return 'nds';
    case 'genesis-rom': return 'segaMD';
    case 'sega-cd-rom': return 'segaCD';
    case 'sega-32x-rom': return 'sega32x';
    case 'sms-rom': return 'segaMS';
    case 'gg-rom': return 'segaGG';
    case 'psx-rom': return 'psx';
    case 'atari2600-rom': return 'atari2600';
    case 'atari7800-rom': return 'atari7800';
    case 'lynx-rom': return 'lynx';
    case 'jaguar-rom': return 'jaguar';
    case 'vb-rom': return 'vb';
    case 'ws-rom': return 'ws';
    case 'wsc-rom': return 'wsc';
    case 'ngp-rom': return 'ngp';
    case 'ngpc-rom': return 'ngpc';
    case 'pce-rom': return 'pce';
    case 'arcade-rom': return 'arcade';
    default:
      console.warn(`[EmulatorJS] Unknown platform: ${platform}, defaulting to NES`);
      return 'nes';
  }
}

/**
 * Create a blob URL from ROM data
 */
function createRomBlobUrl(romData: Uint8Array): string {
  // Create a new Uint8Array with proper ArrayBuffer to ensure compatibility
  const buffer = new Uint8Array(romData);
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  return URL.createObjectURL(blob);
}

const EmulatorJS = forwardRef<EmulatorJSRef, EmulatorJSProps>(({
  romData,
  platform,
  title = "Game",
  className = "",
  isHost = false,
  peerConnectionRef,
  addVideoTrackToPeerConnection
}: EmulatorJSProps, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const romBlobUrlRef = useRef<string | null>(null);
  const emulatorInstanceRef = useRef<any>(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getCanvasStream: () => {
      console.log('[EmulatorJS] getCanvasStream called via ref');

      if (!gameContainerRef.current) {
        console.warn('[EmulatorJS] Game container not available for stream capture');
        return null;
      }

      // Try to find the canvas element created by EmulatorJS
      const canvas = gameContainerRef.current.querySelector('canvas');
      if (!canvas) {
        console.warn('[EmulatorJS] Canvas not found for stream capture');
        return null;
      }

      try {
        // Capture stream from the canvas
        const stream = canvas.captureStream(60); // 60 FPS
        console.log('[EmulatorJS] Canvas stream captured successfully');
        return stream;
      } catch (error) {
        console.error('[EmulatorJS] Failed to capture canvas stream:', error);
        return null;
      }
    }
  }));

  // Initialize EmulatorJS
  useEffect(() => {
    let mounted = true;

    const initializeEmulator = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('[EmulatorJS] Initializing emulator for platform:', platform);

        // Load EmulatorJS script
        await loadEmulatorJSScript();

        if (!mounted) return;

        // Create blob URL for ROM data
        const romUrl = createRomBlobUrl(romData);
        romBlobUrlRef.current = romUrl;

        console.log('[EmulatorJS] ROM blob URL created:', romUrl);

        // Get EmulatorJS system from platform
        const system = getEmulatorSystemFromPlatform(platform);
        console.log('[EmulatorJS] Using system:', system);

        // Set up EmulatorJS configuration
        window.EJS_player = '#game-container';
        window.EJS_gameUrl = romUrl;
        window.EJS_core = system;
        window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
        window.EJS_startOnLoaded = true;
        window.EJS_volume = isMuted ? 0 : 0.5;
        window.EJS_mute = isMuted;
        window.EJS_loadStateOnStart = false;
        window.EJS_saveStateOnUnload = false;
        window.EJS_alignStartButton = 'center';
        window.EJS_fullscreenOnDoubleClick = true;

        // Wait for container to be available
        if (!gameContainerRef.current) {
          throw new Error('Game container not found');
        }

        // Clear any existing content
        gameContainerRef.current.innerHTML = '';

        console.log('[EmulatorJS] Starting emulator...');

        // Initialize the emulator
        const emulatorInstance = new window.EJS_emulator(
          '#game-container',
          {
            gameUrl: romUrl,
            core: system,
            pathtodata: 'https://cdn.emulatorjs.org/stable/data/',
            startOnLoaded: true,
            volume: isMuted ? 0 : 0.5,
            mute: isMuted
          }
        );

        emulatorInstanceRef.current = emulatorInstance;

        // Wait a bit for the emulator to initialize
        setTimeout(() => {
          if (mounted) {
            setIsReady(true);
            setIsLoading(false);
            console.log('[EmulatorJS] Emulator ready');
          }
        }, 2000);

      } catch (err) {
        console.error('[EmulatorJS] Initialization error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize emulator');
          setIsLoading(false);
        }
      }
    };

    initializeEmulator();

    return () => {
      mounted = false;

      // Cleanup blob URL
      if (romBlobUrlRef.current) {
        URL.revokeObjectURL(romBlobUrlRef.current);
        romBlobUrlRef.current = null;
      }

      // Cleanup emulator instance
      if (emulatorInstanceRef.current) {
        try {
          // Try to stop/destroy the emulator if methods exist
          if (typeof emulatorInstanceRef.current.destroy === 'function') {
            emulatorInstanceRef.current.destroy();
          }
        } catch (error) {
          console.warn('[EmulatorJS] Error during cleanup:', error);
        }
        emulatorInstanceRef.current = null;
      }

      // Clear container
      if (gameContainerRef.current) {
        gameContainerRef.current.innerHTML = '';
      }

      console.log('[EmulatorJS] Component cleanup completed');
    };
  }, [romData, platform, isMuted]);

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

  // Canvas streaming effect for host mode
  useEffect(() => {
    console.log('[EmulatorJS] Canvas streaming effect triggered:', {
      isHost,
      isReady,
      hasAddVideoTrackFn: !!addVideoTrackToPeerConnection,
      timestamp: new Date().toISOString()
    });

    if (!isHost || !addVideoTrackToPeerConnection || !isReady) {
      console.log('[EmulatorJS] Canvas streaming skipped - not host, missing function, or not ready');
      return;
    }

    let isTrackAdded = false;

    const setupCanvasStreaming = () => {
      if (isTrackAdded) {
        console.log('[EmulatorJS] Video track already added, skipping setup');
        return;
      }

      try {
        console.log('[EmulatorJS] Getting canvas stream...');
        const canvasStream = ref && 'current' in ref && ref.current?.getCanvasStream();

        if (!canvasStream) {
          console.error('[EmulatorJS] Failed to get canvas stream');
          return;
        }

        console.log('[EmulatorJS] Canvas stream obtained:', {
          streamId: canvasStream.id,
          videoTracks: canvasStream.getVideoTracks().length,
          audioTracks: canvasStream.getAudioTracks().length
        });

        const videoTracks = canvasStream.getVideoTracks();
        if (videoTracks.length === 0) {
          console.error('[EmulatorJS] No video tracks found in canvas stream');
          return;
        }

        const videoTrack = videoTracks[0];
        console.log('[EmulatorJS] Video track found:', {
          trackId: videoTrack.id,
          kind: videoTrack.kind,
          label: videoTrack.label,
          enabled: videoTrack.enabled,
          muted: videoTrack.muted,
          readyState: videoTrack.readyState
        });

        // Add video track to peer connection
        console.log('[EmulatorJS] Adding video track via addVideoTrackToPeerConnection...');
        addVideoTrackToPeerConnection(videoTrack, canvasStream);

        console.log('[EmulatorJS] Video track successfully added to peer connection');
        isTrackAdded = true;

        videoTrack.onended = () => console.log('[EmulatorJS] Video track ended');
        videoTrack.onmute = () => console.log('[EmulatorJS] Video track muted');
        videoTrack.onunmute = () => console.log('[EmulatorJS] Video track unmuted');

      } catch (error) {
        console.error('[EmulatorJS] Error setting up canvas streaming:', error);
        setError(error instanceof Error ? error.message : 'Failed to setup canvas streaming');
      }
    };

    // Set up polling to check for canvas readiness
    const pollInterval = setInterval(() => {
      if (!isTrackAdded && gameContainerRef.current?.querySelector('canvas')) {
        console.log('[EmulatorJS] Retrying canvas streaming setup...');
        setupCanvasStreaming();
      } else if (isTrackAdded) {
        console.log('[EmulatorJS] Video track added, stopping polling');
        clearInterval(pollInterval);
      }
    }, 500); // Check every 500ms

    return () => {
      clearInterval(pollInterval);
      console.log('[EmulatorJS] Cleaning up canvas streaming effect...');
    };
  }, [isHost, isReady, addVideoTrackToPeerConnection, ref]);

  // Toggle fullscreen function
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      const elem = containerRef.current;
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
    // EmulatorJS doesn't have a direct pause API, this is more for UI consistency
    setIsPaused(!isPaused);
    console.log('[EmulatorJS] Play/Pause toggled (UI only)');
  };

  const handleReset = () => {
    // Try to reset the emulator if possible
    if (emulatorInstanceRef.current && typeof emulatorInstanceRef.current.restart === 'function') {
      emulatorInstanceRef.current.restart();
    } else {
      // Fallback: reload the component
      window.location.reload();
    }
    console.log('[EmulatorJS] Reset requested');
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // Try to update EmulatorJS volume
    if (emulatorInstanceRef.current) {
      try {
        if (typeof emulatorInstanceRef.current.setVolume === 'function') {
          emulatorInstanceRef.current.setVolume(newMutedState ? 0 : 0.5);
        }
      } catch (error) {
        console.warn('[EmulatorJS] Could not update volume:', error);
      }
    }

    console.log(`[EmulatorJS] Audio ${newMutedState ? 'muted' : 'unmuted'}`);
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

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Card className="w-full max-w-4xl">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading {title}...</p>
            <p className="text-xs text-muted-foreground mt-2">
              Initializing EmulatorJS for {platform}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
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
            ref={gameContainerRef}
            id="game-container"
            className={`relative bg-black rounded-lg overflow-hidden flex items-center justify-center ${isFullscreen ? 'fullscreen-canvas' : ''}`}
            style={{ minHeight: isFullscreen ? '100vh' : '600px' }}
          >
            {/* EmulatorJS will inject content here */}
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
                  title="Toggle fullscreen"
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

          {/* Platform Info */}
          <Card className="w-full max-w-4xl">
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <h4 className="font-semibold text-sm">Platform: {platform.replace('-rom', '').toUpperCase()}</h4>
                <p className="text-xs text-muted-foreground">
                  Powered by EmulatorJS • Double-click for fullscreen
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
});

EmulatorJS.displayName = 'EmulatorJS';

export default EmulatorJS;