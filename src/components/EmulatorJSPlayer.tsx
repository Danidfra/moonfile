/**
 * EmulatorJS Player Component
 *
 * React component that uses EmulatorJS to play games from multiple systems.
 * Automatically selects the appropriate emulator core based on the game's MIME type.
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface EmulatorJSPlayerProps {
  romData: string; // Base64 encoded ROM data
  mimeType: string; // MIME type to determine which emulator core to use
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
  // Nintendo Entertainment System
  'application/x-nes-rom': 'nes',
  'application/x-nintendo-nes-rom': 'nes',

  // Super Nintendo Entertainment System
  'application/x-snes-rom': 'snes',
  'application/x-nintendo-snes-rom': 'snes',

  // Game Boy / Game Boy Color
  'application/x-gameboy-rom': 'gb',
  'application/x-gameboy-color-rom': 'gbc',
  'application/x-nintendo-gameboy-rom': 'gb',

  // Game Boy Advance
  'application/x-gba-rom': 'gba',
  'application/x-gameboy-advance-rom': 'gba',
  'application/x-nintendo-gba-rom': 'gba',

  // Nintendo 64
  'application/x-n64-rom': 'n64',
  'application/x-nintendo-64-rom': 'n64',

  // Sega Genesis/Mega Drive
  'application/x-genesis-rom': 'segaMD',
  'application/x-megadrive-rom': 'segaMD',
  'application/x-sega-genesis-rom': 'segaMD',

  // Sega Master System
  'application/x-sms-rom': 'segaMS',
  'application/x-master-system-rom': 'segaMS',

  // Sega Game Gear
  'application/x-gamegear-rom': 'segaGG',
  'application/x-sega-gamegear-rom': 'segaGG',

  // Atari 2600
  'application/x-atari-2600-rom': 'atari2600',
  'application/x-atari2600-rom': 'atari2600',

  // PlayStation
  'application/x-playstation-rom': 'psx',
  'application/x-psx-rom': 'psx',

  // Neo Geo Pocket
  'application/x-ngp-rom': 'ngp',
  'application/x-neo-geo-pocket-rom': 'ngp',

  // Lynx
  'application/x-lynx-rom': 'lynx',
  'application/x-atari-lynx-rom': 'lynx',

  // Virtual Boy
  'application/x-virtualboy-rom': 'vb',
  'application/x-nintendo-virtualboy-rom': 'vb',

  // WonderSwan
  'application/x-wonderswan-rom': 'ws',

  // PC Engine / TurboGrafx-16
  'application/x-pce-rom': 'pce',
  'application/x-turbografx-rom': 'pce',

  // Nintendo DS
  'application/x-nintendo-ds-rom': 'nds',
  'application/x-nds-rom': 'nds',

  // Arcade (MAME)
  'application/x-mame-rom': 'arcade',
  'application/x-arcade-rom': 'arcade',

  // DOS
  'application/x-dos-executable': 'dos',
  'application/x-msdos-program': 'dos',
};

// System names for display
const MIME_TO_SYSTEM_NAME: Record<string, string> = {
  'application/x-nes-rom': 'Nintendo Entertainment System',
  'application/x-nintendo-nes-rom': 'Nintendo Entertainment System',
  'application/x-snes-rom': 'Super Nintendo Entertainment System',
  'application/x-nintendo-snes-rom': 'Super Nintendo Entertainment System',
  'application/x-gameboy-rom': 'Game Boy',
  'application/x-gameboy-color-rom': 'Game Boy Color',
  'application/x-nintendo-gameboy-rom': 'Game Boy',
  'application/x-gba-rom': 'Game Boy Advance',
  'application/x-gameboy-advance-rom': 'Game Boy Advance',
  'application/x-nintendo-gba-rom': 'Game Boy Advance',
  'application/x-n64-rom': 'Nintendo 64',
  'application/x-nintendo-64-rom': 'Nintendo 64',
  'application/x-genesis-rom': 'Sega Genesis',
  'application/x-megadrive-rom': 'Sega Mega Drive',
  'application/x-sega-genesis-rom': 'Sega Genesis',
  'application/x-sms-rom': 'Sega Master System',
  'application/x-master-system-rom': 'Sega Master System',
  'application/x-gamegear-rom': 'Sega Game Gear',
  'application/x-sega-gamegear-rom': 'Sega Game Gear',
  'application/x-atari-2600-rom': 'Atari 2600',
  'application/x-atari2600-rom': 'Atari 2600',
  'application/x-playstation-rom': 'Sony PlayStation',
  'application/x-psx-rom': 'Sony PlayStation',
  'application/x-ngp-rom': 'Neo Geo Pocket',
  'application/x-neo-geo-pocket-rom': 'Neo Geo Pocket',
  'application/x-lynx-rom': 'Atari Lynx',
  'application/x-atari-lynx-rom': 'Atari Lynx',
  'application/x-virtualboy-rom': 'Nintendo Virtual Boy',
  'application/x-nintendo-virtualboy-rom': 'Nintendo Virtual Boy',
  'application/x-wonderswan-rom': 'WonderSwan',
  'application/x-pce-rom': 'PC Engine',
  'application/x-turbografx-rom': 'TurboGrafx-16',
  'application/x-nintendo-ds-rom': 'Nintendo DS',
  'application/x-nds-rom': 'Nintendo DS',
  'application/x-mame-rom': 'Arcade (MAME)',
  'application/x-arcade-rom': 'Arcade (MAME)',
  'application/x-dos-executable': 'MS-DOS',
  'application/x-msdos-program': 'MS-DOS',
};

const EmulatorJSPlayer = forwardRef<EmulatorJSPlayerRef, EmulatorJSPlayerProps>(({
  romData,
  mimeType,
  title = "Game",
  className = "",
  isHost = false,
  peerConnectionRef,
  addVideoTrackToPeerConnection
}: EmulatorJSPlayerProps, ref) => {
  // Log every render
  console.log('[EmulatorJSPlayer:Render] 🔍 Component function running', {
    title,
    mimeType,
    romDataLength: romData?.length || 0,
    timestamp: new Date().toISOString()
  });

  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emulatorInstance, setEmulatorInstance] = useState<any>(null);

  const emulatorContainerRef = useRef<HTMLDivElement>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const isInitializedRef = useRef(false);
  const renderCountRef = useRef(0);
  const containerReadyRef = useRef(false);

  // Generate unique container ID for this emulator instance
  const containerIdRef = useRef(`emulator-container-${Math.random().toString(36).substr(2, 9)}`);
  const containerId = containerIdRef.current;

  // Get the appropriate core for this MIME type
  const coreType = MIME_TO_CORE[mimeType];
  const systemName = MIME_TO_SYSTEM_NAME[mimeType] || 'Unknown System';

  const initializeEmulator = async () => {
    try {
      console.log('[EmulatorJSPlayer] 🎮 Initializing EmulatorJS for:', {
        mimeType,
        coreType,
        systemName,
        romDataLength: romData?.length || 0
      });

      // Check if we have a supported core
      if (!coreType) {
        throw new Error(`Unsupported ROM type: ${mimeType}. Please use a supported game format.`);
      }

      // Validate ROM data
      if (!romData || typeof romData !== 'string') {
        throw new Error('No ROM data provided');
      }

      // Convert base64 to binary data and create blob URL
      let gameUrl: string;
      try {
        // Remove data URL prefix if present
        const base64Data = romData.includes(',') ? romData.split(',')[1] : romData;
        const binaryString = atob(base64Data);
        const binaryData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          binaryData[i] = binaryString.charCodeAt(i);
        }

        // Create blob and URL
        const blob = new Blob([binaryData], { type: 'application/octet-stream' });
        gameUrl = URL.createObjectURL(blob);

        console.log('[EmulatorJSPlayer] ✅ ROM data converted and blob URL created:', {
          size: binaryData.length,
          url: gameUrl
        });
      } catch (decodeError) {
        throw new Error(`Failed to decode ROM data: ${decodeError instanceof Error ? decodeError.message : 'Invalid data'}`);
      }

      // Get container - it should be available immediately since we always render it
      const container = emulatorContainerRef.current;
      if (!container) {
        throw new Error('Emulator container not found');
      }

      console.log('[EmulatorJSPlayer:Container] ✅ Container ready', {
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
        className: container.className,
        timestamp: new Date().toISOString()
      });

      // Clean up any existing EmulatorJS globals
      const globalAny = globalThis as any;
      if (globalAny.EJS_emulator) {
        console.log('[EmulatorJSPlayer] 🧹 Cleaning up existing emulator instance');
        try {
          globalAny.EJS_emulator.destroy?.();
        } catch (e) {
          console.warn('[EmulatorJSPlayer] Warning during cleanup:', e);
        }
      }

      // Set up EmulatorJS global variables
      // CRITICAL: EJS_player must be a CSS selector string, not a DOM element
      globalAny.EJS_player = `#${containerId}`;
      globalAny.EJS_gameUrl = gameUrl;
      globalAny.EJS_core = coreType;
      globalAny.EJS_pathtodata = '/emulatorjs/data/';  // Fixed path to include /data/
      globalAny.EJS_startOnLoaded = true;
      globalAny.EJS_DEBUG_XX = false; // Disable debug mode for cleaner console

      // Use CDN for cores since local cores may not be available
      globalAny.EJS_pathtocore = 'https://cdn.emulatorjs.org/stable/data/cores/';

      // Optional EmulatorJS settings
      globalAny.EJS_gameID = title.replace(/[^a-zA-Z0-9]/g, '_');
      globalAny.EJS_gameName = title;
      globalAny.EJS_color = '#74b9ff';
      globalAny.EJS_VirtualGamepadSettings = {
        enable: true,
        opacity: 0.7
      };

      // BIOS settings - use CDN for BIOS files too
      globalAny.EJS_pathtobios = 'https://cdn.emulatorjs.org/stable/data/bios/';

      console.log('[EmulatorJSPlayer] ⚙️ EmulatorJS globals configured:', {
        core: coreType,
        gameUrl,
        pathtodata: globalAny.EJS_pathtodata,
        gameID: globalAny.EJS_gameID,
        player: globalAny.EJS_player,
        containerId
      });

      // Load EmulatorJS loader script
      const loadEmulatorJS = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          // Check if script is already loaded
          const existingScript = document.querySelector('script[src="/emulatorjs/data/loader.js"]');
          if (existingScript) {
            console.log('[EmulatorJSPlayer] ♻️ EmulatorJS script already loaded, reinitializing...');

            // Try to reinitialize with existing script
            if (globalAny.EJS_emulator) {
              resolve();
              return;
            }
          }

          console.log('[EmulatorJSPlayer] 📥 Loading EmulatorJS loader script...');

          const script = document.createElement('script');
          script.src = '/emulatorjs/data/loader.js';
          script.async = true;

          script.onload = () => {
            console.log('[EmulatorJSPlayer] ✅ EmulatorJS loader script loaded successfully');
            resolve();
          };

          script.onerror = (error) => {
            console.error('[EmulatorJSPlayer] ❌ Failed to load EmulatorJS loader script:', error);
            reject(new Error('Failed to load EmulatorJS loader script. Make sure the files are available at /emulatorjs/data/'));
          };

          document.head.appendChild(script);
        });
      };

      await loadEmulatorJS();

      // Wait for emulator to initialize
      const waitForEmulator = (): Promise<any> => {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 100; // 10 seconds timeout

          const checkEmulator = () => {
            attempts++;

            if (globalAny.EJS_emulator) {
              console.log('[EmulatorJSPlayer] ✅ EmulatorJS instance found:', globalAny.EJS_emulator);
              resolve(globalAny.EJS_emulator);
              return;
            }

            if (attempts >= maxAttempts) {
              reject(new Error('Timeout waiting for EmulatorJS to initialize'));
              return;
            }

            setTimeout(checkEmulator, 100);
          };

          checkEmulator();
        });
      };

      const emulator = await waitForEmulator();

      // Store the emulator instance for controls
      setEmulatorInstance({
        pause: () => {
          console.log('[EmulatorJSPlayer] ⏸️ Pausing emulator');
          emulator.pause?.();
        },
        resume: () => {
          console.log('[EmulatorJSPlayer] ▶️ Resuming emulator');
          emulator.resume?.();
        },
        restart: () => {
          console.log('[EmulatorJSPlayer] 🔄 Restarting emulator');
          emulator.restart?.();
        },
        setVolume: (vol: number) => {
          console.log('[EmulatorJSPlayer] 🔊 Setting volume to:', vol);
          emulator.setVolume?.(vol);
        },
        destroy: () => {
          console.log('[EmulatorJSPlayer] 🧹 Destroying emulator');
          try {
            emulator.destroy?.();
            URL.revokeObjectURL(gameUrl); // Clean up blob URL
            // Clean up globals
            delete globalAny.EJS_player;
            delete globalAny.EJS_gameUrl;
            delete globalAny.EJS_core;
            delete globalAny.EJS_emulator;
          } catch (e) {
            console.warn('[EmulatorJSPlayer] Warning during destroy:', e);
          }
        },
        _gameUrl: gameUrl, // Store for cleanup
        _emulator: emulator // Store reference
      });

      // Try to find the canvas element for streaming - EmulatorJS creates it dynamically
      const findCanvas = () => {
        const canvas = container.querySelector('canvas') as HTMLCanvasElement;
        if (canvas) {
          console.log('[EmulatorJSPlayer] 🎥 Canvas element found for streaming:', {
            width: canvas.width,
            height: canvas.height,
            className: canvas.className
          });
          setCanvasElement(canvas);

          // Hide the loading indicator once canvas is found
          const loadingIndicator = container.querySelector('.emulatorjs-loading-indicator') as HTMLElement;
          if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
          }

          return true;
        }
        return false;
      };

      // Try to find canvas immediately and then poll
      if (!findCanvas()) {
        const pollInterval = setInterval(() => {
          if (findCanvas()) {
            clearInterval(pollInterval);
          }
        }, 500);

        // Stop polling after 30 seconds
        setTimeout(() => {
          clearInterval(pollInterval);
          console.warn('[EmulatorJSPlayer] ⚠️ Canvas element not found after 30 seconds');
        }, 30000);
      }

      setIsReady(true);
      setError(null);
      isInitializedRef.current = true;

      console.log('[EmulatorJSPlayer] ✅ EmulatorJS initialized successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize emulator';
      console.error('[EmulatorJSPlayer] ❌ Initialization error:', errorMessage);
      setError(errorMessage);
      setIsReady(false);
    }
  };



  // Detect StrictMode and track render cycles
  useEffect(() => {
    // Check if we're in StrictMode by looking for React's __REACT_DEVTOOLS_GLOBAL_HOOK__
    const isStrictMode = typeof window !== 'undefined' &&
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size > 0;

    console.log('[EmulatorJSPlayer:StrictMode] 🔍 Environment check', {
      isStrictMode,
      renderCount: renderCountRef.current + 1,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Track container element appearance with useLayoutEffect
  useLayoutEffect(() => {
    renderCountRef.current++;
    console.log('[EmulatorJSPlayer:LayoutEffect] 📐 Layout effect running', {
      renderCount: renderCountRef.current,
      containerRef: emulatorContainerRef.current ? {
        exists: true,
        offsetWidth: emulatorContainerRef.current.offsetWidth,
        offsetHeight: emulatorContainerRef.current.offsetHeight,
        className: emulatorContainerRef.current.className
      } : {
        exists: false,
        value: emulatorContainerRef.current
      },
      timestamp: new Date().toISOString()
    });
  }, [emulatorContainerRef.current]);

  // Initialize when container is ready and data is available
  useEffect(() => {
    if (!containerReadyRef.current && emulatorContainerRef.current && romData && mimeType) {
      console.log('[EmulatorJSPlayer:ContainerMount] ✅ Container mounted and ready', {
        hasRomData: !!romData,
        hasMimeType: !!mimeType,
        timestamp: new Date().toISOString()
      });

      // Use a small timeout to ensure the DOM is fully settled
      const timer = setTimeout(() => {
        containerReadyRef.current = true;
        initializeEmulator();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [emulatorContainerRef.current, romData, mimeType]);

  // Track state changes for debugging
  useEffect(() => {
    console.log('[EmulatorJSPlayer:State] 📊 State changed', {
      isReady,
      isPaused,
      isMuted,
      isFullscreen,
      hasError: !!error,
      hasEmulatorInstance: !!emulatorInstance,
      timestamp: new Date().toISOString()
    });
  }, [isReady, isPaused, isMuted, isFullscreen, error, emulatorInstance]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getCanvasStream: () => {
      console.log('[EmulatorJSPlayer:Stream] 📹 getCanvasStream called via ref', {
        hasCanvasElement: !!canvasElement,
        timestamp: new Date().toISOString()
      });
      if (canvasElement) {
        try {
          const stream = canvasElement.captureStream(60); // 60 FPS
          console.log('[EmulatorJSPlayer:Stream] ✅ Canvas stream captured successfully');
          return stream;
        } catch (error) {
          console.error('[EmulatorJSPlayer:Stream] ❌ Failed to capture canvas stream:', error);
          return null;
        }
      } else {
        console.warn('[EmulatorJSPlayer:Stream] ❌ Canvas element not available for stream capture');
        return null;
      }
    }
  }));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[EmulatorJSPlayer:Cleanup] 🧹 Cleanup function called', {
        hasEmulatorInstance: !!emulatorInstance,
        wasInitialized: isInitializedRef.current,
        timestamp: new Date().toISOString()
      });

      if (emulatorInstance) {
        try {
          console.log('[EmulatorJSPlayer:Cleanup] 🔧 Destroying emulator instance...');
          emulatorInstance.destroy?.();
          console.log('[EmulatorJSPlayer:Cleanup] ✅ Emulator instance destroyed successfully');
        } catch (err) {
          console.warn('[EmulatorJSPlayer:Cleanup] ⚠️ Warning during cleanup:', err);
        }
      } else {
        console.log('[EmulatorJSPlayer:Cleanup] ℹ️ No emulator instance to destroy');
      }

      // Clean up any remaining globals
      const globalAny = globalThis as any;
      try {
        delete globalAny.EJS_player;
        delete globalAny.EJS_gameUrl;
        delete globalAny.EJS_core;
        delete globalAny.EJS_emulator;
        console.log('[EmulatorJSPlayer:Cleanup] 🔄 Global variables cleaned up');
      } catch (e) {
        console.warn('[EmulatorJSPlayer:Cleanup] Warning cleaning globals:', e);
      }

      isInitializedRef.current = false;
      containerReadyRef.current = false;
      console.log('[EmulatorJSPlayer:Cleanup] 🔄 Initialization flags reset', {
        timestamp: new Date().toISOString()
      });
    };
  }, [emulatorInstance]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Canvas streaming for multiplayer
  useEffect(() => {
    if (!isHost || !addVideoTrackToPeerConnection || !canvasElement) return;

    let isTrackAdded = false;

    const setupCanvasStreaming = () => {
      if (isTrackAdded || !canvasElement) return;

      try {
        console.log('[EmulatorJSPlayer] 🎥 Setting up canvas streaming...');
        const canvasStream = canvasElement.captureStream(60);

        const videoTracks = canvasStream.getVideoTracks();
        if (videoTracks.length === 0) {
          console.error('[EmulatorJSPlayer] ❌ No video tracks found in canvas stream');
          return;
        }

        const videoTrack = videoTracks[0];
        addVideoTrackToPeerConnection(videoTrack, canvasStream);
        isTrackAdded = true;

        console.log('[EmulatorJSPlayer] ✅ Canvas streaming setup completed');
      } catch (error) {
        console.error('[EmulatorJSPlayer] ❌ Error setting up canvas streaming:', error);
      }
    };

    // Try to setup immediately, then retry with polling
    setupCanvasStreaming();

    const pollInterval = setInterval(() => {
      if (!isTrackAdded && canvasElement) {
        setupCanvasStreaming();
      } else if (isTrackAdded) {
        clearInterval(pollInterval);
      }
    }, 100);

    return () => clearInterval(pollInterval);
  }, [isHost, addVideoTrackToPeerConnection, canvasElement]);

  const toggleFullscreen = () => {
    if (!emulatorContainerRef.current) return;

    if (!document.fullscreenElement) {
      // Target the parent card for fullscreen to include proper styling
      const card = emulatorContainerRef.current.closest('.bg-black');
      if (card) {
        card.requestFullscreen?.();
      } else {
        emulatorContainerRef.current.requestFullscreen?.();
      }
    } else {
      document.exitFullscreen?.();
    }
  };

  const handlePlayPause = () => {
    if (emulatorInstance) {
      if (isPaused) {
        emulatorInstance.resume?.();
      } else {
        emulatorInstance.pause?.();
      }
      setIsPaused(!isPaused);
    }
  };

  const handleReset = () => {
    if (emulatorInstance) {
      emulatorInstance.restart?.();
      setIsPaused(false);
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (emulatorInstance) {
      emulatorInstance.setVolume?.(newMutedState ? 0 : 1);
    }

    console.log(`[EmulatorJSPlayer] Audio ${newMutedState ? 'muted' : 'unmuted'}`);
  };

  return (
    <div
      className={`flex flex-col items-center space-y-4 ${className} ${isFullscreen ? 'fullscreen-mode' : ''}`}
    >
      {/* Game Title - Hidden in fullscreen */}
      {!isFullscreen && (
        <Card className="w-full max-w-4xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-center">
              {title}
              <div className="text-sm font-normal text-muted-foreground mt-1">
                {systemName}
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Game Display - Always render the container */}
      <Card className={`w-full max-w-4xl bg-black border-2 ${isFullscreen ? 'fullscreen-card' : ''}`}>
        <CardContent className={`p-4 ${isFullscreen ? 'fullscreen-content' : ''}`}>
          {/* Log when container div is being rendered */}
          {(() => {
            console.log('[EmulatorJSPlayer:JSX] 🎨 Rendering container div with ref', {
              isFullscreen,
              timestamp: new Date().toISOString()
            });
            return null;
          })()}
          <div
            id={containerId}
            ref={emulatorContainerRef}
            className={`relative bg-black rounded-lg overflow-hidden flex items-center justify-center ${isFullscreen ? 'fullscreen-canvas' : ''}`}
            style={{ minHeight: isFullscreen ? '100vh' : '600px' }}
          >
            {/* Show loading state inside the container if not ready */}
            {!isReady && !error && (
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading {title}...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  System: {systemName}
                </p>
              </div>
            )}

            {/* Show error state inside the container if error */}
            {error && (
              <div className="text-center text-white p-8">
                <div className="text-destructive text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold text-destructive mb-2">Error Loading Game</h3>
                <p className="text-muted-foreground mb-2">{error}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  System: {systemName} | MIME: {mimeType}
                </p>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Try Again
                </Button>
              </div>
            )}

            {/* EmulatorJS will inject its content here */}
            {isReady && !error && (
              <div className="emulatorjs-loading-indicator" style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#fff',
                textAlign: 'center',
                fontSize: '14px',
                zIndex: 1000,
                pointerEvents: 'none'
              }}>
                <div style={{ marginBottom: '10px' }}>🎮</div>
                <div>Loading {systemName}...</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                  Core: {coreType}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controls - Hidden in fullscreen and when not ready */}
      {!isFullscreen && isReady && (
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
                <div className="text-xs text-muted-foreground">
                  <div>Platform: {systemName}</div>
                  <div>Core: {coreType}</div>
                  <div>MIME Type: {mimeType}</div>
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