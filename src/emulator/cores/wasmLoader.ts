/**
 * WebAssembly Loader Utility
 * 
 * Simple, CSP-safe WASM loader for emulator cores.
 */

export interface WasmImports {
  env?: Record<string, any>;
  [namespace: string]: Record<string, any> | undefined;
}

/**
 * Load and instantiate a WebAssembly module
 * @param wasmUrl URL to the WASM file
 * @param imports Import object for the WASM module
 * @returns Promise resolving to WebAssembly instance
 */
export async function loadWasm(wasmUrl: string, imports: WasmImports = {}): Promise<WebAssembly.Instance> {
  console.log('[WasmLoader] Loading WASM from:', wasmUrl);

  try {
    // Fetch the WASM file
    const response = await fetch(wasmUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
    }

    const wasmBytes = await response.arrayBuffer();
    console.log('[WasmLoader] WASM file loaded, size:', wasmBytes.byteLength, 'bytes');

    // Compile the WASM module
    const wasmModule = await WebAssembly.compile(wasmBytes);
    console.log('[WasmLoader] WASM module compiled successfully');

    // Instantiate the module with imports
    const instance = await WebAssembly.instantiate(wasmModule, imports);
    console.log('[WasmLoader] WASM instance created successfully');

    return instance;

  } catch (error) {
    console.error('[WasmLoader] Failed to load WASM:', error);
    throw error;
  }
}

/**
 * Create default imports for NES emulator WASM modules
 * @param memory Optional WebAssembly memory instance
 * @returns Default import object
 */
export function createDefaultImports(memory?: WebAssembly.Memory): WasmImports {
  return {
    env: {
      memory: memory || new WebAssembly.Memory({ initial: 256, maximum: 256 }),
      abort: (msg: number, file: number, line: number, column: number) => {
        console.error('[WASM] Abort called:', { msg, file, line, column });
      },
      emscripten_resize_heap: () => false,
      __handle_stack_overflow: () => {
        console.error('[WASM] Stack overflow detected');
      },
      // Math functions that might be needed
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      exp: Math.exp,
      log: Math.log,
      sqrt: Math.sqrt,
      floor: Math.floor,
      ceil: Math.ceil,
      // Console functions
      console_log: (ptr: number) => {
        console.log('[WASM Console]', ptr);
      }
    }
  };
}