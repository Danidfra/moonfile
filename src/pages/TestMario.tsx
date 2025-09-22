import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
// TODO: Replace with new emulator core imports
// import { UniversalWasmCore } from '@/emulator/cores/wasmAdapter';
import { NesPlayer, setFrameDebugLogging } from '@/emulator/NesPlayer';
// import { NesCore, FrameSpec } from '@/emulator/NesCore';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warning';
  message: string;
}

// TODO: Replace with new emulator core adapter
/*
class WasmCoreAdapter implements NesCore {
  constructor(private wasmCore: UniversalWasmCore) {}

  async init(): Promise<boolean> {
    return this.wasmCore.init();
  }

  async loadRom(rom: Uint8Array): Promise<boolean> {
    return this.wasmCore.loadRom(rom);
  }

  frame(): void {
    this.wasmCore.frame();
  }

  reset(): void {
    this.wasmCore.reset();
  }

  setButton(index: number, pressed: boolean): void {
    this.wasmCore.setButton(index, pressed);
  }

  setRunning(running: boolean): void {
    this.wasmCore.setRunning(running);
  }

  getFrameBuffer(): Uint8Array {
    return this.wasmCore.getFrameBuffer();
  }

  getFrameSpec(): FrameSpec {
    return this.wasmCore.getFrameSpec();
  }

  getPalette(): Uint8Array | null {
    return this.wasmCore.getPalette();
  }
}
*/

