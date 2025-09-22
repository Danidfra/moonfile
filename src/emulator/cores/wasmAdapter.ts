/**
 * Universal WASM Adapter
 * 
 * Handles loading both WAT-compiled and Emscripten C-compiled WASM files
 */

export interface WasmCoreExports {
  memory: WebAssembly.Memory;
  init?: () => number;
  loadRom: (romPtr: number, romSize: number) => number;
  frame: () => void;
  reset: () => void;
  setButton: (button: number, pressed: number) => void;
  setRunning: (running: number) => void;
  getFrameBuffer: () => number;
  getFrameBufferSize?: () => number;
  getPalette?: () => number;
  getAudioBuffer?: () => number;
}

/**
 * Load WASM with automatic import detection
 */
export async function loadUniversalWasm(wasmUrl: string): Promise<{ instance: WebAssembly.Instance; exports: WasmCoreExports }> {
  console.log('[WasmAdapter] Loading WASM from:', wasmUrl);

  // Add cache buster
  const cacheBuster = `v=${Date.now()}`;
  const urlWithCacheBuster = wasmUrl + (wasmUrl.includes('?') ? '&' : '?') + cacheBuster;

  // Fetch WASM file
  const response = await fetch(urlWithCacheBuster, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
  }

  const wasmBytes = await response.arrayBuffer();
  console.log('[WasmAdapter] WASM fetched, size:', wasmBytes.byteLength, 'bytes');

  // Validate WASM file
  if (wasmBytes.byteLength < 500) {
    throw new Error(`WASM file too small: ${wasmBytes.byteLength} bytes`);
  }

  // Check magic bytes
  const magic = new Uint8Array(wasmBytes.slice(0, 4));
  if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6D) {
    throw new Error('Invalid WASM magic bytes');
  }

  // Try to determine what imports are needed by inspecting the WASM
  let instance: WebAssembly.Instance;
  
  try {
    // First try with simple imports (for WAT-compiled WASM)
    console.log('[WasmAdapter] Trying simple imports...');
    instance = await trySimpleImports(wasmBytes);
    console.log('[WasmAdapter] ✅ Loaded with simple imports (WAT-style)');
  } catch (error) {
    console.log('[WasmAdapter] Simple imports failed, trying Emscripten imports...');
    
    try {
      // Try with Emscripten-style imports (for C-compiled WASM)
      instance = await tryEmscriptenImports(wasmBytes);
      console.log('[WasmAdapter] ✅ Loaded with Emscripten imports (C-style)');
    } catch (emscriptenError) {
      console.error('[WasmAdapter] Both import styles failed');
      console.error('Simple imports error:', error);
      console.error('Emscripten imports error:', emscriptenError);
      throw new Error('Failed to load WASM with any import style');
    }
  }

  // Validate exports
  const exports = instance.exports as any;
  const requiredExports = ['loadRom', 'frame', 'getFrameBuffer'];
  const missingExports = requiredExports.filter(name => typeof exports[name] !== 'function');

  if (missingExports.length > 0) {
    throw new Error(`WASM missing required exports: ${missingExports.join(', ')}`);
  }

  // Log available exports
  const exportNames = Object.keys(exports).filter(k => typeof exports[k] === 'function');
  console.log('[WasmAdapter] Available exports:', exportNames);

  return { instance, exports: exports as WasmCoreExports };
}

/**
 * Try loading with simple imports (for WAT-compiled WASM)
 */
async function trySimpleImports(wasmBytes: ArrayBuffer): Promise<WebAssembly.Instance> {
  const memory = new WebAssembly.Memory({ initial: 1024, maximum: 1024 }); // 64MB
  
  const imports = {
    env: {
      memory,
      abort: (msg: number, file: number, line: number, column: number) => {
        console.error('[WASM] Abort:', { msg, file, line, column });
      }
    }
  };

  const wasmModule = await WebAssembly.compile(wasmBytes);
  return await WebAssembly.instantiate(wasmModule, imports);
}

/**
 * Try loading with Emscripten imports (for C-compiled WASM)
 */
