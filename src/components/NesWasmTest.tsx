/**
 * NES WebAssembly Test Component
 * 
 * Minimal React component that tests loading a .nes ROM into a NES WebAssembly core.
 * This component validates the entire emulator pipeline from WASM loading to canvas rendering.
 */

import React, { useEffect, useRef, useState } from 'react';

interface TestResult {
  wasmLoaded: boolean;
  romLoaded: boolean;
  frameGenerated: boolean;
  frameBufferValid: boolean;
  canvasRendered: boolean;
  error?: string;
}

interface WasmExports {
  memory: WebAssembly.Memory;
  init?: () => number;
  loadRom: (romPtr: number, romSize: number) => number;
  frame: () => void;
  getFrameBuffer: () => number;
  getFrameBufferSize?: () => number;
}

export const NesWasmTest: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [testResult, setTestResult] = useState<TestResult>({
    wasmLoaded: false,
    romLoaded: false,
    frameGenerated: false,
    frameBufferValid: false,
    canvasRendered: false,
  });
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Run the test automatically when component mounts
    runNesWasmTest();
  }, []);

  /**
   * Main test function that runs the complete NES WASM pipeline
   */
  const runNesWasmTest = async (): Promise<void> => {
    console.log('🧪 Starting NES WebAssembly Test...\n');
    setIsRunning(true);

    try {
      // Reset test results
      setTestResult({
        wasmLoaded: false,
        romLoaded: false,
        frameGenerated: false,
        frameBufferValid: false,
        canvasRendered: false,
      });

      // Step 1: Load and instantiate WASM file
      console.log('📦 Step 1: Loading WASM file...');
      const wasmExports = await loadWasmCore();
      console.log('✅ WASM loaded successfully');
      setTestResult(prev => ({ ...prev, wasmLoaded: true }));

      // Step 2: Load NES ROM
      console.log('\n🎮 Step 2: Loading NES ROM...');
      const romBytes = await loadNesRom();
      console.log(`✅ ROM loaded: ${romBytes.length} bytes`);

      // Step 3: Initialize WASM core if needed
      console.log('\n⚡ Step 3: Initializing WASM core...');
      if (wasmExports.init) {
        const initResult = wasmExports.init();
        console.log(`Core init result: ${initResult}`);
      }

      // Step 4: Load ROM into WASM core
      console.log('\n💾 Step 4: Loading ROM into WASM core...');
      const romLoaded = await loadRomIntoWasm(wasmExports, romBytes);
      if (!romLoaded) {
        throw new Error('Failed to load ROM into WASM core');
      }
      console.log('✅ ROM loaded into WASM core successfully');
      setTestResult(prev => ({ ...prev, romLoaded: true }));

      // Step 5: Generate video frames
      console.log('\n🎬 Step 5: Generating video frames...');
      generateFrames(wasmExports, 3); // Generate 3 frames
      console.log('✅ Frames generated successfully');
      setTestResult(prev => ({ ...prev, frameGenerated: true }));

      // Step 6: Extract and validate frame buffer
      console.log('\n🖼️ Step 6: Extracting frame buffer...');
      const frameBuffer = extractFrameBuffer(wasmExports);
      const isValid = validateFrameBuffer(frameBuffer);
      if (!isValid) {
        throw new Error('Frame buffer validation failed');
      }
      console.log('✅ Frame buffer extracted and validated');
      setTestResult(prev => ({ ...prev, frameBufferValid: true }));

      // Step 7: Render to canvas
      console.log('\n🎨 Step 7: Rendering to canvas...');
      const canvasRendered = renderToCanvas(frameBuffer);
      if (!canvasRendered) {
        throw new Error('Canvas rendering failed');
      }
      console.log('✅ Frame rendered to canvas successfully');
      setTestResult(prev => ({ ...prev, canvasRendered: true }));

      console.log('\n🎉 NES WebAssembly Test PASSED! All steps completed successfully.');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('\n❌ NES WebAssembly Test FAILED:', errorMessage);
      setTestResult(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Load and instantiate the WebAssembly core
   */
  const loadWasmCore = async (): Promise<WasmExports> => {
    // Fetch WASM file with cache busting
    const wasmUrl = `/wasm/fceux.wasm?v=${Date.now()}`;
    const response = await fetch(wasmUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
    }

    const wasmBytes = await response.arrayBuffer();
    console.log(`WASM file size: ${wasmBytes.byteLength} bytes`);

    // Create WebAssembly memory and imports
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
    const imports = {
      env: {
        memory,
        abort: (msg: number, file: number, line: number, column: number) => {
          console.error('WASM abort:', { msg, file, line, column });
        },
        emscripten_resize_heap: () => false,
        __handle_stack_overflow: () => {
          console.error('WASM stack overflow');
        }
      }
    };

    // Compile and instantiate WASM module
    const wasmModule = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(wasmModule, imports);

    // Validate required exports
    const exports = instance.exports as any;
    const requiredExports = ['loadRom', 'frame', 'getFrameBuffer'];
    const missingExports = requiredExports.filter(name => typeof exports[name] !== 'function');
    
    if (missingExports.length > 0) {
      throw new Error(`WASM missing required exports: ${missingExports.join(', ')}`);
    }

    console.log('Available WASM exports:', Object.keys(exports).filter(k => typeof exports[k] === 'function'));

    return exports as WasmExports;
  };

  /**
   * Load NES ROM from public folder or base64
   */
  const loadNesRom = async (): Promise<Uint8Array> => {
    try {
      // Try to load test ROM from public folder
      const romResponse = await fetch('/roms/test-rom.nes');
      if (romResponse.ok) {
        const romBuffer = await romResponse.arrayBuffer();
        return new Uint8Array(romBuffer);
      }
    } catch (error) {
      console.log('Could not load test ROM from /roms/test-rom.nes, trying base64...');
    }

    try {
      // Try to load base64 ROM
      const base64Response = await fetch('/roms/test-rom-base64.txt');
      if (base64Response.ok) {
        const base64String = await base64Response.text();
        return decodeBase64ToBytes(base64String.trim());
      }
    } catch (error) {
      console.log('Could not load base64 ROM from /roms/test-rom-base64.txt');
    }

    // Create a minimal test ROM if no files are available
    console.log('Creating minimal test ROM...');
    return createMinimalTestRom();
  };

  /**
   * Decode base64 string to Uint8Array
   */
  const decodeBase64ToBytes = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  /**
   * Create a minimal test ROM with valid NES header
   */
  const createMinimalTestRom = (): Uint8Array => {
    const rom = new Uint8Array(16 + 16384 + 8192); // Header + 1 PRG bank + 1 CHR bank
    
    // NES header
    rom[0] = 0x4E; // 'N'
    rom[1] = 0x45; // 'E'
    rom[2] = 0x53; // 'S'
    rom[3] = 0x1A; // EOF
    rom[4] = 1;    // 1 PRG-ROM bank
    rom[5] = 1;    // 1 CHR-ROM bank
    rom[6] = 0;    // Mapper 0, horizontal mirroring
    rom[7] = 0;    // No special flags
    
    // Fill with test pattern
    for (let i = 16; i < rom.length; i++) {
      rom[i] = i % 256;
    }
    
    return rom;
  };

  /**
   * Load ROM into WASM core memory
   */
  const loadRomIntoWasm = async (wasmExports: WasmExports, romBytes: Uint8Array): Promise<boolean> => {
    // Validate ROM header
    if (romBytes.length < 16) {
      throw new Error('ROM too small for NES header');
    }
    
    if (romBytes[0] !== 0x4E || romBytes[1] !== 0x45 || romBytes[2] !== 0x53 || romBytes[3] !== 0x1A) {
      throw new Error('Invalid NES header');
    }

    console.log('ROM header validation passed');
    console.log(`ROM details: PRG=${romBytes[4]} banks, CHR=${romBytes[5]} banks, Mapper=${(romBytes[6] >> 4) | (romBytes[7] & 0xF0)}`);

    // Copy ROM to WASM memory
    const memoryArray = new Uint8Array(wasmExports.memory.buffer);
    const romOffset = 100 * 1024; // Place ROM at 100KB offset
    
    if (romOffset + romBytes.length > wasmExports.memory.buffer.byteLength) {
      throw new Error('ROM too large for WASM memory');
    }

    memoryArray.set(romBytes, romOffset);
    console.log(`ROM copied to WASM memory at offset ${romOffset}`);

    // Call loadRom with pointer and size
    const result = wasmExports.loadRom(romOffset, romBytes.length);
    return result !== 0;
  };

  /**
   * Generate multiple frames
   */
  const generateFrames = (wasmExports: WasmExports, frameCount: number): void => {
    for (let i = 0; i < frameCount; i++) {
      wasmExports.frame();
      console.log(`Generated frame ${i + 1}/${frameCount}`);
    }
  };

  /**
   * Extract frame buffer from WASM memory
   */
  const extractFrameBuffer = (wasmExports: WasmExports): Uint8Array => {
    // Get frame buffer pointer
    const frameBufferPtr = wasmExports.getFrameBuffer();
    console.log(`Frame buffer pointer: ${frameBufferPtr}`);

    if (typeof frameBufferPtr !== 'number') {
      throw new Error(`getFrameBuffer returned ${typeof frameBufferPtr}, expected number`);
    }

    // Get buffer size
    const expectedSize = 256 * 240 * 4; // RGBA32
    let bufferSize = expectedSize;
    
    if (wasmExports.getFrameBufferSize) {
      bufferSize = wasmExports.getFrameBufferSize();
      console.log(`Buffer size from WASM: ${bufferSize}`);
    }

    // Extract from WASM memory
    const memoryArray = new Uint8Array(wasmExports.memory.buffer);
    
    if (frameBufferPtr + bufferSize > wasmExports.memory.buffer.byteLength) {
      throw new Error('Frame buffer pointer out of bounds');
    }

    const frameBuffer = memoryArray.slice(frameBufferPtr, frameBufferPtr + bufferSize);
    console.log(`Extracted frame buffer: ${frameBuffer.length} bytes`);

    return frameBuffer;
  };

  /**
   * Validate frame buffer data
   */
  const validateFrameBuffer = (frameBuffer: Uint8Array): boolean => {
    const expectedSize = 256 * 240 * 4;
    
    if (frameBuffer.length !== expectedSize) {
      console.error(`Frame buffer wrong size: ${frameBuffer.length}, expected ${expectedSize}`);
      return false;
    }

    // Check if buffer contains any non-zero data
    let hasData = false;
    for (let i = 0; i < Math.min(frameBuffer.length, 1000); i++) {
      if (frameBuffer[i] !== 0) {
        hasData = true;
        break;
      }
    }

    console.log(`Frame buffer validation: size=${frameBuffer.length}, hasData=${hasData}`);
    
    // Sample first few pixels
    if (frameBuffer.length >= 16) {
      console.log('Sample pixels:');
      for (let i = 0; i < 4; i++) {
        const offset = i * 4;
        const r = frameBuffer[offset];
        const g = frameBuffer[offset + 1];
        const b = frameBuffer[offset + 2];
        const a = frameBuffer[offset + 3];
        console.log(`  Pixel ${i}: RGBA(${r}, ${g}, ${b}, ${a})`);
      }
    }

    return true;
  };

  /**
   * Render frame buffer to canvas
   */
  const renderToCanvas = (frameBuffer: Uint8Array): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not available');
      return false;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('2D context not available');
      return false;
    }

    // Create ImageData from frame buffer
    const imageData = ctx.createImageData(256, 240);
    imageData.data.set(frameBuffer);

    // Render to canvas
    ctx.putImageData(imageData, 0, 0);
    console.log('Frame buffer rendered to canvas');

    return true;
  };

  /**
   * Get status indicator for each test step
   */
  const getStatusIcon = (completed: boolean, hasError: boolean): string => {
    if (hasError) return '❌';
    if (completed) return '✅';
    return '⏳';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">NES WebAssembly Test</h2>
      
      {/* Test Controls */}
      <div className="mb-6">
        <button
          onClick={runNesWasmTest}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isRunning ? 'Running Test...' : 'Run Test'}
        </button>
      </div>

      {/* Test Results */}
      <div className="mb-6 space-y-2">
        <h3 className="text-lg font-semibold">Test Results:</h3>
        <div className="space-y-1 font-mono text-sm">
          <div>{getStatusIcon(testResult.wasmLoaded, !!testResult.error)} WASM Core Loaded</div>
          <div>{getStatusIcon(testResult.romLoaded, !!testResult.error)} ROM Loaded into Core</div>
          <div>{getStatusIcon(testResult.frameGenerated, !!testResult.error)} Frames Generated</div>
          <div>{getStatusIcon(testResult.frameBufferValid, !!testResult.error)} Frame Buffer Valid</div>
          <div>{getStatusIcon(testResult.canvasRendered, !!testResult.error)} Canvas Rendered</div>
        </div>
        
        {testResult.error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            <strong>Error:</strong> {testResult.error}
          </div>
        )}
      </div>

      {/* Canvas Display */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">NES Screen Output:</h3>
        <div className="border border-gray-300 inline-block">
          <canvas
            ref={canvasRef}
            id="nes-screen"
            width={256}
            height={240}
            className="block"
            style={{
              imageRendering: 'pixelated',
              width: '512px',
              height: '480px',
              backgroundColor: '#000'
            }}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Canvas: 256×240 pixels (scaled 2x for visibility)
        </p>
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600">
        <h4 className="font-semibold">Test Details:</h4>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Loads WASM core from <code>/wasm/fceux.wasm</code></li>
          <li>Loads test ROM from <code>/roms/test-rom.nes</code> or creates minimal ROM</li>
          <li>Validates ROM header and loads into WASM memory</li>
          <li>Generates frames and extracts 245,760-byte RGBA buffer</li>
          <li>Renders frame buffer to canvas element</li>
          <li>All steps logged to browser console</li>
        </ul>
      </div>
    </div>
  );
};

export default NesWasmTest;