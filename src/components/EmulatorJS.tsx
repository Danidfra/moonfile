/**
 * EmulatorJS Component
 *
 * React component that loads EmulatorJS via CDN and supports multiple console systems
 * (NES, SNES, GBA, etc.) based on the platform tag from Nostr events.
 */

import React, { useState, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

// Extend Window interface to include EmulatorJS
declare global {
  interface Window {
    EJS_emulator?: unknown;
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

  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  }

  interface Document {
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
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
    console.log('[EmulatorJS] 🚀 Starting script loading process');
    console.time('[EmulatorJS] Script Loading Time');

    // Set the path to data before loading the script (always set this)
    console.log('[EmulatorJS] 📂 Setting EJS_pathtodata before script load');
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
    console.log('[EmulatorJS] ✅ EJS_pathtodata set to:', window.EJS_pathtodata);

    // Check if already loaded
    if (window.EJS_emulator) {
      console.log('[EmulatorJS] ♻️ Script already loaded, resolving immediately');
      console.log('[EmulatorJS] 📊 Current window.EJS_emulator:', window.EJS_emulator);
      console.timeEnd('[EmulatorJS] Script Loading Time');
      return resolve();
    }

    console.log('[EmulatorJS] 🌐 Loading script from CDN...');
    console.log('[EmulatorJS] 📋 Script details:', {
      src: 'https://cdn.emulatorjs.org/stable/data/loader.js',
      async: true,
      timestamp: new Date().toISOString()
    });

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    script.async = true;

    script.onload = () => {
      console.timeEnd('[EmulatorJS] Script Loading Time');
      console.log('[EmulatorJS] ✅ Script loaded successfully');
      console.log('[EmulatorJS] 📊 Post-load window properties:', {
        EJS_emulator: window.EJS_emulator,
        EJS_pathtodata: window.EJS_pathtodata,
        EJS_start: typeof (window as unknown as { EJS_start?: () => void }).EJS_start,
        timestamp: new Date().toISOString()
      });
      resolve();
    };

    script.onerror = (error) => {
      console.timeEnd('[EmulatorJS] Script Loading Time');
      console.error('[EmulatorJS] ❌ Failed to load script');
      console.error('[EmulatorJS] 🔍 Script error details:', error);
      reject(new Error('Failed to load EmulatorJS'));
    };

    console.log('[EmulatorJS] 📎 Appending script to document.body');
    document.body.appendChild(script);
    console.log('[EmulatorJS] ✅ Script element appended to DOM');
  });
}

/**
 * Map platform tag to EmulatorJS system
 */
function getEmulatorSystemFromPlatform(platform: string): string {
  console.log('[EmulatorJS] 🎮 Mapping platform to emulator system');
  console.log('[EmulatorJS] 📥 Input platform:', platform);

  let system: string;

  switch (platform) {
    case 'nes-rom': system = 'nes'; break;
    case 'snes-rom': system = 'snes'; break;
    case 'gba-rom': system = 'gba'; break;
    case 'gb-rom': system = 'gb'; break;
    case 'gbc-rom': system = 'gbc'; break;
    case 'n64-rom': system = 'n64'; break;
    case 'nds-rom': system = 'nds'; break;
    case 'genesis-rom': system = 'segaMD'; break;
    case 'sega-cd-rom': system = 'segaCD'; break;
    case 'sega-32x-rom': system = 'sega32x'; break;
    case 'sms-rom': system = 'segaMS'; break;
    case 'gg-rom': system = 'segaGG'; break;
    case 'psx-rom': system = 'psx'; break;
    case 'atari2600-rom': system = 'atari2600'; break;
    case 'atari7800-rom': system = 'atari7800'; break;
    case 'lynx-rom': system = 'lynx'; break;
    case 'jaguar-rom': system = 'jaguar'; break;
    case 'vb-rom': system = 'vb'; break;
    case 'ws-rom': system = 'ws'; break;
    case 'wsc-rom': system = 'wsc'; break;
    case 'ngp-rom': system = 'ngp'; break;
    case 'ngpc-rom': system = 'ngpc'; break;
    case 'pce-rom': system = 'pce'; break;
    case 'arcade-rom': system = 'arcade'; break;
    default:
      console.warn(`[EmulatorJS] ⚠️ Unknown platform: ${platform}, defaulting to NES`);
      system = 'nes';
  }

  console.log('[EmulatorJS] 📤 Mapped to system:', system);
  console.log('[EmulatorJS] ✅ Platform mapping complete');
  return system;
}

/**
 * Create a blob URL from ROM data
 */
function createRomBlobUrl(romData: Uint8Array): string {
  console.log('[EmulatorJS] 💾 Creating ROM blob URL');
  console.log('[EmulatorJS] 📊 ROM data details:', {
    byteLength: romData.byteLength,
    constructor: romData.constructor.name,
    isTypedArray: romData instanceof Uint8Array,
    timestamp: new Date().toISOString()
  });

  // Create a new Uint8Array with proper ArrayBuffer to ensure compatibility
  const buffer = new Uint8Array(romData);
  console.log('[EmulatorJS] 🔄 Created buffer copy:', {
    byteLength: buffer.byteLength,
    matches: buffer.byteLength === romData.byteLength
  });

  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  console.log('[EmulatorJS] 📦 Created blob:', {
    size: blob.size,
    type: blob.type
  });

  const url = URL.createObjectURL(blob);
  console.log('[EmulatorJS] 🔗 Generated blob URL:', url);
  console.log('[EmulatorJS] ✅ ROM blob URL creation complete');

  return url;
}



