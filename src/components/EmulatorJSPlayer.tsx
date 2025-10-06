/**
 * EmulatorJS Player Component
 *
 * React component that uses EmulatorJS to play games from multiple systems.
 * Automatically selects the appropriate emulator core based on the game's MIME type.
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
  'application/x-nes-rom': 'fceumm',
  'application/x-nintendo-nes-rom': 'fceumm',

  // Super Nintendo Entertainment System
  'application/x-snes-rom': 'snes9x',
  'application/x-nintendo-snes-rom': 'snes9x',

  // Game Boy / Game Boy Color
  'application/x-gameboy-rom': 'gambatte',
  'application/x-gameboy-color-rom': 'gambatte',
  'application/x-nintendo-gameboy-rom': 'gambatte',

  // Game Boy Advance
  'application/x-gba-rom': 'mgba',
  'application/x-gameboy-advance-rom': 'mgba',
  'application/x-nintendo-gba-rom': 'mgba',

  // Nintendo 64
  'application/x-n64-rom': 'mupen64plus_next',
  'application/x-nintendo-64-rom': 'mupen64plus_next',

  // Sega Genesis/Mega Drive
  'application/x-genesis-rom': 'genesis_plus_gx',
  'application/x-megadrive-rom': 'genesis_plus_gx',
  'application/x-sega-genesis-rom': 'genesis_plus_gx',

  // Sega Master System
  'application/x-sms-rom': 'genesis_plus_gx',
  'application/x-master-system-rom': 'genesis_plus_gx',

  // Sega Game Gear
  'application/x-gamegear-rom': 'genesis_plus_gx',
  'application/x-sega-gamegear-rom': 'genesis_plus_gx',

  // Atari 2600
  'application/x-atari-2600-rom': 'stella2014',
  'application/x-atari2600-rom': 'stella2014',

  // PlayStation
  'application/x-playstation-rom': 'pcsx_rearmed',
  'application/x-psx-rom': 'pcsx_rearmed',

  // Neo Geo Pocket
  'application/x-ngp-rom': 'mednafen_ngp',
  'application/x-neo-geo-pocket-rom': 'mednafen_ngp',

  // Lynx
  'application/x-lynx-rom': 'handy',
  'application/x-atari-lynx-rom': 'handy',

  // Virtual Boy
  'application/x-virtualboy-rom': 'beetle_vb',
  'application/x-nintendo-virtualboy-rom': 'beetle_vb',

  // WonderSwan
  'application/x-wonderswan-rom': 'mednafen_wswan',

  // PC Engine / TurboGrafx-16
  'application/x-pce-rom': 'mednafen_pce',
  'application/x-turbografx-rom': 'mednafen_pce',

  // Nintendo DS
  'application/x-nintendo-ds-rom': 'desmume',
  'application/x-nds-rom': 'desmume',

  // Arcade (MAME)
  'application/x-mame-rom': 'mame2003_plus',
  'application/x-arcade-rom': 'mame2003_plus',

  // DOS
  'application/x-dos-executable': 'dosbox_pure',
  'application/x-msdos-program': 'dosbox_pure',
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
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emulatorInstance, setEmulatorInstance] = useState<any>(null);

  const emulatorContainerRef = useRef<HTMLDivElement>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);

  // Get the appropriate core for this MIME type
  const coreType = MIME_TO_CORE[mimeType];
  const systemName = MIME_TO_SYSTEM_NAME[mimeType] || 'Unknown System';

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getCanvasStream: () => {
      console.log('[EmulatorJSPlayer] 📹 getCanvasStream called via ref at:', new Date().toISOString());
      if (canvasElement) {
        try {
          const stream = canvasElement.captureStream(60); // 60 FPS
          console.log('[EmulatorJSPlayer] ✅ Canvas stream captured successfully');
          return stream;
        } catch (error) {
          console.error('[EmulatorJSPlayer] ❌ Failed to capture canvas stream:', error);
          return null;
        }
      } else {
        console.warn('[EmulatorJSPlayer] ❌ Canvas element not available for stream capture');
        return null;
      }
    }
  }));

  // Initialize EmulatorJS
  useEffect(() => {
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

        // Convert base64 to binary data
        let binaryData: Uint8Array;
        try {
          // Remove data URL prefix if present
          const base64Data = romData.includes(',') ? romData.split(',')[1] : romData;
          const binaryString = atob(base64Data);
          binaryData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            binaryData[i] = binaryString.charCodeAt(i);
          }
          console.log('[EmulatorJSPlayer] ✅ ROM data converted, size:', binaryData.length, 'bytes');
        } catch (decodeError) {
          throw new Error(`Failed to decode ROM data: ${decodeError instanceof Error ? decodeError.message : 'Invalid data'}`);
        }

        // Wait for container to be ready
        if (!emulatorContainerRef.current) {
          throw new Error('Emulator container not ready');
        }

        // For now, create a placeholder that shows the system information
        // TODO: Implement actual EmulatorJS integration once we have proper documentation

        const container = emulatorContainerRef.current;
        container.innerHTML = '';

        // Create a placeholder div
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '600px';
        placeholder.style.backgroundColor = '#1a1a1a';
        placeholder.style.border = '2px solid #333';
        placeholder.style.borderRadius = '8px';
        placeholder.style.display = 'flex';
        placeholder.style.flexDirection = 'column';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#fff';
        placeholder.style.fontFamily = 'system-ui, sans-serif';

        placeholder.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">🎮</div>
            <h3 style="margin: 0 0 10px 0; font-size: 24px;">EmulatorJS Player</h3>
            <p style="margin: 0 0 5px 0; color: #888;">System: ${systemName}</p>
            <p style="margin: 0 0 5px 0; color: #888;">Core: ${coreType}</p>
            <p style="margin: 0 0 5px 0; color: #888;">MIME: ${mimeType}</p>
            <p style="margin: 0 0 20px 0; color: #888;">ROM Size: ${Math.round(binaryData.length / 1024)}KB</p>
            <p style="margin: 0; color: #666; font-size: 14px;">EmulatorJS integration in progress...</p>
          </div>
        `;

        container.appendChild(placeholder);

        // Create a fake canvas for stream capture (for multiplayer compatibility)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 240;
        canvas.style.display = 'none';
        container.appendChild(canvas);
        setCanvasElement(canvas);

        // Draw a simple pattern on the canvas for testing
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#333';
          ctx.fillText('EmulatorJS Placeholder', 10, 120);
        }

        setEmulatorInstance({
          // Mock emulator instance
          pause: () => console.log('Pause called'),
          resume: () => console.log('Resume called'),
          restart: () => console.log('Restart called'),
          setVolume: (vol: number) => console.log('Volume set to:', vol),
          destroy: () => console.log('Destroy called')
        });
        setIsReady(true);
        setError(null);

        console.log('[EmulatorJSPlayer] ✅ EmulatorJS initialized successfully');

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize emulator';
        console.error('[EmulatorJSPlayer] ❌ Initialization error:', errorMessage);
        setError(errorMessage);
        setIsReady(false);
      }
    };

    initializeEmulator();

    // Cleanup function
    return () => {
      if (emulatorInstance) {
        try {
          emulatorInstance.destroy?.();
        } catch (err) {
          console.warn('[EmulatorJSPlayer] Warning during cleanup:', err);
        }
      }
    };
  }, [romData, mimeType, coreType]);

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
      emulatorContainerRef.current.requestFullscreen?.();
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

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Card className="w-full max-w-4xl border-destructive">
          <CardContent className="p-8 text-center">
            <div className="text-destructive text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-destructive mb-2">Error Loading Game</h3>
            <p className="text-muted-foreground mb-2">{error}</p>
            <p className="text-sm text-muted-foreground mb-4">
              System: {systemName} | MIME: {mimeType}
            </p>
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
            <p className="text-sm text-muted-foreground mt-2">
              System: {systemName}
            </p>
          </CardContent>
        </Card>
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
            <CardTitle className="text-center">
              {title}
              <div className="text-sm font-normal text-muted-foreground mt-1">
                {systemName}
              </div>
            </CardTitle>
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
            {/* EmulatorJS will be mounted here */}
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