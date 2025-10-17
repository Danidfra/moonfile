import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { useFullscreen } from '@/hooks/useFullscreen';

interface EmulatorIFrameProps {
  romData: Uint8Array;
  platform: string;
  title?: string;
  className?: string;
  isHost?: boolean;
  addVideoTrackToPeerConnection?: (videoTrack: MediaStreamTrack, stream: MediaStream) => void;
}

export interface EmulatorJSRef {
  getCanvasStream: () => MediaStream | null;
  postRemoteInput?: (input: { key: string; pressed: boolean }) => void;
}

/**
 * Map platform tag to EmulatorJS core with tolerant fallback
 */
function getEmulatorCore(platform: string): string {
  const mapping: Record<string, string> = {
    'nes-rom': 'nes',
    'snes-rom': 'snes',
    'gba-rom': 'gba',
    'gb-rom': 'gb',
    'gbc-rom': 'gbc',
    'n64-rom': 'n64',
    'nds-rom': 'nds',
    'genesis-rom': 'segaMD',
    'sega-cd-rom': 'segaCD',
    'sega-32x-rom': 'sega32x',
    'sms-rom': 'segaMS',
    'gg-rom': 'segaGG',
    'psx-rom': 'psx',
    'atari2600-rom': 'atari2600',
    'atari7800-rom': 'atari7800',
    'lynx-rom': 'lynx',
    'jaguar-rom': 'jaguar',
    'vb-rom': 'vb',
    'ws-rom': 'ws',
    'wsc-rom': 'wsc',
    'ngp-rom': 'ngp',
    'ngpc-rom': 'ngpc',
    'pce-rom': 'pce',
    'arcade-rom': 'arcade'
  };

  const knownCores = new Set(Object.values(mapping));
  if (knownCores.has(platform)) return platform;
  return mapping[platform] ?? (knownCores.has(platform) ? platform : 'nes');
}

/**
 * Map platform to aspect ratio
 */
function getEmulatorAspect(platform: string): string {
  const aspectByCore: Record<string, string> = {
    // 4:3 aspect ratio (most consoles)
    nes: '4 / 3',
    snes: '4 / 3',
    n64: '4 / 3',
    segaMD: '4 / 3', // Genesis
    segaMS: '4 / 3', // Master System
    psx: '4 / 3', // PlayStation

    // 10:9 aspect ratio (handhelds)
    gb: '10 / 9', // Game Boy
    gbc: '10 / 9', // Game Boy Color
    segaGG: '10 / 9', // Game Gear

    // 3:2 aspect ratio (GBA)
    gba: '3 / 2',
  };

  const core = getEmulatorCore(platform);
  return aspectByCore[core] ?? '4 / 3'; // Fallback to 4:3
}

