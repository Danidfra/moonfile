import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { UniversalWasmCore } from '@/emulator/cores/wasmAdapter';
import { NesPlayer } from '@/emulator/NesPlayer';
import { NesCore, FrameSpec } from '@/emulator/NesCore';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warning';
  message: string;
}

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

export default function TestMario() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wasmCore, setWasmCore] = useState<UniversalWasmCore | null>(null);
  const [nesPlayer, setNesPlayer] = useState<NesPlayer | null>(null);
  const [romLoaded, setRomLoaded] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  const addLog = useCallback((level: 'info' | 'error' | 'warning', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, level, message }]);
    console.log(`[TestMario ${level.toUpperCase()}]`, message);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Load WASM core
  const loadWasmCore = useCallback(async () => {
    try {
      addLog('info', 'Loading WASM core...');
      const core = await UniversalWasmCore.load('/wasm/fceux.wasm');
      
      addLog('info', 'Initializing WASM core...');
      const initResult = await core.init();
      
      if (!initResult) {
        throw new Error('WASM core initialization failed');
      }

      setWasmCore(core);
      addLog('info', '✅ WASM core loaded and initialized successfully');
      return core;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `❌ Failed to load WASM core: ${errorMessage}`);
      throw error;
    }
  }, [addLog]);

  // Load ROM file
  const loadRom = useCallback(async (core: UniversalWasmCore) => {
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
      const loadResult = await core.loadRom(romBytes);
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
      
      // Setup player if canvas is available
      if (canvasRef.current && core) {
        addLog('info', 'Setting up NES player...');
        
        const coreAdapter = new WasmCoreAdapter(core);
        const player = new NesPlayer(coreAdapter, canvasRef.current);
        setNesPlayer(player);
        
        addLog('info', '✅ NES player setup complete');
      }

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
    }
  }, [nesPlayer, isPlaying, addLog]);

  const resetGame = useCallback(() => {
    if (!wasmCore) {
      addLog('error', 'WASM core not loaded');
      return;
    }

    wasmCore.reset();
    addLog('info', 'Game reset');
  }, [wasmCore, addLog]);

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
        wasmCore.setButton(buttonIndex, true);
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
        wasmCore.setButton(buttonIndex, false);
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
            
            <div className="flex gap-2 justify-center">
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
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Controls:</strong></p>
              <p>Arrow Keys: D-Pad | Enter: Start | Space: Select</p>
              <p>Z: B Button | X: A Button</p>
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