import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [romUrl, setRomUrl] = useState('');

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

  // Expose getCanvasStream method via ref
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
      setIsFullscreen(!!document.fullscreenElement);
    };

    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'];
    events.forEach(event => {
      document.addEventListener(event, handleFullscreenChange);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleFullscreenChange);
      });
    };
  }, []);

  // Control handlers
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

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
        <CardContent className={`p-4 relative ${isFullscreen ? 'fullscreen-content' : ''}`}>
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
            className={`relative bg-black rounded-lg overflow-hidden ${isFullscreen ? 'fullscreen-canvas' : ''}`}
            style={{ height: isFullscreen ? '100vh' : '600px' }}
          >
            {iframeSrc && (
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-downloads"
                allow="fullscreen; gamepad; autoplay; clipboard-write"
                title={`${title} Emulator`}
              />
            )}
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

EmulatorIFrame.displayName = 'EmulatorIFrame';

export default EmulatorIFrame;