const EmulatorIFrame = forwardRef<EmulatorJSRef, EmulatorIFrameProps>(({
  romData,
  platform,
  title = "Game",
  className = "",
  isHost = false,
  addVideoTrackToPeerConnection
}, ref) => {
  console.log('[EmulatorIFrame] Component render started');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [controlLock, setControlLock] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [romUrl, setRomUrl] = useState('');

  // Map NES button names to DOM key names
  const toDomKey = useCallback((k: string): string => {
    switch (k) {
      case 'Up': return 'ArrowUp';
      case 'Down': return 'ArrowDown';
      case 'Left': return 'ArrowLeft';
      case 'Right': return 'ArrowRight';
      case 'Start': return 'Enter';
      case 'Select': return 'Shift';
      case 'A': return 'z';
      case 'B': return 'x';
      default: return k;
    }
  }, []);

  // Listen for remote input events and dispatch to iframe
  useEffect(() => {
    const onRemoteInput = (e: CustomEvent<{ key: string; pressed: boolean }>) => {
      const { key, pressed } = e.detail;
      const domKey = toDomKey(key);
      const win = iframeRef.current?.contentWindow;
      const doc = win?.document;
      if (!doc) return;

      const type = pressed ? 'keydown' : 'keyup';
      const ev = new KeyboardEvent(type, {
        key: domKey,
        code: domKey.startsWith('Arrow') ? domKey : undefined,
        bubbles: true,
        cancelable: true,
        repeat: false
      });

      doc.dispatchEvent(ev);
    };

    window.addEventListener('remoteInput', onRemoteInput as EventListener);
    return () => window.removeEventListener('remoteInput', onRemoteInput as EventListener);
  }, [toDomKey]);

  // Use the fullscreen hook
  const {
    isFullscreenUI,
    setIsFullscreenUI,
    supportsNativeFS,
    isNativeFS,
    enterNativeFS,
    exitNativeFS,
    onFSChange,
    lockLandscapeIfSupported,
    unlockOrientationSafe
  } = useFullscreen();

  // Focus the iframe when clicked
  const focusIFrame = useCallback(() => {
    iframeRef.current?.focus();
  }, []);

  const postToEmbed = useCallback(
    (payload: unknown): boolean => {
      const win = iframeRef.current?.contentWindow;
      if (!win) {
        console.warn('[EmulatorIFrame] postToEmbed: iframe contentWindow indisponível');
        return false;
      }
      try {
        win.postMessage(payload, window.location.origin);
        return true;
      } catch (err) {
        console.error('[EmulatorIFrame] postToEmbed: falha ao enviar mensagem', err);
        return false;
      }
    }, []
  );

  // Create blob URL from ROM data
  useEffect(() => {
    console.log('[EmulatorIFrame] Creating ROM blob URL');
    const blob = new Blob([new Uint8Array(romData)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    setRomUrl(url);
    console.log('[EmulatorIFrame] ROM blob URL created:', url);
    return () => {
      console.log('[EmulatorIFrame] Revoking ROM blob URL');
      URL.revokeObjectURL(url);
    };
  }, [romData]);

  // Build iframe src URL
  const iframeSrc = React.useMemo(() => {
    if (!romUrl) return '';

    const core = getEmulatorCore(platform);
    const params = new URLSearchParams({
      core,
      url: romUrl,
      mute: '1',
      volume: '0',
      startOnLoaded: '1'
    });

    const src = `/embed.html?${params.toString()}`;
    console.log('[EmulatorIFrame] Built iframe src:', src);
    return src;
  }, [romUrl, platform]);

  // Get aspect ratio for the platform
  const aspect = React.useMemo(() => {
    const aspectStr = getEmulatorAspect(platform);
    const [w, h] = aspectStr.split(' / ').map(Number);
    return w / h;
  }, [platform]);

  useEffect(() => {
    if (!iframeSrc) return;
    setIsLoading(true);
    setIsReady(false);
    setError(null);
  }, [iframeSrc]);

  // Listen for iframe messages
  useEffect(() => {
    console.log('[EmulatorIFrame] Setting up message listener');

    type EmbedMsg = { type?: string; message?: unknown; width?: number; height?: number; dpr?: number };
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data as EmbedMsg;
      if (!data || typeof data !== 'object') return;

      console.log('[EmulatorIFrame] Received message:', data);

      if (data.type === 'ejs:ready') {
        console.log('[EmulatorIFrame] Emulator ready signal received');
        setIsReady(true);
        setIsLoading(false);
        setError(null);
      } else if (data.type === 'ejs:error') {
        console.error('[EmulatorIFrame] Emulator error:', data.message);
        setError(String(data.message ?? 'Unknown error'));
        setIsLoading(false);
        setIsReady(false);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      console.log('[EmulatorIFrame] Removing message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Timeout for initialization
  useEffect(() => {
    if (!iframeSrc) return;
    console.log('[EmulatorIFrame] Setting up initialization timeout');
    const timeout = setTimeout(() => {
      if (!isReady && !error) {
        console.error('[EmulatorIFrame] Initialization timeout');
        setError('Emulator initialization timeout');
        setIsLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [iframeSrc, isReady, error]);

  // Auto-focus iframe when it loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log('[EmulatorIFrame] Iframe loaded, auto-focusing');
      setTimeout(() => {
        iframe.focus();
      }, 100); // Small delay to ensure iframe is ready
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, []);

  // Expose getCanvasStream and postRemoteInput methods via ref
  useImperativeHandle(ref, () => ({
    getCanvasStream: () => {
      console.log('[EmulatorIFrame] getCanvasStream called');

      if (!iframeRef.current || !isReady) {
        console.warn('[EmulatorIFrame] Canvas stream not available - iframe not ready');
        return null;
      }

      try {
        const iframe = iframeRef.current;
        const canvas = iframe.contentDocument?.querySelector('canvas') as HTMLCanvasElement;

        if (!canvas) {
          console.warn('[EmulatorIFrame] Canvas not found in iframe');
          return null;
        }

        console.log('[EmulatorIFrame] Capturing stream from iframe canvas');
        const stream = canvas.captureStream(60);
        console.log('[EmulatorIFrame] Canvas stream captured successfully');
        return stream;
      } catch (error) {
        console.error('[EmulatorIFrame] Failed to capture canvas stream:', error);
        return null;
      }
    },

    postRemoteInput: (input: { key: string; pressed: boolean }) => {
      console.log('[EmulatorIFrame] postRemoteInput called:', input);
      return postToEmbed({
        type: 'remote-input',
        payload: input
      });
    }
  }));

  // Handle multiplayer streaming
  useEffect(() => {
    if (!isHost || !addVideoTrackToPeerConnection || !isReady) {
      return;
    }

    console.log('[EmulatorIFrame] Setting up multiplayer streaming');

    let isTrackAdded = false;

    const setupStreaming = () => {
      if (isTrackAdded) return;

      try {
        const stream = ref && 'current' in ref && ref.current?.getCanvasStream();
        if (!stream) {
          console.warn('[EmulatorIFrame] No canvas stream available for multiplayer');
          return;
        }

        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
          console.warn('[EmulatorIFrame] No video tracks in canvas stream');
          return;
        }

        const videoTrack = videoTracks[0];
        console.log('[EmulatorIFrame] Adding video track to peer connection');
        addVideoTrackToPeerConnection(videoTrack, stream);
        isTrackAdded = true;
      } catch (error) {
        console.error('[EmulatorIFrame] Error setting up multiplayer streaming:', error);
      }
    };

    // Try immediate setup and then poll
    setupStreaming();

    const pollInterval = setInterval(() => {
      if (!isTrackAdded) {
        setupStreaming();
      } else {
        clearInterval(pollInterval);
      }
    }, 500);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isHost, isReady, addVideoTrackToPeerConnection, ref]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowNativeFS = isNativeFS();

      // If we exit native fullscreen, also exit our UI fullscreen
      if (!isNowNativeFS && isFullscreenUI) {
        setIsFullscreenUI(false);
        unlockOrientationSafe();
      }
    };

    return onFSChange(handleFullscreenChange);
  }, [isFullscreenUI, isNativeFS, setIsFullscreenUI, unlockOrientationSafe, onFSChange]);

  // Block keyboard + wheel + touch when in fullscreen or controlLock is active
  useEffect(() => {
    if (!isFullscreenUI && !controlLock) return;

    const blockedKeys = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      ' ', 'Space', 'Spacebar',
      'PageUp', 'PageDown', 'Home', 'End'
    ]);

    const onKeyDown = (e: KeyboardEvent) => {
      if (blockedKeys.has(e.key) || blockedKeys.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[EmulatorIFrame] Blocked key:', e.key);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[EmulatorIFrame] Blocked wheel event');
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[EmulatorIFrame] Blocked touchmove event');
    };

    // Add event listeners to container with capture and non-passive
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', onKeyDown, { capture: true, passive: false });
    container.addEventListener('wheel', onWheel, { capture: true, passive: false });
    container.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });

    return () => {
      container.removeEventListener('keydown', onKeyDown, { capture: true });
      container.removeEventListener('wheel', onWheel, { capture: true });
      container.removeEventListener('touchmove', onTouchMove, { capture: true });
    };
  }, [isFullscreenUI, controlLock]);

  // Control handlers
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!isNativeFS()) {
        // Try to enter native fullscreen first
        if (supportsNativeFS()) {
          try {
            await enterNativeFS(container);

            // Wait a bit for native fullscreen to activate
            setTimeout(async () => {
              if (isNativeFS()) {
                // Native fullscreen succeeded
                await lockLandscapeIfSupported();
                setIsFullscreenUI(true);
              } else {
                // Native fullscreen failed, use overlay fallback
                setIsFullscreenUI(true);
              }
            }, 120);
          } catch (error) {
            // Native fullscreen failed, use overlay fallback
            console.warn('[EmulatorIFrame] Native fullscreen failed, using overlay:', error);
            setIsFullscreenUI(true);
          }
        } else {
          // No native fullscreen support, use overlay fallback
          setIsFullscreenUI(true);
        }
      } else {
        // Exit fullscreen
        await exitNativeFS();
        unlockOrientationSafe();
        setIsFullscreenUI(false);
      }
    } catch (error) {
      console.error('[EmulatorIFrame] Fullscreen toggle error:', error);
      // Emergency fallback - just toggle UI state
      setIsFullscreenUI(!isFullscreenUI);
    }
  }, [supportsNativeFS, isNativeFS, enterNativeFS, exitNativeFS, lockLandscapeIfSupported, unlockOrientationSafe, setIsFullscreenUI, isFullscreenUI]);

  const handlePlayPause = useCallback(() => {
    setIsPaused(prev => {
      const next = !prev;
      postToEmbed({ type: next ? 'ejs:pause' : 'ejs:resume' });
      return next;
    });
  }, [postToEmbed]);

  const handleMuteToggle = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    const ok = postToEmbed({
      type: 'ejs:set-mute',
      muted: next,
      volume: next ? 0 : 0.5,
    });
    if (!ok) {
      console.warn('[EmulatorIFrame] Não foi possível aplicar mute via postMessage (iframe ainda não pronto?)');
    }
  }, [isMuted, postToEmbed]);

  const handleReset = useCallback(() => {
    const sent = postToEmbed({ type: 'ejs:reset' });
    setIsLoading(true);
    setIsReady(false);
    setError(null);
    if (sent) return;
    if (!iframeSrc || !iframeRef.current) return;
    console.warn('[EmulatorIFrame] Reset via postMessage falhou — usando fallback de reload');
    iframeRef.current.src = 'about:blank';
    setTimeout(() => { if (iframeRef.current) iframeRef.current.src = iframeSrc; }, 0);
  }, [iframeSrc, postToEmbed]);

  // Render fullscreen UI when isFullscreenUI is true
  if (isFullscreenUI) {
    return (
      <Card className="fixed inset-0 z-[9999] bg-black border-0 rounded-none">
        <CardContent className="p-0 relative">
          <div
            className="w-full h-full grid place-items-center"
            style={{
              padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
            }}
          >
            <div
              className="relative"
              style={{
                width: `min(100svw, calc(100svh * ${aspect}))`,
                height: `min(100svh, calc(100svw / ${aspect}))`,
              }}
            >
              {/* Loading Overlay */}
              {isLoading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p className="text-muted-foreground">Loading {title}...</p>
                </div>
              )}

              {/* Error Overlay */}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-10">
                  <p className="text-red-500 mb-2">Error loading emulator</p>
                  <p className="text-white text-sm">{error}</p>
                  <Button onClick={handleReset} className="mt-4" variant="outline">
                    Try Again
                  </Button>
                </div>
              )}

              {iframeSrc && (
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  className="absolute inset-0 w-full h-full border-0"
                  tabIndex={0}
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-downloads allow-forms"
                  allow="fullscreen; gamepad; autoplay; clipboard-write"
                  title={`${title} Emulator`}
                  style={{ pointerEvents: 'auto' }}
                />
              )}

              {/* Exit fullscreen button */}
              <Button
                onClick={toggleFullscreen}
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white"
                title="Exit fullscreen"
              >
                <Minimize className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normal (non-fullscreen) UI
  return (
    <div
      ref={containerRef}
      className={`emulator-container flex flex-col items-center space-y-4 ${className}`}
      onClick={focusIFrame}
    >
      {/* Game Title */}
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-center">{title}</CardTitle>
        </CardHeader>
      </Card>

      {/* Game Display */}
      <Card className="w-full max-w-4xl bg-black border-2">
        <CardContent className="p-4 relative">
          {/* Loading Overlay */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Loading {title}...</p>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-10">
              <p className="text-red-500 mb-2">Error loading emulator</p>
              <p className="text-white text-sm">{error}</p>
              <Button onClick={handleReset} className="mt-4" variant="outline">
                Try Again
              </Button>
            </div>
          )}

          {/* Iframe Container */}
          <div
            className={`relative bg-black rounded-lg overflow-hidden emulator-canvas-wrap
            ${controlLock ? 'touch-none' : 'touch-pan-y'}
            overscroll-contain`}
            style={{ aspectRatio: getEmulatorAspect(platform) }}
          >
            {iframeSrc && (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                className="absolute inset-0 w-full h-full border-0"
                tabIndex={0}
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-downloads allow-forms"
                allow="fullscreen; gamepad; autoplay; clipboard-write"
                title={`${title} Emulator`}
                style={{ pointerEvents: (isFullscreenUI || controlLock) ? 'auto' : 'none' }}
              />
            )}

            {!isFullscreenUI && !controlLock && (
              <>
                <button
                  type="button"
                  className="absolute inset-0 z-10 cursor-default bg-transparent"
                  onClick={() => setControlLock(true)}
                  aria-label="Enable controls"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                />

                <div className="absolute left-2 top-2 z-20 rounded bg-black/60 px-2 py-1 text-xs text-white">
                  Tap to play • Scroll unlocked
                </div>
              </>
            )}
          </div>

          {/* Mobile Control Lock Toggle - Only visible on mobile */}
          <div className="lg:hidden absolute top-2 right-2 z-10">
            <Button
              size="sm"
              variant={controlLock ? "default" : "secondary"}
              onClick={() => setControlLock(!controlLock)}
              className="bg-gray-800/80 backdrop-blur-sm border border-gray-700"
              title={controlLock ? "Unlock page scrolling" : "Lock page scrolling"}
            >
              {controlLock ? "🔒" : "🔓"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card className="w-full max-w-4xl">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
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
              <Maximize className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${
                error ? 'bg-red-500' : isReady ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
              {error ? 'Error' : isReady ? 'Ready' : 'Loading'}
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
              Powered by EmulatorJS • Click fullscreen for best experience
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

EmulatorIFrame.displayName = 'EmulatorIFrame';

export default EmulatorIFrame;