export default function TestMario() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // TODO: Replace with new emulator core type
  const [wasmCore, _setWasmCore] = useState<unknown | null>(null);
  const [nesPlayer, _setNesPlayer] = useState<NesPlayer | null>(null);
  const [romLoaded, setRomLoaded] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [debugMode, setDebugMode] = useState(true);

  const addLog = useCallback((level: 'info' | 'error' | 'warning', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, level, message }]);
    console.log(`[TestMario ${level.toUpperCase()}]`, message);
  }, []);

  // TODO: Update to work with new emulator core
  const logFrameBufferDebug = useCallback((wasmCore: unknown) => {
    if (!debugMode) return;

    try {
      addLog('info', '🔍 Running frame buffer debug analysis...');

      // Get frame buffer directly
      // TODO: Replace with new emulator core methods
      const frameBuffer = (wasmCore as any).getFrameBuffer();
      const frameSpec = (wasmCore as any).getFrameSpec();

      addLog('info', `Frame buffer size: ${frameBuffer.length} bytes`);
      addLog('info', `Frame spec: ${frameSpec.width}x${frameSpec.height}, format: ${frameSpec.format}`);

      // Log first 16 bytes
      const preview = Array.from(frameBuffer.slice(0, 16)).map((b: number) => b.toString(16).padStart(2, '0')).join(' ');
      addLog('info', `First 16 bytes (hex): ${preview}`);

      // Check for patterns
      const allSame = frameBuffer.every(b => b === frameBuffer[0]);
      const allZero = frameBuffer.every(b => b === 0);
      const allMax = frameBuffer.every(b => b === 255);

      addLog('info', `Pattern analysis: allSame=${allSame}, allZero=${allZero}, allMax=${allMax}`);

      // Sample some pixels
      const samplePixels = [
        { name: 'Top-left', idx: 0 },
        { name: 'Center', idx: ((120 * 256) + 128) * 4 },
        { name: 'Bottom-right', idx: ((239 * 256) + 255) * 4 }
      ];

      samplePixels.forEach(sample => {
        if (sample.idx + 3 < frameBuffer.length) {
          const r = frameBuffer[sample.idx];
          const g = frameBuffer[sample.idx + 1];
          const b = frameBuffer[sample.idx + 2];
          const a = frameBuffer[sample.idx + 3];
          addLog('info', `${sample.name}: RGBA(${r},${g},${b},${a})`);
        }
      });

    } catch (error) {
      addLog('error', `Frame buffer debug failed: ${error}`);
    }
  }, [debugMode, addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // TODO: Replace with new emulator core loading
  const loadWasmCore = useCallback(async () => {
    try {
      addLog('info', 'Loading WASM core...');
      // TODO: Replace UniversalWasmCore.load with new emulator core loading
      /*
      const core = await UniversalWasmCore.load('/wasm/fceux.wasm');

      addLog('info', 'Initializing WASM core...');
      const initResult = await core.init();

      if (!initResult) {
        throw new Error('WASM core initialization failed');
      }

      setWasmCore(core);
      addLog('info', '✅ WASM core loaded and initialized successfully');
      return core;
      */

      throw new Error('FCEUX emulator core has been removed. Please integrate new emulator core.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `❌ Failed to load WASM core: ${errorMessage}`);
      throw error;
    }
  }, [addLog]);

  // TODO: Update to work with new emulator core
  const loadRom = useCallback(async (core: unknown) => {
    try {
      addLog('info', 'Loading Super Mario Bros ROM...');

      const response = await fetch('/roms/Super_mario_brothers.nes');
      if (!response.ok) {
        throw new Error(`Failed to fetch ROM: ${response.status} ${response.statusText}`);
      }

      const romData = await response.arrayBuffer();
      const romBytes = new Uint8Array(romData);

      addLog('info', `ROM loaded: ${romBytes.length} bytes`);

      // Validate NES header
      if (romBytes.length < 16) {
        throw new Error('ROM file too small (missing header)');
      }

      const header = romBytes.slice(0, 4);
      if (header[0] !== 0x4E || header[1] !== 0x45 || header[2] !== 0x53 || header[3] !== 0x1A) {
        throw new Error('Invalid NES ROM header');
      }

      addLog('info', '✅ ROM header validation passed');

      // Load ROM into emulator
      // TODO: Replace with new emulator core loadRom method
      const loadResult = await (core as any).loadRom(romBytes);
      if (!loadResult) {
        throw new Error('Failed to load ROM into emulator');
      }

      setRomLoaded(true);
      addLog('info', '✅ ROM loaded into emulator successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `❌ Failed to load ROM: ${errorMessage}`);
      throw error;
    }
  }, [addLog]);

  // Initialize everything
  const initialize = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    clearLogs();

    try {
      // Load WASM core
      const core = await loadWasmCore();

      // Load ROM
      await loadRom(core);

      // TODO: Setup player with new emulator core
      /*
      if (canvasRef.current && core) {
        addLog('info', 'Setting up NES player...');

        const coreAdapter = new WasmCoreAdapter(core);
        const player = new NesPlayer(coreAdapter, canvasRef.current);
        setNesPlayer(player);

        addLog('info', '✅ NES player setup complete');
      }
      */

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `❌ Initialization failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, loadWasmCore, loadRom, clearLogs, addLog]);

  // Play/Pause controls
  const togglePlay = useCallback(() => {
    if (!nesPlayer) {
      addLog('error', 'NES player not initialized');
      return;
    }

    if (isPlaying) {
      nesPlayer.pause();
      setIsPlaying(false);
      addLog('info', 'Game paused');
    } else {
      nesPlayer.play();
      setIsPlaying(true);
      addLog('info', 'Game started');

      // Debug frame buffer after starting
      if (debugMode && wasmCore) {
        setTimeout(() => logFrameBufferDebug(wasmCore), 100);
      }
    }
  }, [nesPlayer, isPlaying, addLog, debugMode, wasmCore, logFrameBufferDebug]);

  const resetGame = useCallback(() => {
    if (!wasmCore) {
      addLog('error', 'WASM core not loaded');
      return;
    }

    // TODO: Replace with new emulator core reset method
    // wasmCore.reset();
    addLog('info', 'Game reset');
  }, [wasmCore, addLog]);

  const testCanvas = useCallback(() => {
    if (!canvasRef.current) {
      addLog('error', 'Canvas not available');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      addLog('error', 'Cannot get 2D context');
      return;
    }

    addLog('info', '🎨 Testing canvas with color pattern...');

    // Create a test pattern
    const width = 256;
    const height = 240;
    const testData = new Uint8ClampedArray(width * height * 4);

    // Fill with a rainbow gradient pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        testData[idx + 0] = (x * 255) / width;     // Red gradient
        testData[idx + 1] = (y * 255) / height;   // Green gradient
        testData[idx + 2] = 128;                   // Blue constant
        testData[idx + 3] = 255;                   // Alpha opaque
      }
    }

    const testImageData = new ImageData(testData, width, height);
    ctx.putImageData(testImageData, 0, 0);

    addLog('info', '✅ Test pattern drawn to canvas');
  }, [addLog]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!wasmCore || pressedKeys.has(event.code)) return;

      const keyMap: Record<string, number> = {
        'ArrowRight': 0,  // Right
        'ArrowLeft': 1,   // Left
        'ArrowDown': 2,   // Down
        'ArrowUp': 3,     // Up
        'Enter': 4,       // Start
        'Space': 5,       // Select
        'KeyZ': 6,        // B
        'KeyX': 7,        // A
      };

      const buttonIndex = keyMap[event.code];
      if (buttonIndex !== undefined) {
        event.preventDefault();
        // TODO: Replace with new emulator core setButton method
        // wasmCore.setButton(buttonIndex, true);
        setPressedKeys(prev => new Set([...prev, event.code]));
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!wasmCore || !pressedKeys.has(event.code)) return;

      const keyMap: Record<string, number> = {
        'ArrowRight': 0,  // Right
        'ArrowLeft': 1,   // Left
        'ArrowDown': 2,   // Down
        'ArrowUp': 3,     // Up
        'Enter': 4,       // Start
        'Space': 5,       // Select
        'KeyZ': 6,        // B
        'KeyX': 7,        // A
      };

      const buttonIndex = keyMap[event.code];
      if (buttonIndex !== undefined) {
        event.preventDefault();
        // TODO: Replace with new emulator core setButton method
        // wasmCore.setButton(buttonIndex, false);
        setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(event.code);
          return newSet;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [wasmCore, pressedKeys]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nesPlayer) {
        nesPlayer.dispose();
      }
    };
  }, [nesPlayer]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Super Mario Bros Test</h1>
        <p className="text-muted-foreground">
          Direct ROM loading test for the FCEUX WebAssembly emulator core
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game Display */}
        <Card>
          <CardHeader>
            <CardTitle>Game Display</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={256}
                height={240}
                className="border border-border bg-black"
                style={{
                  imageRendering: 'pixelated',
                  width: '512px',
                  height: '480px'
                }}
              />
            </div>

            <div className="flex gap-2 justify-center flex-wrap">
              <Button
                onClick={initialize}
                disabled={isLoading}
                variant="default"
              >
                {isLoading ? 'Loading...' : 'Initialize'}
              </Button>

              <Button
                onClick={togglePlay}
                disabled={!romLoaded}
                variant={isPlaying ? "destructive" : "default"}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </Button>

              <Button
                onClick={resetGame}
                disabled={!wasmCore}
                variant="outline"
              >
                Reset
              </Button>

              <Button
                onClick={() => wasmCore && logFrameBufferDebug(wasmCore)}
                disabled={!wasmCore}
                variant="secondary"
                size="sm"
              >
                Debug Frame
              </Button>

              <Button
                onClick={testCanvas}
                variant="secondary"
                size="sm"
              >
                Test Canvas
              </Button>

              <Button
                onClick={() => {
                  const newDebugMode = !debugMode;
                  setDebugMode(newDebugMode);
                  setFrameDebugLogging(newDebugMode);
                  addLog('info', `Debug mode ${newDebugMode ? 'enabled' : 'disabled'}`);
                }}
                variant={debugMode ? "default" : "outline"}
                size="sm"
              >
                Debug: {debugMode ? 'ON' : 'OFF'}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Controls:</strong></p>
              <p>Arrow Keys: D-Pad | Enter: Start | Space: Select</p>
              <p>Z: B Button | X: A Button</p>

              {canvasRef.current && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p><strong>Canvas Info:</strong></p>
                  <p>Size: {canvasRef.current.width}×{canvasRef.current.height} (logical)</p>
                  <p>Display: {canvasRef.current.clientWidth}×{canvasRef.current.clientHeight} (CSS)</p>
                  <p>Debug Mode: {debugMode ? '🟢 Enabled' : '🔴 Disabled'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status and Logs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Status & Logs</CardTitle>
            <Button onClick={clearLogs} variant="outline" size="sm">
              Clear Logs
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">WASM Core:</span>
                <span className={`ml-2 ${wasmCore ? 'text-green-600' : 'text-red-600'}`}>
                  {wasmCore ? '✅ Loaded' : '❌ Not loaded'}
                </span>
              </div>
              <div>
                <span className="font-medium">ROM:</span>
                <span className={`ml-2 ${romLoaded ? 'text-green-600' : 'text-red-600'}`}>
                  {romLoaded ? '✅ Loaded' : '❌ Not loaded'}
                </span>
              </div>
              <div>
                <span className="font-medium">Player:</span>
                <span className={`ml-2 ${nesPlayer ? 'text-green-600' : 'text-red-600'}`}>
                  {nesPlayer ? '✅ Ready' : '❌ Not ready'}
                </span>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <span className={`ml-2 ${isPlaying ? 'text-green-600' : 'text-yellow-600'}`}>
                  {isPlaying ? '▶️ Playing' : '⏸️ Paused'}
                </span>
              </div>
            </div>

            <Separator />

            {/* Logs */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No logs yet. Click Initialize to start.</p>
              ) : (
                logs.map((log, index) => (
                  <Alert key={index} className={`py-2 ${
                    log.level === 'error' ? 'border-red-200 bg-red-50' :
                    log.level === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                    'border-green-200 bg-green-50'
                  }`}>
                    <AlertDescription className="text-xs">
                      <span className="font-mono text-muted-foreground">{log.timestamp}</span>
                      <span className="ml-2">{log.message}</span>
                    </AlertDescription>
                  </Alert>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROM Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Test Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">ROM Details</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• File: /public/roms/Super_mario_brothers.nes</li>
                <li>• Expected size: ~40KB</li>
                <li>• Mapper: NROM (0)</li>
                <li>• Format: iNES</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Emulator Core</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Core: FCEUX WebAssembly</li>
                <li>• Format: Standalone WASM</li>
                <li>• Size: ~1.6KB (WAT-compiled)</li>
                <li>• Imports: Zero (standalone)</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-2">Test Purpose</h4>
            <p className="text-sm text-muted-foreground">
              This page tests the WebAssembly NES emulator core by directly loading the Super Mario Bros ROM
              without any dependencies on Nostr events or game metadata. It verifies that the WASM core can
              properly load, initialize, and run a classic NES game with full input handling and frame rendering.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}