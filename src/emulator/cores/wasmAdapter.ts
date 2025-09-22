/**
 * Universal WASM Adapter
 * 
 * Handles loading both WAT-compiled and Emscripten C-compiled WASM files
 * 
 * TODO: Remove this file - replaced by new emulator core integration
 */

// COMMENTED OUT - WASM adapter removed
/*
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

export async function loadUniversalWasm(wasmUrl: string): Promise<{ instance: WebAssembly.Instance; exports: WasmCoreExports }> {
  console.log('[WasmAdapter] Loading WASM from:', wasmUrl);
  const cacheBuster = `v=${Date.now()}`;
  const urlWithCacheBuster = wasmUrl + (wasmUrl.includes('?') ? '&' : '?') + cacheBuster;
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
  if (wasmBytes.byteLength < 500) {
    throw new Error(`WASM file too small: ${wasmBytes.byteLength} bytes`);
  }
  const magic = new Uint8Array(wasmBytes.slice(0, 4));
  if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6D) {
    throw new Error('Invalid WASM magic bytes');
  }
  let instance: WebAssembly.Instance;
  try {
    console.log('[WasmAdapter] Trying simple imports...');
    instance = await trySimpleImports(wasmBytes);
    console.log('[WasmAdapter] ✅ Loaded with simple imports (WAT-style)');
  } catch (error) {
    console.log('[WasmAdapter] Simple imports failed, trying Emscripten imports...');
    try {
      instance = await tryEmscriptenImports(wasmBytes);
      console.log('[WasmAdapter] ✅ Loaded with Emscripten imports (C-style)');
    } catch (emscriptenError) {
      console.error('[WasmAdapter] Both import styles failed');
      console.error('Simple imports error:', error);
      console.error('Emscripten imports error:', emscriptenError);
      throw new Error('Failed to load WASM with any import style');
    }
  }
  const exports = instance.exports as any;
  const requiredExports = ['loadRom', 'frame', 'getFrameBuffer'];
  const missingExports = requiredExports.filter(name => typeof exports[name] !== 'function');
  if (missingExports.length > 0) {
    throw new Error(`WASM missing required exports: ${missingExports.join(', ')}`);
  }
  const exportNames = Object.keys(exports).filter(k => typeof exports[k] === 'function');
  console.log('[WasmAdapter] Available exports:', exportNames);
  return { instance, exports: exports as WasmCoreExports };
}

async function trySimpleImports(wasmBytes: ArrayBuffer): Promise<WebAssembly.Instance> {
  const memory = new WebAssembly.Memory({ initial: 1024, maximum: 1024 });
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

async function tryEmscriptenImports(wasmBytes: ArrayBuffer): Promise<WebAssembly.Instance> {
  const memory = new WebAssembly.Memory({ initial: 1024, maximum: 1024 });
  const imports = {
    a: {
      a: memory,
      b: (msg: number) => console.error('[WASM] Abort:', msg),
      c: () => { throw new Error('WASM assert failed'); },
      d: (ptr: number) => console.log('[WASM]', ptr),
      e: () => Date.now(),
      f: (callback: number) => {
        console.log('[WASM] Main loop callback:', callback);
      },
      g: (size: number) => 0,
      h: () => 0,
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
    const memoryArray = new Uint8Array(this.memory.buffer);
    const romOffset = 1024 * 1024;
    if (romOffset + rom.length > this.memory.buffer.byteLength) {
      throw new Error('ROM too large for WASM memory');
    }
    memoryArray.set(rom, romOffset);
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
      return memoryArray.slice(ptr, ptr + 64 * 4);
    }
    return null;
  }
}
*/

// TODO: Implement new emulator core WASM loading