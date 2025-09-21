import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Maximize, Volume2, VolumeX, ArrowLeft, RefreshCw, Copy } from 'lucide-react';
import { NESEmulator, type NESControls } from '@/lib/emulator/nesEmulator';
import { ROMLoader, type ROMSource } from '@/lib/rom/romLoader';
import type { Game31996, NostrEvent } from '@/types/game';

interface RetroPlayerProps {
  meta: Game31996;
  romSource: ROMSource;
  nostrEvent?: NostrEvent | null;
  onBack?: () => void;
  onFullscreen?: () => void;
  className?: string;
}

type EmulatorState = 'idle' | 'fetching' | 'decoding' | 'validating' | 'loading-emulator' | 'ready' | 'running' | 'paused' | 'error';
type ErrorType = 'rom-not-found' | 'rom-invalid' | 'emulator-error' | 'network-error' | 'too-large' | 'decode-error' | 'validation-error' | 'size-mismatch' | 'hash-mismatch' | 'unsupported-compression' | 'unsupported-encoding' | 'test-rom-failed';

export function RetroPlayer({
  meta,
  romSource,
  nostrEvent,
  onBack,
  onFullscreen,
  className = ''
}: RetroPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emulatorRef = useRef<NESEmulator | null>(null);
  const [state, setState] = useState<EmulatorState>('loading');
  const [error, setError] = useState<ErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  const [validationResult, setValidationResult] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<{
    currentPhase: string;
    lastError?: string;
    eventId?: string;
    dTag?: string;
    parsedTags?: Record<string, string>;
    decodedSize?: number;
    startTime?: number;
    phaseTimes?: Record<string, number>;
  }>({
    currentPhase: 'idle',
    startTime: Date.now(),
    phaseTimes: {}
  });

  // Initialize emulator
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      console.log("[Retro] Initializing emulator…");
      const emulator = new NESEmulator();
      emulator.init(canvasRef.current, {
        audio: audioEnabled,
      });

      emulatorRef.current = emulator;
      console.log("[Retro] Emulator initialized successfully");

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
      console.error("[Retro] Emulator error:", err);
      setState('error');
      setError('emulator-error');
    }
  }, [audioEnabled]);

  // Debug logging helper
  const logPhase = (phase: string, details?: any) => {
    const now = Date.now();
    const elapsed = debugInfo.startTime ? now - debugInfo.startTime : 0;
    console.log(`[Retro] ${phase}`, details || '', `(t+${elapsed}ms)`);

    setDebugInfo(prev => ({
      ...prev,
      currentPhase: phase,
      phaseTimes: {
        ...prev.phaseTimes,
        [phase]: now
      }
    }));
  };

  const logError = (phase: string, error: any) => {
    console.error(`[Retro] ERROR in ${phase}:`, error);
    setDebugInfo(prev => ({
      ...prev,
      currentPhase: 'error',
      lastError: `${phase}: ${error instanceof Error ? error.message : String(error)}`
    }));
  };

  // Load ROM
  useEffect(() => {
    const loadROM = async () => {
      if (!emulatorRef.current) return;

      try {
        // Reset debug info
        setDebugInfo({
          currentPhase: 'idle',
          startTime: Date.now(),
          phaseTimes: {}
        });

        setError(null);
        setErrorMessage(null);
        setValidationResult(null);
        setRomInfo(null);

        let romData: Uint8Array;

        if (romSource.source === 'nostr') {
          // Log tags before decoding
          console.log("[Retro] Event tags:", romSource.event.tags);

          // Log content before decoding (first and last 100 chars)
          const content = romSource.event.content;
          console.log("[Retro] Content (start):", content.slice(0, 100));
          console.log("[Retro] Content (end):", content.slice(-100));

          // Extract debug info from Nostr event
          const getTagValue = (tagName: string): string | undefined => {
            const tag = romSource.event.tags.find(t => t[0] === tagName);
            return tag?.[1];
          };

          const dTag = getTagValue('d');
          const parsedTags = {
            encoding: getTagValue('encoding') || 'base64',
            compression: getTagValue('compression') || 'none',
            size: getTagValue('size') || 'unknown',
            sha256: getTagValue('sha256') || 'unknown',
            mime: getTagValue('mime') || 'unknown'
          };

          setDebugInfo(prev => ({
            ...prev,
            dTag,
            parsedTags,
            eventId: nostrEvent?.id
          }));

          logPhase('Fetching event...');
          // The event is already fetched by the parent component, so we just validate it
          logPhase('Event fetched:', nostrEvent?.id);

          logPhase('Decoding with encoding=' + parsedTags.encoding);
          setState('decoding');

          const validation = await ROMLoader.validateROMFromNostrEvent(romSource.event);
          setValidationResult(validation);

          if (!validation.isValid) {
            logError('decoding', new Error(validation.error || 'ROM validation failed'));
            setError('validation-error' as ErrorType);
            setErrorMessage(validation.error || 'ROM validation failed');
            setState('error');
            return;
          }

          romData = validation.decodedBytes!;
          logPhase('Decoded bytes:', romData.length);

          // Log decoded byte details
          console.log("[Retro] decoded len:", romData.length);
          console.log("[Retro] bytes start:", Array.from(romData.slice(0, 16)));
          console.log("[Retro] bytes end:", Array.from(romData.slice(-16)));

          setDebugInfo(prev => ({
            ...prev,
            decodedSize: romData.length
          }));

          logPhase('Validating size', { expected: parsedTags.size, actual: romData.length });
          setState('validating');

          // Get ROM info
          const info = ROMLoader.getROMInfo(romData);
          setRomInfo(info);

          // Add short hash to validation result for display
          if (validation.actualHash) {
            validation.shortHash = validation.actualHash.substring(0, 8);
          } else {
            const computedHash = await ROMLoader.computeSHA256(romData);
            validation.actualHash = computedHash;
            validation.shortHash = computedHash.substring(0, 8);
          }

          if (validation.actualHash && validation.expectedHash) {
            if (validation.actualHash === validation.expectedHash.toLowerCase()) {
              logPhase('SHA256 OK', { hash: validation.shortHash });
            } else {
              logError('validating', new Error(`SHA256 mismatch: expected ${validation.expectedHash}, got ${validation.actualHash}`));
              setError('hash-mismatch' as ErrorType);
              setErrorMessage('SHA256 hash does not match expected value');
              setState('error');
              return;
            }
          } else {
            logPhase('SHA256 validation skipped (no expected hash provided)');
          }

          if (validation.expectedSize && validation.actualSize) {
            if (validation.actualSize === validation.expectedSize) {
              logPhase('Size validation OK:', validation.actualSize, 'bytes');
            } else {
              logError('validating', new Error(`Size mismatch: expected ${validation.expectedSize}, got ${validation.actualSize}`));
              setError('size-mismatch' as ErrorType);
              setErrorMessage('ROM size does not match expected size');
              setState('error');
              return;
            }
          } else {
            logPhase('Size validation skipped (no expected size provided)');
          }
        } else {
          // Phase 1: Load from URL
          logPhase('Fetching ROM from URL...');
          setState('fetching');

          romData = await ROMLoader.loadROM(romSource, {
            maxSize: 4 * 1024 * 1024, // 4MB max
          });
          logPhase('ROM fetched:', romData.length, 'bytes');

          setDebugInfo(prev => ({
            ...prev,
            decodedSize: romData.length
          }));

          // Validate NES ROM
          logPhase('Validating NES ROM structure...');
          setState('validating');

          const isValid = await ROMLoader.validateNESROM(romData);
          if (!isValid) {
            logError('validating', new Error('Invalid NES ROM format'));
            setError('rom-invalid');
            setErrorMessage('Invalid NES ROM file format');
            setState('error');
            return;
          }
          logPhase('NES ROM validation OK');

          // Get ROM info
          const info = ROMLoader.getROMInfo(romData);
          setRomInfo(info);
          logPhase('ROM info extracted', { mapper: info.mapper, prg: info.prgBanks, chr: info.chrBanks });
        }

        // Load ROM into emulator
        console.log("[Retro] Initializing emulator…");
        console.log("[Retro] loadROM…");
        logPhase('Loading ROM into emulator...');
        setState('loading-emulator');

        try {
          const success = emulatorRef.current!.loadROM(romData);
          if (!success) {
            console.error("[Retro] Emulator error:", new Error('Failed to load ROM into emulator'));
            logError('loading-emulator', new Error('Failed to load ROM into emulator'));
            setError('emulator-error');
            setErrorMessage('Failed to load ROM into emulator');
            setState('error');
            return;
          }

          logPhase('Emulator started');
          setState('ready');
        } catch (e) {
          console.error("[Retro] Emulator error:", e);
          logError('loading-emulator', e);
          setError('emulator-error');
          setErrorMessage(e instanceof Error ? e.message : 'Emulator initialization failed');
          setState('error');
          return;
        }
      } catch (err) {
        logError('loading', err);

        let errorType: ErrorType = 'emulator-error';
        let errorMsg = err instanceof Error ? err.message : 'Unknown error';

        if (err instanceof Error) {
          if (err.message.includes('too large')) {
            errorType = 'too-large';
          } else if (err.message.includes('HTTP 404')) {
            errorType = 'rom-not-found';
          } else if (err.message.includes('Failed to load ROM from URL')) {
            errorType = 'network-error';
          } else if (err.message.includes('Failed to decode')) {
            errorType = 'decode-error';
          } else if (err.message.includes('Size mismatch')) {
            errorType = 'size-mismatch';
          } else if (err.message.includes('SHA256 mismatch')) {
            errorType = 'hash-mismatch';
          } else if (err.message.includes('Unsupported compression')) {
            errorType = 'unsupported-compression';
          } else if (err.message.includes('Unsupported encoding')) {
            errorType = 'unsupported-encoding';
          }
        }

        setError(errorType);
        setErrorMessage(errorMsg);
        setState('error');
      }
    };

    loadROM();
  }, [romSource, nostrEvent]);

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

  const handleRetry = () => {
    // Reload the component to retry
    setError(null);
    setErrorMessage(null);
    setValidationResult(null);
    setRomInfo(null);
    setState('idle');
  };

  const handleLoadTestROM = async () => {
    if (!emulatorRef.current) return;

    try {
      console.log("[Retro] Loading Test ROM...");
      logPhase('Loading Test ROM...');
      setState('fetching');
      setError(null);
      setErrorMessage(null);

      // Load test ROM from static URL
      const testRomSource: ROMSource = {
        source: 'url',
        url: '/roms/test-rom.nes'
      };

      console.log("[Retro] Test ROM URL:", testRomSource.url);
      const romData = await ROMLoader.loadROM(testRomSource, {
        maxSize: 4 * 1024 * 1024,
      });
      logPhase('Test ROM fetched:', romData.length, 'bytes');

      // Log decoded bytes for test ROM too
      console.log("[Retro] Test ROM length:", romData.length);
      console.log("[Retro] Test ROM preview (start):", romData.slice(0, 16));
      console.log("[Retro] Test ROM preview (end):", romData.slice(-16));

      // Validate NES ROM
      logPhase('Validating Test ROM...');
      setState('validating');

      const isValid = await ROMLoader.validateNESROM(romData);
      if (!isValid) {
        logError('validating', new Error('Invalid Test ROM format'));
        setError('test-rom-failed' as ErrorType);
        setErrorMessage('Test ROM is not a valid NES file');
        setState('error');
        return;
      }
      logPhase('Test ROM validation OK');

      // Get ROM info
      const info = ROMLoader.getROMInfo(romData);
      setRomInfo(info);
      logPhase('Test ROM info', { mapper: info.mapper, prg: info.prgBanks, chr: info.chrBanks });

      // Load ROM into emulator
      console.log("[Retro] Loading Test ROM into emulator...");
      logPhase('Loading Test ROM into emulator...');
      setState('loading-emulator');

      try {
        const success = emulatorRef.current!.loadROM(romData);
        if (!success) {
          console.error("[Retro] Test ROM emulator error:", new Error('Failed to load Test ROM into emulator'));
          logError('loading-emulator', new Error('Failed to load Test ROM into emulator'));
          setError('test-rom-failed' as ErrorType);
          setErrorMessage('Failed to load Test ROM into emulator');
          setState('error');
          return;
        }

        logPhase('Test ROM loaded successfully');
        setState('ready');
      } catch (e) {
        console.error("[Retro] Test ROM emulator error:", e);
        logError('loading-emulator', e);
        setError('test-rom-failed' as ErrorType);
        setErrorMessage(e instanceof Error ? e.message : 'Test ROM emulator initialization failed');
        setState('error');
        return;
      }
    } catch (err) {
      logError('loading-test-rom', err);
      setError('test-rom-failed' as ErrorType);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load Test ROM');
      setState('error');
    }
  };

  const handleCopyEventId = () => {
    if (nostrEvent) {
      navigator.clipboard.writeText(nostrEvent.id);
      // You could add a toast notification here
    }
  };

  const getErrorMessage = () => {
    if (errorMessage) return errorMessage;

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
      case 'decode-error':
        return 'Failed to decode ROM data';
      case 'validation-error':
        return 'ROM validation failed';
      case 'size-mismatch':
        return 'ROM size does not match expected size';
      case 'hash-mismatch':
        return 'ROM hash does not match expected hash';
      case 'unsupported-compression':
        return 'Unsupported compression format';
      case 'unsupported-encoding':
        return 'Unsupported encoding format';
      case 'test-rom-failed':
        return 'Test ROM failed to load - emulator may have issues';
      default:
        return 'An unknown error occurred';
    }
  };

  const getStateMessage = () => {
    switch (state) {
      case 'idle':
        return 'Ready to load...';
      case 'fetching':
        return 'Fetching ROM...';
      case 'decoding':
        return 'Decoding ROM...';
      case 'validating':
        return 'Validating ROM...';
      case 'loading-emulator':
        return 'Loading into emulator...';
      case 'ready':
        return 'Ready to play';
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'error':
        return 'Error';
      default:
        return 'Loading...';
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
                    {(state === 'idle' || state === 'fetching' || state === 'decoding' || state === 'validating' || state === 'loading-emulator') && (
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">{getStateMessage()}</p>
                        {state === 'fetching' && (
                          <p className="text-gray-500 text-sm mt-2">
                            {romSource.source === 'nostr' ? 'Fetching from Nostr event...' : 'Downloading ROM file...'}
                          </p>
                        )}
                        {state === 'decoding' && (
                          <p className="text-gray-500 text-sm mt-2">
                            {romSource.source === 'nostr' ? 'Decoding from Nostr event...' : 'Processing ROM data...'}
                          </p>
                        )}
                        {state === 'validating' && (
                          <p className="text-gray-500 text-sm mt-2">
                            Validating ROM integrity...
                          </p>
                        )}
                        {state === 'loading-emulator' && (
                          <p className="text-gray-500 text-sm mt-2">
                            Loading ROM into emulator...
                          </p>
                        )}

                        {/* Debug info during loading */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="mt-4 text-xs text-gray-600 bg-gray-800 rounded p-2 text-left">
                            <div>Phase: {debugInfo.currentPhase}</div>
                            {debugInfo.eventId && <div>Event: {debugInfo.eventId.substring(0, 16)}...</div>}
                            {debugInfo.decodedSize && <div>Size: {Math.round(debugInfo.decodedSize / 1024)}KB</div>}
                          </div>
                        )}
                      </div>
                    )}

                    {state === 'error' && (
                      <div className="text-center p-8">
                        <div className="text-red-400 text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
                        <p className="text-gray-400 mb-4">{getErrorMessage()}</p>

                        {/* Show validation details if available */}
                        {validationResult && (
                          <div className="bg-gray-800 rounded-lg p-4 mb-4 text-left">
                            <h4 className="text-sm font-semibold text-white mb-2">Validation Details</h4>
                            <div className="text-xs text-gray-400 space-y-1">
                              <div>Encoding: {validationResult.encoding}</div>
                              <div>Compression: {validationResult.compression}</div>
                              {validationResult.actualSize && (
                                <div>Size: {validationResult.actualSize} bytes</div>
                              )}
                              {validationResult.expectedSize && (
                                <div>Expected: {validationResult.expectedSize} bytes</div>
                              )}
                              {validationResult.shortHash && (
                                <div>Hash: {validationResult.shortHash}...</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Debug Panel */}
                        {(process.env.NODE_ENV === 'development' || window.location.search.includes('debug=1')) && (
                          <div className="bg-gray-800 rounded-lg p-4 mb-4 text-left">
                            <h4 className="text-sm font-semibold text-white mb-2">Debug Information</h4>
                            <div className="text-xs text-gray-400 space-y-1">
                              <div><strong>Current Phase:</strong> {debugInfo.currentPhase}</div>
                              {debugInfo.lastError && (
                                <div><strong>Last Error:</strong> {debugInfo.lastError}</div>
                              )}
                              {debugInfo.eventId && (
                                <div><strong>Event ID:</strong> {debugInfo.eventId}</div>
                              )}
                              {debugInfo.dTag && (
                                <div><strong>D-Tag:</strong> {debugInfo.dTag}</div>
                              )}
                              {debugInfo.parsedTags && (
                                <div className="mt-2">
                                  <div><strong>Parsed Tags:</strong></div>
                                  <div className="ml-2">
                                    {Object.entries(debugInfo.parsedTags).map(([key, value]) => (
                                      <div key={key}>  {key}: {value}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {debugInfo.decodedSize && (
                                <div><strong>Decoded Size:</strong> {debugInfo.decodedSize} bytes</div>
                              )}
                              {debugInfo.phaseTimes && Object.keys(debugInfo.phaseTimes).length > 0 && (
                                <div className="mt-2">
                                  <div><strong>Phase Timings:</strong></div>
                                  <div className="ml-2">
                                    {Object.entries(debugInfo.phaseTimes).map(([phase, time]) => {
                                      const elapsed = time - (debugInfo.startTime || time);
                                      return <div key={phase}>  {phase}: t+{elapsed}ms</div>;
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Button onClick={handleRetry} className="w-full">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry
                          </Button>

                          {/* Test ROM button - helps isolate emulator issues */}
                          <Button onClick={handleLoadTestROM} variant="outline" className="w-full">
                            <Play className="w-4 h-4 mr-2" />
                            Run Test ROM
                          </Button>

                          {nostrEvent && (
                            <Button onClick={handleCopyEventId} variant="outline" className="w-full">
                              <Copy className="w-4 h-4 mr-2" />
                              Copy Event ID
                            </Button>
                          )}
                          <Button onClick={onBack} variant="outline" className="w-full">
                            Go Back
                          </Button>
                        </div>
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
                                {romSource.source === 'nostr' && (
                                  <p className="text-gray-500 text-xs mt-2">
                                    ROM loaded from Nostr event
                                  </p>
                                )}
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
                      <div className={`w-2 h-2 rounded-full ${
                        state === 'running' ? 'bg-green-400' :
                        state === 'paused' ? 'bg-yellow-400' :
                        state === 'ready' ? 'bg-blue-400' :
                        state === 'error' ? 'bg-red-400' :
                        (state === 'fetching' || state === 'decoding' || state === 'validating' || state === 'loading-emulator') ? 'bg-purple-400' :
                        'bg-gray-600'
                      }`}></div>
                      {getStateMessage()}
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

                    {/* Validation info for Nostr ROMs */}
                    {validationResult && (
                      <div className="pt-2 border-t border-gray-800">
                        <span className="text-gray-500">Validation:</span>
                        <div className="text-xs text-gray-400 mt-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Encoding:</span>
                            <span className={validationResult.encoding === 'base64' ? 'text-green-400' : 'text-gray-300'}>
                              {validationResult.encoding}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Compression:</span>
                            <span className={validationResult.compression === 'none' ? 'text-green-400' : 'text-gray-300'}>
                              {validationResult.compression}
                            </span>
                          </div>
                          {validationResult.actualSize && (
                            <div className="flex items-center justify-between">
                              <span>Size:</span>
                              <span className="text-gray-300">
                                {Math.round(validationResult.actualSize / 1024)}KB
                              </span>
                            </div>
                          )}
                          {validationResult.shortHash && (
                            <div className="flex items-center justify-between">
                              <span>Hash:</span>
                              <span className="font-mono text-gray-300">
                                {validationResult.shortHash}
                              </span>
                            </div>
                          )}
                          {validationResult.expectedSize && (
                            <div className="flex items-center justify-between">
                              <span>Expected:</span>
                              <span className="text-gray-300">
                                {Math.round(validationResult.expectedSize / 1024)}KB
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Debug Panel for development */}
                    {(process.env.NODE_ENV === 'development' || window.location.search.includes('debug=1')) && (
                      <div className="pt-2 border-t border-gray-800">
                        <details className="group">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 list-none">
                            <span className="inline-flex items-center gap-1">
                              Debug Info
                              <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                            </span>
                          </summary>
                          <div className="mt-2 text-xs text-gray-400 space-y-1">
                            <div><strong>Phase:</strong> {debugInfo.currentPhase}</div>
                            {debugInfo.lastError && (
                              <div><strong>Error:</strong> {debugInfo.lastError}</div>
                            )}
                            {debugInfo.eventId && (
                              <div><strong>Event:</strong> {debugInfo.eventId.substring(0, 16)}...</div>
                            )}
                            {debugInfo.dTag && (
                              <div><strong>D-Tag:</strong> {debugInfo.dTag}</div>
                            )}
                            {debugInfo.decodedSize && (
                              <div><strong>Size:</strong> {debugInfo.decodedSize} bytes</div>
                            )}
                            {debugInfo.phaseTimes && Object.keys(debugInfo.phaseTimes).length > 0 && (
                              <div className="mt-2">
                                <div><strong>Timings:</strong></div>
                                {Object.entries(debugInfo.phaseTimes).map(([phase, time]) => {
                                  const elapsed = time - (debugInfo.startTime || time);
                                  return <div key={phase} className="ml-2">  {phase}: +{elapsed}ms</div>;
                                })}
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-800 mt-4">
                      <a
                        href="https://soapbox.pub/mkstack"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-purple-400 transition-colors"
                      >
                        Vibed with MKStack
                      </a>
                    </div>
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