const EmulatorJS = forwardRef<EmulatorJSRef, EmulatorJSProps>(({
  romData,
  platform,
  title = "Game",
  className = "",
  isHost = false,
  peerConnectionRef: _peerConnectionRef,
  addVideoTrackToPeerConnection
}: EmulatorJSProps, ref) => {
  console.log('[EmulatorJS] 🎯 Component render started');
  console.log('[EmulatorJS] 📋 Props received:', {
    platform,
    title,
    className,
    isHost,
    romDataSize: romData?.byteLength,
    hasAddVideoTrackFn: !!addVideoTrackToPeerConnection,
    timestamp: new Date().toISOString()
  });

  const [isLoading, _setIsLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);
  const [isReady, _setIsReady] = useState(false);
  const [isPaused, _setIsPaused] = useState(false);
  const [isMuted, _setIsMuted] = useState(false);
  const [isFullscreen, _setIsFullscreen] = useState(false);

  // Create logging wrappers for state setters using useCallback
  const setIsLoading = useCallback((value: boolean) => {
    console.log('[EmulatorJS] 🔄 State Change - isLoading:', { from: isLoading, to: value, timestamp: new Date().toISOString() });
    _setIsLoading(value);
  }, [isLoading]);

  const setError = useCallback((value: string | null) => {
    console.log('[EmulatorJS] ❌ State Change - error:', { from: error, to: value, timestamp: new Date().toISOString() });
    _setError(value);
  }, [error]);

  const setIsReady = useCallback((value: boolean) => {
    console.log('[EmulatorJS] ✅ State Change - isReady:', { from: isReady, to: value, timestamp: new Date().toISOString() });
    _setIsReady(value);
  }, [isReady]);

  const setIsPaused = useCallback((value: boolean) => {
    console.log('[EmulatorJS] ⏸️ State Change - isPaused:', { from: isPaused, to: value, timestamp: new Date().toISOString() });
    _setIsPaused(value);
  }, [isPaused]);

  const setIsMuted = useCallback((value: boolean) => {
    console.log('[EmulatorJS] 🔇 State Change - isMuted:', { from: isMuted, to: value, timestamp: new Date().toISOString() });
    _setIsMuted(value);
  }, [isMuted]);

  const setIsFullscreen = useCallback((value: boolean) => {
    console.log('[EmulatorJS] 🖥️ State Change - isFullscreen:', { from: isFullscreen, to: value, timestamp: new Date().toISOString() });
    _setIsFullscreen(value);
  }, [isFullscreen]);

  console.log('[EmulatorJS] 📊 Initial state values:', {
    isLoading,
    error,
    isReady,
    isPaused,
    isMuted,
    isFullscreen
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const romBlobUrlRef = useRef<string | null>(null);
  const emulatorInstanceRef = useRef<unknown>(null);

  console.log('[EmulatorJS] 📎 Refs created:', {
    containerRef: !!containerRef,
    gameContainerRef: !!gameContainerRef,
    romBlobUrlRef: !!romBlobUrlRef,
    emulatorInstanceRef: !!emulatorInstanceRef,
    gameContainerRefCurrent: !!gameContainerRef.current
  });

  // Component mount/unmount logging
  useEffect(() => {
    console.log('[EmulatorJS] 🎯 Component mounted');
    const gameContainer = gameContainerRef.current;
    const container = containerRef.current;

    console.log('[EmulatorJS] 📊 Mount state:', {
      timestamp: new Date().toISOString(),
      gameContainerRef: !!gameContainer,
      containerRef: !!container
    });

    return () => {
      console.log('[EmulatorJS] 👋 Component unmounting');
      console.log('[EmulatorJS] 📊 Unmount state:', {
        timestamp: new Date().toISOString(),
        gameContainerRef: !!gameContainer,
        containerRef: !!container
      });
    };
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getCanvasStream: () => {
      console.log('[EmulatorJS] 📹 getCanvasStream called via ref');
      console.log('[EmulatorJS] 🔍 Checking game container availability');

      if (!gameContainerRef.current) {
        console.warn('[EmulatorJS] ⚠️ Game container not available for stream capture');
        console.log('[EmulatorJS] 📊 gameContainerRef.current is:', gameContainerRef.current);
        return null;
      }

      console.log('[EmulatorJS] ✅ Game container available, searching for canvas');
      console.log('[EmulatorJS] 📊 Container details:', {
        tagName: gameContainerRef.current.tagName,
        children: gameContainerRef.current.children.length,
        innerHTML: gameContainerRef.current.innerHTML.substring(0, 200) + '...'
      });

      // Try to find the canvas element created by EmulatorJS
      const canvas = gameContainerRef.current.querySelector('canvas');
      console.log('[EmulatorJS] 🎨 Canvas search result:', canvas);

      if (!canvas) {
        console.warn('[EmulatorJS] ⚠️ Canvas not found for stream capture');
        console.log('[EmulatorJS] 🔍 All canvases in document:', document.querySelectorAll('canvas'));
        console.log('[EmulatorJS] 🔍 Container children:', Array.from(gameContainerRef.current.children));
        return null;
      }

      console.log('[EmulatorJS] ✅ Canvas found for stream capture');
      console.log('[EmulatorJS] 📊 Canvas details:', {
        width: canvas.width,
        height: canvas.height,
        id: canvas.id,
        className: canvas.className,
        tagName: canvas.tagName
      });

      try {
        console.log('[EmulatorJS] 🎬 Attempting to capture stream from canvas');
        // Capture stream from the canvas
        const stream = canvas.captureStream(60); // 60 FPS
        console.log('[EmulatorJS] ✅ Canvas stream captured successfully');
        console.log('[EmulatorJS] 📊 Stream details:', {
          id: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        return stream;
      } catch (error) {
        console.error('[EmulatorJS] ❌ Failed to capture canvas stream:', error);
        console.log('[EmulatorJS] 🔍 Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack'
        });
        return null;
      }
    }
  }));

  // Initialize EmulatorJS with robust timing and canvas detection
  useLayoutEffect(() => {
    console.log('[EmulatorJS] 🚀 useLayoutEffect triggered - Starting initialization');
    console.time('[EmulatorJS] Total Initialization Time');
    console.log('[EmulatorJS] 📊 Effect dependencies:', { platform, isMuted });

    let isInitialized = false;
    let isMounted = true;
    let canvasPollingId: number | null = null;
    let initTimeoutId: NodeJS.Timeout | null = null;
    let domMutationIntervalId: NodeJS.Timeout | null = null;

    // Capture ref value at the beginning of the effect for cleanup
    const gameContainer = gameContainerRef.current;
    console.log('[EmulatorJS] 📎 Captured gameContainer ref for cleanup:', !!gameContainer);

    // Start DOM mutation logging
    let mutationLogCount = 0;
    const startDOMMutationLogging = () => {
      console.log('[EmulatorJS] 🔍 Starting DOM mutation logging for 10 seconds');
      domMutationIntervalId = setInterval(() => {
        mutationLogCount++;
        const allCanvases = document.querySelectorAll('canvas');
        const containerCanvases = gameContainerRef.current?.querySelectorAll('canvas') || [];

        console.log(`[EmulatorJS] 🔍 DOM Check #${mutationLogCount}:`, {
          timestamp: new Date().toISOString(),
          totalCanvases: allCanvases.length,
          containerCanvases: containerCanvases.length,
          canvasDetails: Array.from(allCanvases).map(canvas => ({
            id: canvas.id,
            className: canvas.className,
            width: canvas.width,
            height: canvas.height,
            parentElement: canvas.parentElement?.tagName
          }))
        });

        if (mutationLogCount >= 10) {
          console.log('[EmulatorJS] ⏰ DOM mutation logging complete (10 seconds elapsed)');
          if (domMutationIntervalId) {
            clearInterval(domMutationIntervalId);
            domMutationIntervalId = null;
          }
        }
      }, 1000);
    };

    const initializeEmulator = async () => {
      console.log('[EmulatorJS] 🎮 initializeEmulator function called');
      console.time('[EmulatorJS] Emulator Initialization');

      try {
        if (isInitialized || !isMounted) {
          console.log('[EmulatorJS] 🛑 Initialization skipped:', { isInitialized, isMounted });
          return; // Prevent multiple initializations
        }

        console.log('[EmulatorJS] 🚀 Starting initialization for platform:', platform);
        console.log('[EmulatorJS] 📊 Pre-initialization state:', {
          isInitialized,
          isMounted,
          gameContainerExists: !!gameContainerRef.current
        });

        console.log('[EmulatorJS] 🔄 Setting loading state...');
        setIsLoading(true);
        setError(null);
        setIsReady(false);
        console.log('[EmulatorJS] ✅ State updates dispatched');

        console.log('[EmulatorJS] 💾 Creating ROM blob URL...');
        const romUrl = createRomBlobUrl(romData);
        romBlobUrlRef.current = romUrl;
        console.log('[EmulatorJS] ✅ ROM blob URL stored in ref:', romUrl);

        console.log('[EmulatorJS] 🎯 Getting emulator system...');
        const system = getEmulatorSystemFromPlatform(platform);
        console.log('[EmulatorJS] ✅ System determined:', system);

        // Ensure container is still available and clear it
        console.log('[EmulatorJS] 🔍 Checking container availability...');
        if (!gameContainerRef.current || !isMounted) {
          console.error('[EmulatorJS] ❌ Container check failed:', {
            gameContainer: !!gameContainerRef.current,
            isMounted
          });
          throw new Error('Container no longer available');
        }

        const container = gameContainerRef.current;
        console.log('[EmulatorJS] ✅ Container available, clearing content...');
        console.log('[EmulatorJS] 📊 Container before clear:', {
          children: container.children.length,
          innerHTML: container.innerHTML.substring(0, 100) + '...'
        });

        container.innerHTML = '';
        console.log('[EmulatorJS] ✅ Container cleared');

        // Set unique game ID to avoid conflicts
        const gameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        console.log('[EmulatorJS] 🆔 Setting unique game ID:', gameId);
        (window as unknown as { EJS_gameID: string }).EJS_gameID = gameId;

        console.log('[EmulatorJS] ⚙️ Setting global config for EmulatorJS...');
        console.log('[EmulatorJS] 📊 Config values being set:', {
          EJS_gameUrl: romUrl,
          EJS_core: system,
          EJS_startOnLoaded: true,
          EJS_mute: isMuted,
          EJS_volume: isMuted ? 0 : 0.5,
          EJS_gameParent: 'HTMLDivElement',
          EJS_player: 'custom'
        });

        window.EJS_gameUrl = romUrl;
        window.EJS_core = system;
        window.EJS_startOnLoaded = true;
        window.EJS_mute = isMuted;
        window.EJS_volume = isMuted ? 0 : 0.5;
        window.EJS_gameParent = container;
        window.EJS_player = 'custom';

        console.log('[EmulatorJS] ✅ Global config set, verifying...');
        console.log('[EmulatorJS] 📊 Full window EmulatorJS properties after config:', {
          EJS_emulator: window.EJS_emulator,
          EJS_player: window.EJS_player,
          EJS_gameUrl: window.EJS_gameUrl,
          EJS_core: window.EJS_core,
          EJS_pathtodata: window.EJS_pathtodata,
          EJS_startOnLoaded: window.EJS_startOnLoaded,
          EJS_volume: window.EJS_volume,
          EJS_mute: window.EJS_mute,
          EJS_gameParent: window.EJS_gameParent?.tagName || 'null',
          EJS_loadStateOnStart: window.EJS_loadStateOnStart,
          EJS_saveStateOnUnload: window.EJS_saveStateOnUnload,
          EJS_alignStartButton: window.EJS_alignStartButton,
          EJS_fullscreenOnDoubleClick: window.EJS_fullscreenOnDoubleClick,
          EJS_gameID: (window as unknown as { EJS_gameID?: string }).EJS_gameID
        });

        // ✅ Load the script only once, AFTER setting globals
        console.log('[EmulatorJS] 📜 Loading EmulatorJS script...');
        await loadEmulatorJSScript();
        console.log('[EmulatorJS] ✅ Script loading complete');

        if (!isMounted) {
          console.log('[EmulatorJS] 🛑 Component unmounted during script loading, aborting');
          return;
        }

        console.log('[EmulatorJS] 🔍 Checking for EJS_start function...');
        if (typeof (window as unknown as { EJS_start?: () => void }).EJS_start === 'function') {
          console.log('[EmulatorJS] ✅ EJS_start found, manually triggering...');
          console.time('[EmulatorJS] EJS_start Execution');
          (window as unknown as { EJS_start: () => void }).EJS_start();
          console.timeEnd('[EmulatorJS] EJS_start Execution');
          console.log('[EmulatorJS] ✅ EJS_start() executed');
        } else {
          console.warn('[EmulatorJS] ⚠️ EJS_start() not found on window');
          console.log('[EmulatorJS] 🔍 Available window properties:', Object.keys(window).filter(key => key.includes('EJS')));
        }

        isInitialized = true;
        console.log('[EmulatorJS] ✅ Initialization flag set to true');

        if (!isMounted) {
          console.log('[EmulatorJS] 🛑 Component unmounted after EJS_start, aborting');
          return;
        }

        console.log('[EmulatorJS] 🔍 Starting canvas polling...');
        startCanvasPolling();

        console.log('[EmulatorJS] 🔍 Starting DOM mutation logging...');
        startDOMMutationLogging();

        console.log('[EmulatorJS] 📊 Final gameContainerRef state:', {
          exists: !!gameContainerRef.current,
          children: gameContainerRef.current?.children.length,
          innerHTML: gameContainerRef.current?.innerHTML.substring(0, 100) + '...'
        });

        // Additional delayed checks
        setTimeout(() => {
          console.log('[EmulatorJS] 🕐 5-second delayed check:');
          console.log('[EmulatorJS] 📊 Container children:', gameContainerRef.current?.children);
          console.log('[EmulatorJS] 📊 Canvas in entire document:', document.querySelectorAll('canvas'));
          console.log('[EmulatorJS] 📊 Container canvas elements:', gameContainerRef.current?.querySelectorAll('canvas'));
        }, 5000);

        console.timeEnd('[EmulatorJS] Emulator Initialization');

      } catch (err) {
        console.timeEnd('[EmulatorJS] Emulator Initialization');
        console.error('[EmulatorJS] ❌ Initialization error occurred');
        console.error('[EmulatorJS] 🔍 Error details:', {
          name: err instanceof Error ? err.name : 'Unknown',
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : 'No stack',
          isMounted
        });

        if (isMounted) {
          console.log('[EmulatorJS] 🔄 Setting error state...');
          setError(err instanceof Error ? err.message : 'Failed to initialize emulator');
          setIsLoading(false);
          console.log('[EmulatorJS] ✅ Error state set');
        } else {
          console.log('[EmulatorJS] 🛑 Component unmounted, skipping error state update');
        }
      }
    };

    const startCanvasPolling = () => {
      console.log('[EmulatorJS] 🔍 Starting canvas polling system');
      console.time('[EmulatorJS] Canvas Detection Time');

      const startTime = performance.now();
      const maxWaitTime = 10000; // 10 seconds timeout
      let pollCount = 0;

      const pollForCanvas = () => {
        if (!isMounted || !gameContainerRef.current) {
          console.log('[EmulatorJS] 🛑 Polling stopped - component unmounted or container lost');
          console.log('[EmulatorJS] 📊 Poll stop reason:', { isMounted, hasContainer: !!gameContainerRef.current });
          return;
        }

        pollCount++;
        const container = gameContainerRef.current;
        const elapsed = performance.now() - startTime;

        console.log(`[EmulatorJS] 🔍 Canvas poll #${pollCount} (${elapsed.toFixed(0)}ms elapsed)`);

        // Look for canvas element with multiple selectors
        const selectors = [
          'canvas',
          'canvas[width]',
          'canvas[height]',
          '#canvas',
          '.emulator-canvas'
        ];

        let canvas: HTMLCanvasElement | null = null;
        let foundSelector = '';

        for (const selector of selectors) {
          canvas = container.querySelector(selector);
          if (canvas) {
            foundSelector = selector;
            break;
          }
        }

        console.log(`[EmulatorJS] 🔍 Canvas search results (poll #${pollCount}):`, {
          found: !!canvas,
          selector: foundSelector,
          containerChildren: container.children.length,
          containerHTML: container.innerHTML.substring(0, 150) + '...'
        });

        if (canvas) {
          console.timeEnd('[EmulatorJS] Canvas Detection Time');
          console.log(`[EmulatorJS] ✅ Canvas found after ${pollCount} polls!`);
          console.log('[EmulatorJS] 📊 Canvas details:', {
            tagName: canvas.tagName,
            id: canvas.id,
            className: canvas.className,
            width: canvas.width,
            height: canvas.height,
            style: canvas.style.cssText,
            parentElement: canvas.parentElement?.tagName,
            selector: foundSelector
          });

          if (isMounted) {
            console.log('[EmulatorJS] 🔄 Setting ready state...');
            setIsReady(true);
            setIsLoading(false);
            console.log('[EmulatorJS] ✅ Emulator ready - canvas detected and mounted');
          } else {
            console.log('[EmulatorJS] 🛑 Component unmounted, skipping state update');
          }
          return;
        }

        if (elapsed > maxWaitTime) {
          console.timeEnd('[EmulatorJS] Canvas Detection Time');
          console.error(`[EmulatorJS] ❌ Canvas detection timeout after ${elapsed.toFixed(0)}ms`);
          console.log('[EmulatorJS] 🔍 Final polling state:', {
            pollCount,
            elapsed,
            containerExists: !!gameContainerRef.current,
            containerChildren: gameContainerRef.current?.children.length,
            allCanvases: document.querySelectorAll('canvas').length
          });

          if (isMounted) {
            console.log('[EmulatorJS] 🔄 Setting timeout error state...');
            setIsLoading(false);
            setError('Emulator canvas did not appear within timeout period');
            console.log('[EmulatorJS] ✅ Timeout error state set');
          } else {
            console.log('[EmulatorJS] 🛑 Component unmounted, skipping timeout error state');
          }
          return;
        }

        // Continue polling with progressive intervals
        const interval = pollCount < 50 ? 16 : pollCount < 100 ? 50 : 100; // Start fast, then slow down
        console.log(`[EmulatorJS] ⏰ Scheduling next poll in ${interval}ms`);

        canvasPollingId = window.setTimeout(() => {
          canvasPollingId = null;
          pollForCanvas();
        }, interval);
      };

      // Start polling immediately
      console.log('[EmulatorJS] 🚀 Starting immediate canvas poll');
      pollForCanvas();
    };

    const waitForContainerAndInitialize = () => {
      console.log('[EmulatorJS] 🔍 Checking container readiness...');

      if (!isMounted) {
        console.log('[EmulatorJS] 🛑 Component unmounted, stopping container check');
        return;
      }

      if (gameContainerRef.current) {
        console.log('[EmulatorJS] ✅ Container is ready!');
        console.log('[EmulatorJS] 📊 Container details:', {
          tagName: gameContainerRef.current.tagName,
          id: gameContainerRef.current.id,
          className: gameContainerRef.current.className,
          children: gameContainerRef.current.children.length
        });

        // Container is ready, wait a bit for DOM to be fully painted then initialize
        console.log('[EmulatorJS] ⏰ Scheduling initialization in 50ms for DOM paint');
        initTimeoutId = setTimeout(() => {
          if (isMounted) {
            console.log('[EmulatorJS] 🚀 DOM paint delay complete, starting initialization');
            initializeEmulator();
          } else {
            console.log('[EmulatorJS] 🛑 Component unmounted during DOM paint delay');
          }
        }, 50); // Small delay to ensure DOM is painted
      } else {
        console.log('[EmulatorJS] ⏳ Container not ready, scheduling next frame check');
        // Container not ready, try again next frame
        requestAnimationFrame(waitForContainerAndInitialize);
      }
    };

    // Start the initialization process
    console.log('[EmulatorJS] 🚀 Starting container check and initialization process');
    waitForContainerAndInitialize();

    return () => {
      console.log('[EmulatorJS] 🧹 Starting component cleanup');
      console.timeEnd('[EmulatorJS] Total Initialization Time');

      // Mark as unmounted to prevent state updates
      console.log('[EmulatorJS] 🛑 Marking component as unmounted');
      isMounted = false;

      // Cancel any pending timeouts/polling
      console.log('[EmulatorJS] ⏰ Canceling pending timeouts and polling...');
      if (initTimeoutId) {
        console.log('[EmulatorJS] ❌ Clearing init timeout');
        clearTimeout(initTimeoutId);
      }
      if (canvasPollingId) {
        console.log('[EmulatorJS] ❌ Clearing canvas polling timeout');
        clearTimeout(canvasPollingId);
      }
      if (domMutationIntervalId) {
        console.log('[EmulatorJS] ❌ Clearing DOM mutation logging interval');
        clearInterval(domMutationIntervalId);
      }

      // Cleanup blob URL
      console.log('[EmulatorJS] 🗑️ Cleaning up ROM blob URL...');
      if (romBlobUrlRef.current) {
        console.log('[EmulatorJS] 🔗 Revoking blob URL:', romBlobUrlRef.current);
        URL.revokeObjectURL(romBlobUrlRef.current);
        romBlobUrlRef.current = null;
        console.log('[EmulatorJS] ✅ Blob URL revoked');
      } else {
        console.log('[EmulatorJS] ℹ️ No blob URL to revoke');
      }

      // Cleanup emulator instance
      console.log('[EmulatorJS] 🎮 Cleaning up emulator instance...');
      if (emulatorInstanceRef.current) {
        console.log('[EmulatorJS] 📊 Emulator instance exists, attempting cleanup');
        try {
          if (
            emulatorInstanceRef.current &&
            typeof (emulatorInstanceRef.current as { destroy?: () => void }).destroy === 'function'
          ) {
            console.log('[EmulatorJS] 🔧 Calling emulator destroy method');
            (emulatorInstanceRef.current as { destroy: () => void }).destroy();
            console.log('[EmulatorJS] ✅ Emulator destroy method called');
          } else {
            console.log('[EmulatorJS] ℹ️ No destroy method available on emulator instance');
          }
        } catch (error) {
          console.warn('[EmulatorJS] ⚠️ Error during emulator cleanup:', error);
          console.log('[EmulatorJS] 🔍 Cleanup error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error)
          });
        }
        emulatorInstanceRef.current = null;
        console.log('[EmulatorJS] ✅ Emulator instance ref cleared');
      } else {
        console.log('[EmulatorJS] ℹ️ No emulator instance to cleanup');
      }

      // Clear container using captured ref value
      console.log('[EmulatorJS] 🧹 Clearing game container...');
      if (gameContainer) {
        console.log('[EmulatorJS] 📊 Container before clear:', {
          children: gameContainer.children.length,
          innerHTML: gameContainer.innerHTML.substring(0, 100) + '...'
        });
        gameContainer.innerHTML = '';
        console.log('[EmulatorJS] ✅ Game container cleared');
      } else {
        console.log('[EmulatorJS] ℹ️ No game container to clear');
      }

      console.log('[EmulatorJS] ✅ Component cleanup completed');
    };
  }, [romData, platform, isMuted, setError, setIsLoading, setIsReady]);

  // Handle fullscreen change events
  useEffect(() => {
    console.log('[EmulatorJS] 🖥️ Setting up fullscreen event listeners');

    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      console.log('[EmulatorJS] 🖥️ Fullscreen change detected:', {
        isNowFullscreen,
        fullscreenElement: document.fullscreenElement?.tagName,
        timestamp: new Date().toISOString()
      });
      setIsFullscreen(isNowFullscreen);
    };

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    events.forEach(event => {
      console.log(`[EmulatorJS] 📎 Adding ${event} listener`);
      document.addEventListener(event, handleFullscreenChange);
    });

    console.log('[EmulatorJS] ✅ All fullscreen event listeners added');

    return () => {
      console.log('[EmulatorJS] 🧹 Removing fullscreen event listeners');
      events.forEach(event => {
        console.log(`[EmulatorJS] ❌ Removing ${event} listener`);
        document.removeEventListener(event, handleFullscreenChange);
      });
      console.log('[EmulatorJS] ✅ All fullscreen event listeners removed');
    };
  }, [setIsFullscreen]);

  // Canvas streaming effect for host mode
  useEffect(() => {
    console.log('[EmulatorJS] 📹 Canvas streaming effect triggered');
    console.log('[EmulatorJS] 📊 Streaming effect conditions:', {
      isHost,
      isReady,
      hasAddVideoTrackFn: !!addVideoTrackToPeerConnection,
      refExists: !!ref,
      timestamp: new Date().toISOString()
    });

    if (!isHost || !addVideoTrackToPeerConnection || !isReady) {
      console.log('[EmulatorJS] 🛑 Canvas streaming skipped');
      console.log('[EmulatorJS] 📊 Skip reasons:', {
        notHost: !isHost,
        missingFunction: !addVideoTrackToPeerConnection,
        notReady: !isReady
      });
      return;
    }

    console.log('[EmulatorJS] ✅ Starting canvas streaming setup');
    let isTrackAdded = false;
    let pollCount = 0;

    const setupCanvasStreaming = () => {
      pollCount++;
      console.log(`[EmulatorJS] 🎬 setupCanvasStreaming attempt #${pollCount}`);

      if (isTrackAdded) {
        console.log('[EmulatorJS] ♻️ Video track already added, skipping setup');
        return;
      }

      try {
        console.log('[EmulatorJS] 🔍 Getting canvas stream via ref...');
        console.log('[EmulatorJS] 📊 Ref details:', {
          refExists: !!ref,
          refHasCurrent: ref && 'current' in ref,
          currentExists: ref && 'current' in ref && !!ref.current,
          hasGetCanvasStream: ref && 'current' in ref && ref.current && typeof ref.current.getCanvasStream === 'function'
        });

        const canvasStream = ref && 'current' in ref && ref.current?.getCanvasStream();

        if (!canvasStream) {
          console.error('[EmulatorJS] ❌ Failed to get canvas stream');
          console.log('[EmulatorJS] 🔍 Canvas stream failure details:', {
            refPath: ref && 'current' in ref ? 'ref.current exists' : 'ref.current missing',
            gameContainer: !!gameContainerRef.current,
            canvasInContainer: !!gameContainerRef.current?.querySelector('canvas')
          });
          return;
        }

        console.log('[EmulatorJS] ✅ Canvas stream obtained successfully');
        console.log('[EmulatorJS] 📊 Canvas stream details:', {
          streamId: canvasStream.id,
          active: canvasStream.active,
          videoTracks: canvasStream.getVideoTracks().length,
          audioTracks: canvasStream.getAudioTracks().length,
          allTracks: canvasStream.getTracks().length
        });

        const videoTracks = canvasStream.getVideoTracks();
        if (videoTracks.length === 0) {
          console.error('[EmulatorJS] ❌ No video tracks found in canvas stream');
          console.log('[EmulatorJS] 📊 Stream track details:', {
            videoTracks: videoTracks.length,
            audioTracks: canvasStream.getAudioTracks().length,
            allTracks: canvasStream.getTracks().map(track => ({ kind: track.kind, id: track.id, label: track.label }))
          });
          return;
        }

        const videoTrack = videoTracks[0];
        console.log('[EmulatorJS] ✅ Video track found');
        console.log('[EmulatorJS] 📊 Video track details:', {
          trackId: videoTrack.id,
          kind: videoTrack.kind,
          label: videoTrack.label,
          enabled: videoTrack.enabled,
          muted: videoTrack.muted,
          readyState: videoTrack.readyState,
          settings: videoTrack.getSettings && videoTrack.getSettings()
        });

        // Add video track to peer connection
        console.log('[EmulatorJS] 🔗 Adding video track via addVideoTrackToPeerConnection...');
        addVideoTrackToPeerConnection(videoTrack, canvasStream);

        console.log('[EmulatorJS] ✅ Video track successfully added to peer connection');
        isTrackAdded = true;

        // Set up track event listeners
        videoTrack.onended = () => {
          console.log('[EmulatorJS] 📹 Video track ended');
        };
        videoTrack.onmute = () => {
          console.log('[EmulatorJS] 🔇 Video track muted');
        };
        videoTrack.onunmute = () => {
          console.log('[EmulatorJS] 🔊 Video track unmuted');
        };

        console.log('[EmulatorJS] ✅ Video track event listeners attached');

      } catch (error) {
        console.error('[EmulatorJS] ❌ Error setting up canvas streaming:', error);
        console.log('[EmulatorJS] 🔍 Streaming error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack',
          pollCount
        });
        setError(error instanceof Error ? error.message : 'Failed to setup canvas streaming');
      }
    };

    // Set up polling to check for canvas readiness
    console.log('[EmulatorJS] ⏰ Setting up canvas streaming polling (500ms interval)');
    const pollInterval = setInterval(() => {
      const hasCanvas = gameContainerRef.current?.querySelector('canvas');

      console.log(`[EmulatorJS] 🔍 Canvas streaming poll check:`, {
        pollCount: pollCount + 1,
        isTrackAdded,
        hasCanvas: !!hasCanvas,
        containerExists: !!gameContainerRef.current
      });

      if (!isTrackAdded && hasCanvas) {
        console.log('[EmulatorJS] 🔄 Retrying canvas streaming setup...');
        setupCanvasStreaming();
      } else if (isTrackAdded) {
        console.log('[EmulatorJS] ✅ Video track added, stopping polling');
        clearInterval(pollInterval);
      }
    }, 500); // Check every 500ms

    // Try immediate setup
    console.log('[EmulatorJS] 🚀 Attempting immediate canvas streaming setup');
    setupCanvasStreaming();

    return () => {
      console.log('[EmulatorJS] 🧹 Cleaning up canvas streaming effect...');
      clearInterval(pollInterval);
      console.log('[EmulatorJS] ✅ Canvas streaming effect cleanup complete');
    };
  }, [isHost, isReady, addVideoTrackToPeerConnection, ref, setError]);

  // Toggle fullscreen function
  const toggleFullscreen = () => {
    console.log('[EmulatorJS] 🖥️ Toggle fullscreen requested');
    console.log('[EmulatorJS] 📊 Fullscreen state before toggle:', {
      containerExists: !!containerRef.current,
      currentFullscreenElement: document.fullscreenElement?.tagName,
      isCurrentlyFullscreen: !!document.fullscreenElement
    });

    if (!containerRef.current) {
      console.warn('[EmulatorJS] ⚠️ Cannot toggle fullscreen - container ref not available');
      return;
    }

    if (!document.fullscreenElement) {
      console.log('[EmulatorJS] 📺 Entering fullscreen mode');
      const elem = containerRef.current;

      if (elem?.requestFullscreen) {
        console.log('[EmulatorJS] 🔧 Using requestFullscreen');
        elem.requestFullscreen();
      } else if (elem?.webkitRequestFullscreen) {
        console.log('[EmulatorJS] 🔧 Using webkitRequestFullscreen');
        elem.webkitRequestFullscreen();
      } else if (elem?.mozRequestFullScreen) {
        console.log('[EmulatorJS] 🔧 Using mozRequestFullScreen');
        elem.mozRequestFullScreen();
      } else if (elem?.msRequestFullscreen) {
        console.log('[EmulatorJS] 🔧 Using msRequestFullscreen');
        elem.msRequestFullscreen();
      } else {
        console.warn('[EmulatorJS] ⚠️ No fullscreen API available');
      }
    } else {
      console.log('[EmulatorJS] 📱 Exiting fullscreen mode');

      if (document.exitFullscreen) {
        console.log('[EmulatorJS] 🔧 Using exitFullscreen');
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        console.log('[EmulatorJS] 🔧 Using webkitExitFullscreen');
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        console.log('[EmulatorJS] 🔧 Using mozCancelFullScreen');
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        console.log('[EmulatorJS] 🔧 Using msExitFullscreen');
        document.msExitFullscreen();
      } else {
        console.warn('[EmulatorJS] ⚠️ No fullscreen exit API available');
      }
    }
  };

  const handlePlayPause = () => {
    console.log('[EmulatorJS] ⏯️ Play/Pause button clicked');
    console.log('[EmulatorJS] 📊 Current pause state:', isPaused);

    // EmulatorJS doesn't have a direct pause API, this is more for UI consistency
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    console.log(`[EmulatorJS] ✅ Play/Pause toggled to: ${newPausedState ? 'PAUSED' : 'PLAYING'} (UI only)`);
  };

  const handleReset = () => {
    console.log('[EmulatorJS] 🔄 Reset button clicked');
    console.log('[EmulatorJS] 📊 Emulator instance available:', !!emulatorInstanceRef.current);

    // Try to reset the emulator if possible
    if (emulatorInstanceRef.current && typeof (emulatorInstanceRef.current as { restart?: () => void }).restart === 'function') {
      console.log('[EmulatorJS] 🔧 Using emulator restart method');
      (emulatorInstanceRef.current as { restart: () => void }).restart();
      console.log('[EmulatorJS] ✅ Emulator restart method called');
    } else {
      console.log('[EmulatorJS] 🔄 No restart method available, reloading page');
      // Fallback: reload the component
      window.location.reload();
    }
    console.log('[EmulatorJS] ✅ Reset action completed');
  };

  const handleMuteToggle = () => {
    console.log('[EmulatorJS] 🔇 Mute toggle button clicked');
    console.log('[EmulatorJS] 📊 Current mute state:', isMuted);

    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // Try to update EmulatorJS volume
    console.log('[EmulatorJS] 🔊 Attempting to update emulator volume...');
    if (emulatorInstanceRef.current) {
      console.log('[EmulatorJS] 📊 Emulator instance exists, checking for setVolume method');
      try {
        if (typeof (emulatorInstanceRef.current as { setVolume?: (volume: number) => void }).setVolume === 'function') {
          const newVolume = newMutedState ? 0 : 0.5;
          console.log(`[EmulatorJS] 🔧 Calling setVolume(${newVolume})`);
          (emulatorInstanceRef.current as { setVolume: (volume: number) => void }).setVolume(newVolume);
          console.log('[EmulatorJS] ✅ Volume updated via emulator instance');
        } else {
          console.log('[EmulatorJS] ℹ️ No setVolume method available on emulator instance');
        }
      } catch (error) {
        console.warn('[EmulatorJS] ⚠️ Could not update volume via emulator instance:', error);
        console.log('[EmulatorJS] 🔍 Volume update error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      console.log('[EmulatorJS] ℹ️ No emulator instance available for volume control');
    }

    console.log(`[EmulatorJS] ✅ Audio ${newMutedState ? 'muted' : 'unmuted'}`);
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