import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Maximize, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { NESEmulator, type NESControls } from '@/lib/emulator/nesEmulator';
import { ROMLoader, type ROMSource } from '@/lib/rom/romLoader';
import type { Game31996 } from '@/types/game';

interface RetroPlayerProps {
  meta: Game31996;
  romSource: ROMSource;
  onBack?: () => void;
  onFullscreen?: () => void;
  className?: string;
}

type EmulatorState = 'loading' | 'ready' | 'running' | 'paused' | 'error';
type ErrorType = 'rom-not-found' | 'rom-invalid' | 'emulator-error' | 'network-error' | 'too-large';

export function RetroPlayer({
  meta,
  romSource,
  onBack,
  onFullscreen,
  className = ''
}: RetroPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emulatorRef = useRef<NESEmulator | null>(null);
  const [state, setState] = useState<EmulatorState>('loading');
  const [error, setError] = useState<ErrorType | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [controls, setControls] = useState<NESControls>({
    right: false,
    left: false,
    down: false,
    up: false,
    start: false,
    select: false,
    b: false,
    a: false,
  });
  const [romInfo, setRomInfo] = useState<any>(null);

  // Initialize emulator
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const emulator = new NESEmulator();
      emulator.init(canvasRef.current, {
        audio: audioEnabled,
      });

      emulatorRef.current = emulator;

      // Set up canvas click to enable audio
      const handleCanvasClick = () => {
        if (emulatorRef.current && audioEnabled) {
          emulatorRef.current.toggleAudio(true);
        }
      };

      canvasRef.current.addEventListener('click', handleCanvasClick);

      return () => {
        canvasRef.current?.removeEventListener('click', handleCanvasClick);
        emulator.dispose();
      };
    } catch (err) {
      console.error('Emulator initialization failed:', err);
      setState('error');
      setError('emulator-error');
    }
  }, [audioEnabled]);

  // Load ROM
  useEffect(() => {
    const loadROM = async () => {
      if (!emulatorRef.current) return;

      try {
        setState('loading');
        setError(null);

        const romData = await ROMLoader.loadROM(romSource, {
          maxSize: 4 * 1024 * 1024, // 4MB max
        });

        // Validate NES ROM
        const isValid = await ROMLoader.validateNESROM(romData);
        if (!isValid) {
          setError('rom-invalid');
          setState('error');
          return;
        }

        // Get ROM info
        const info = ROMLoader.getROMInfo(romData);
        setRomInfo(info);

        // Load ROM into emulator
        const success = emulatorRef.current!.loadROM(romData);
        if (!success) {
          setError('emulator-error');
          setState('error');
          return;
        }

        setState('ready');
      } catch (err) {
        console.error('ROM loading failed:', err);

        if (err instanceof Error) {
          if (err.message.includes('too large')) {
            setError('too-large');
          } else if (err.message.includes('HTTP 404')) {
            setError('rom-not-found');
          } else if (err.message.includes('Failed to load ROM from URL')) {
            setError('network-error');
          }
        }

        setState('error');
      }
    };

    loadROM();
  }, [romSource]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (emulatorRef.current) {
        emulatorRef.current.dispose();
      }
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, keyof NESControls> = {
        'ArrowRight': 'right',
        'ArrowLeft': 'left',
        'ArrowDown': 'down',
        'ArrowUp': 'up',
        'Enter': 'start',
        'Shift': 'select',
        'z': 'b',
        'x': 'a',
      };

      const control = keyMap[e.key.toLowerCase()];
      if (control && !controls[control]) {
        setControls(prev => ({ ...prev, [control]: true }));
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyMap: Record<string, keyof NESControls> = {
        'ArrowRight': 'right',
        'ArrowLeft': 'left',
        'ArrowDown': 'down',
        'ArrowUp': 'up',
        'Enter': 'start',
        'Shift': 'select',
        'z': 'b',
        'x': 'a',
      };

      const control = keyMap[e.key.toLowerCase()];
      if (control && controls[control]) {
        setControls(prev => ({ ...prev, [control]: false }));
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [controls]);

  // Update emulator controls
  useEffect(() => {
    if (emulatorRef.current && (state === 'running' || state === 'paused')) {
      emulatorRef.current.setControls(controls);
    }
  }, [controls, state]);

  const handlePlay = () => {
    if (emulatorRef.current) {
      emulatorRef.current.play();
      setState('running');
    }
  };

  const handlePause = () => {
    if (emulatorRef.current) {
      emulatorRef.current.pause();
      setState('paused');
    }
  };

  const handleReset = () => {
    if (emulatorRef.current) {
      emulatorRef.current.reset();
      setState('running');
    }
  };

  const handleToggleAudio = () => {
    const newAudioState = !audioEnabled;
    setAudioEnabled(newAudioState);

    if (emulatorRef.current) {
      emulatorRef.current.toggleAudio(newAudioState);
    }
  };

  const handleFullscreen = () => {
    if (onFullscreen) {
      onFullscreen();
    } else if (canvasRef.current) {
      if (canvasRef.current.requestFullscreen) {
        canvasRef.current.requestFullscreen();
      }
    }
  };

  const getErrorMessage = () => {
    switch (error) {
      case 'rom-not-found':
        return 'ROM file not found';
      case 'rom-invalid':
        return 'Invalid NES ROM file';
      case 'emulator-error':
        return 'Emulator initialization failed';
      case 'network-error':
        return 'Failed to download ROM';
      case 'too-large':
        return 'ROM file is too large';
      default:
        return 'An unknown error occurred';
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return null;
    const sizes = ["B", "KB", "MB", "GB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < sizes.length - 1) {
      size /= 1024;
      i++;
    }
    return `${Math.round(size * 100) / 100} ${sizes[i]}`;
  };

  return (
    <div className={`min-h-screen bg-black text-white ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-300 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div>
                <h1 className="text-xl font-bold text-white">{meta.title}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  {meta.version && (
                    <Badge className="border-gray-600 text-gray-300">
                      v{meta.version}
                    </Badge>
                  )}
                  {meta.platforms.length > 0 && (
                    <Badge className="border-gray-600 text-gray-300">
                      {meta.platforms[0]}
                    </Badge>
                  )}
                  {romInfo?.mapper !== undefined && (
                    <Badge className="border-gray-600 text-gray-300">
                      Mapper {romInfo.mapper}
                    </Badge>
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
                  <div className="relative aspect-video bg-black flex items-center justify-center">
                    {state === 'loading' && (
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">Loading ROM...</p>
                      </div>
                    )}

                    {state === 'error' && (
                      <div className="text-center p-8">
                        <div className="text-red-400 text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
                        <p className="text-gray-400 mb-4">{getErrorMessage()}</p>
                        <Button onClick={onBack} variant="outline">
                          Go Back
                        </Button>
                      </div>
                    )}

                    {(state === 'ready' || state === 'running' || state === 'paused') && (
                      <>
                        <canvas
                          ref={canvasRef}
                          className="w-full h-full max-w-4xl mx-auto"
                          style={{ imageRendering: 'pixelated' }}
                          width={256}
                          height={240}
                        />

                        {/* Audio prompt overlay */}
                        {audioEnabled && state === 'ready' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <Card className="border-purple-500 bg-purple-900/20">
                              <CardContent className="p-6 text-center">
                                <Volume2 className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-white mb-2">Tap to Enable Audio</h3>
                                <p className="text-gray-400 text-sm">
                                  Click the game area to enable sound (required by browsers)
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Control bar */}
              <Card className="border-gray-800 bg-gray-900">
                <CardContent className="p-4">
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      onClick={state === 'running' ? handlePause : handlePlay}
                      disabled={state !== 'ready' && state !== 'running' && state !== 'paused'}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {state === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {state === 'running' ? 'Pause' : 'Play'}
                    </Button>

                    <Button
                      onClick={handleReset}
                      disabled={state !== 'running' && state !== 'paused'}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:text-white"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>

                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className={`w-2 h-2 rounded-full ${state === 'running' ? 'bg-green-400' : state === 'paused' ? 'bg-yellow-400' : 'bg-gray-600'}`}></div>
                      {state === 'running' ? 'Running' : state === 'paused' ? 'Paused' : state === 'ready' ? 'Ready' : 'Loading'}
                    </div>
                  </div>
                </CardContent>
              </Card>

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
              <Card className="border-gray-800 bg-gray-900">
                <CardContent className="p-4 space-y-4">
                  <h3 className="text-lg font-semibold text-white">Game Info</h3>

                  {meta.assets.cover && (
                    <div className="aspect-video rounded-lg overflow-hidden">
                      <img
                        src={meta.assets.cover}
                        alt={meta.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    {meta.genres.length > 0 && (
                      <div>
                        <span className="text-gray-500">Genre:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {meta.genres.map((genre) => (
                            <Badge key={genre} className="text-xs bg-gray-800 text-gray-300">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {meta.modes.length > 0 && (
                      <div>
                        <span className="text-gray-500">Mode:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {meta.modes.map((mode) => (
                            <Badge key={mode} className="text-xs border-gray-600 text-gray-300">
                              {mode}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {meta.status && (
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <Badge
                          className={`ml-2 text-xs ${
                            meta.status === 'released' ? 'border-green-600 text-green-400' :
                            meta.status === 'beta' ? 'border-blue-600 text-blue-400' :
                            meta.status === 'alpha' ? 'border-orange-600 text-orange-400' :
                            'border-gray-600 text-gray-400'
                          }`}
                        >
                          {meta.status}
                        </Badge>
                      </div>
                    )}

                    {meta.sizeBytes && (
                      <div>
                        <span className="text-gray-500">Size:</span>
                        <span className="ml-2 text-white">{formatSize(meta.sizeBytes)}</span>
                      </div>
                    )}

                    {meta.sha256 && (
                      <div>
                        <span className="text-gray-500">SHA256:</span>
                        <div className="font-mono text-xs text-gray-400 mt-1 break-all">
                          {meta.sha256}
                        </div>
                      </div>
                    )}

                    {romInfo && (
                      <div className="pt-2 border-t border-gray-800">
                        <span className="text-gray-500">ROM Info:</span>
                        <div className="text-xs text-gray-400 mt-1 space-y-1">
                          <div>PRG Banks: {romInfo.prgBanks}</div>
                          <div>CHR Banks: {romInfo.chrBanks}</div>
                          <div>Mapper: {romInfo.mapper}</div>
                          {romInfo.hasBattery && <div>Battery: Yes</div>}
                          {romInfo.isNES2_0 && <div>NES 2.0: Yes</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Screenshots */}
              {meta.assets.screenshots.length > 0 && (
                <Card className="border-gray-800 bg-gray-900">
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Screenshots</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {meta.assets.screenshots.slice(0, 4).map((screenshot, index) => (
                        <div key={index} className="aspect-video rounded-lg overflow-hidden">
                          <img
                            src={screenshot}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
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