async function tryEmscriptenImports(wasmBytes: ArrayBuffer): Promise<WebAssembly.Instance> {
  const memory = new WebAssembly.Memory({ initial: 1024, maximum: 1024 }); // 64MB
  
  const imports = {
    a: {
      a: memory, // Emscripten memory import
      b: (msg: number) => console.error('[WASM] Abort:', msg), // abort
      c: () => { throw new Error('WASM assert failed'); }, // assert
      d: (ptr: number) => console.log('[WASM]', ptr), // console.log
      e: () => Date.now(), // emscripten_get_now
      f: (callback: number) => { // emscripten_set_main_loop
        console.log('[WASM] Main loop callback:', callback);
      },
      g: (size: number) => 0, // sbrk
      h: () => 0, // memory.grow
    },
    env: {
      memory,
      __memory_base: 1024,
      __table_base: 0,
      abort: (msg: number) => console.error('[WASM] Abort:', msg),
      abortOnCannotGrowMemory: () => { throw new Error('Cannot grow memory'); },
      _abort: () => { throw new Error('WASM abort'); },
      _emscripten_get_now: () => Date.now(),
      _emscripten_memcpy_big: (dest: number, src: number, size: number) => {
        const memArray = new Uint8Array(memory.buffer);
        memArray.copyWithin(dest, src, src + size);
      },
      _emscripten_resize_heap: () => false,
      _exit: (code: number) => console.log('[WASM] Exit:', code),
      _time: () => Math.floor(Date.now() / 1000),
      // Math functions
      _sin: Math.sin,
      _cos: Math.cos,
      _exp: Math.exp,
      _log: Math.log,
      _sqrt: Math.sqrt,
      _floor: Math.floor,
      _ceil: Math.ceil,
      _pow: Math.pow,
      _fmod: (x: number, y: number) => x % y,
    }
  };

  const wasmModule = await WebAssembly.compile(wasmBytes);
  return await WebAssembly.instantiate(wasmModule, imports);
}

/**
 * Create a WASM core wrapper that handles both import styles
 */
export class UniversalWasmCore {
  private instance: WebAssembly.Instance;
  private exports: WasmCoreExports;
  private memory: WebAssembly.Memory;

  constructor(instance: WebAssembly.Instance, exports: WasmCoreExports) {
    this.instance = instance;
    this.exports = exports;
    this.memory = exports.memory;
  }

  static async load(wasmUrl: string): Promise<UniversalWasmCore> {
    const { instance, exports } = await loadUniversalWasm(wasmUrl);
    return new UniversalWasmCore(instance, exports);
  }

  async init(): Promise<boolean> {
    if (this.exports.init) {
      const result = this.exports.init();
      return result !== 0;
    }
    return true;
  }

  async loadRom(rom: Uint8Array): Promise<boolean> {
    // Copy ROM to WASM memory
    const memoryArray = new Uint8Array(this.memory.buffer);
    const romOffset = 1024 * 1024; // 1MB offset
    
    if (romOffset + rom.length > this.memory.buffer.byteLength) {
      throw new Error('ROM too large for WASM memory');
    }

    memoryArray.set(rom, romOffset);
    
    // Call loadRom with pointer and size
    const result = this.exports.loadRom(romOffset, rom.length);
    return result !== 0;
  }

  frame(): void {
    this.exports.frame();
  }

  reset(): void {
    this.exports.reset();
  }

  setButton(button: number, pressed: boolean): void {
    this.exports.setButton(button, pressed ? 1 : 0);
  }

  setRunning(running: boolean): void {
    this.exports.setRunning(running ? 1 : 0);
  }

  getFrameBuffer(): Uint8Array {
    const ptr = this.exports.getFrameBuffer();
    const size = this.exports.getFrameBufferSize ? this.exports.getFrameBufferSize() : 256 * 240 * 4;
    
    const memoryArray = new Uint8Array(this.memory.buffer);
    return memoryArray.slice(ptr, ptr + size);
  }

  getFrameSpec() {
    return { width: 256, height: 240, format: 'RGBA32' as const };
  }

  getPalette(): Uint8Array | null {
    if (this.exports.getPalette) {
      const ptr = this.exports.getPalette();
      const memoryArray = new Uint8Array(this.memory.buffer);
      return memoryArray.slice(ptr, ptr + 64 * 4); // 64 RGBA colors
    }
    return null;
  }
}