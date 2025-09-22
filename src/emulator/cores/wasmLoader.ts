/**
 * WebAssembly Loader Utility
 *
 * CSP-safe WASM loader for emulator cores with integrity validation.
 */

export interface WasmImports {
  env?: Record<string, any>;
  [namespace: string]: Record<string, any> | undefined;
}

export interface WasmValidationResult {
  isValid: boolean;
  size: number;
  version: number;
  error?: string;
}

/**
 * Validate WASM file integrity
 * @param wasmBytes The WASM file as ArrayBuffer
 * @returns Validation result with details
 */
export function validateWasmFile(wasmBytes: ArrayBuffer): WasmValidationResult {
  const bytes = new Uint8Array(wasmBytes);
  const size = wasmBytes.byteLength;

  // Check minimum size (real emulator cores should be >100KB, but allow smaller for demos)
  if (size < 500) {
    return {
      isValid: false,
      size,
      version: 0,
      error: `WASM file too small: ${size} bytes (minimum 500 bytes required)`
    };
  }

  // Warn if file is suspiciously small for a real emulator
  if (size < 100 * 1024) {
    console.warn(`[WasmLoader] Warning: WASM file is only ${size} bytes. A full NES emulator should be >100KB.`);
  }

  // Check WASM magic bytes (0x00 0x61 0x73 0x6D)
  if (bytes.length < 8) {
    return {
      isValid: false,
      size,
      version: 0,
      error: 'WASM file too short for magic bytes'
    };
  }

  const magic = [bytes[0], bytes[1], bytes[2], bytes[3]];
  const expectedMagic = [0x00, 0x61, 0x73, 0x6D]; // "\0asm"

  if (!magic.every((byte, i) => byte === expectedMagic[i])) {
    return {
      isValid: false,
      size,
      version: 0,
      error: `Invalid WASM magic bytes: [${magic.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`
    };
  }

  // Check WASM version (bytes 4-7, should be 0x01 0x00 0x00 0x00 for MVP)
  const version = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);

  if (version !== 1) {
    return {
      isValid: false,
      size,
      version,
      error: `Unsupported WASM version: ${version} (expected 1)`
    };
  }

  return {
    isValid: true,
    size,
    version,
  };
}

/**
 * Load and instantiate a WebAssembly module with integrity checks
 * @param wasmUrl URL to the WASM file
 * @param imports Import object for the WASM module
 * @returns Promise resolving to WebAssembly instance
 */
export async function loadWasm(wasmUrl: string, imports: WasmImports = {}): Promise<WebAssembly.Instance> {
  // Add cache buster to avoid stale files
  const cacheBuster = `v=${Date.now()}`;
  const urlWithCacheBuster = wasmUrl + (wasmUrl.includes('?') ? '&' : '?') + cacheBuster;

  console.log('[WasmLoader] Loading WASM from:', urlWithCacheBuster);

  try {
    // Fetch the WASM file with no-cache headers
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

    // Log response headers for debugging
    console.log('[WasmLoader] Response headers:', {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      contentEncoding: response.headers.get('content-encoding'),
      cacheControl: response.headers.get('cache-control')
    });

    const wasmBytes = await response.arrayBuffer();
    console.log('[WasmLoader] WASM file fetched, size:', wasmBytes.byteLength, 'bytes');

    // Validate WASM file integrity
    const validation = validateWasmFile(wasmBytes);

    if (!validation.isValid) {
      throw new Error(`Bad WASM: ${validation.error}`);
    }

    console.log('[WasmLoader] WASM validation passed:', {
      size: `${Math.round(validation.size / 1024)}KB`,
      version: validation.version
    });

    // Compile the WASM module
    const wasmModule = await WebAssembly.compile(wasmBytes);
    console.log('[WasmLoader] WASM module compiled successfully');

    // Instantiate the module with imports
    const instance = await WebAssembly.instantiate(wasmModule, imports as WebAssembly.Imports);
    console.log('[WasmLoader] WASM instance created successfully');

    // Log available exports for debugging
    const exports = instance.exports;
    const exportNames = Object.keys(exports);
    const functionExports = exportNames.filter(name => typeof exports[name] === 'function');
    const memoryExports = exportNames.filter(name => exports[name] instanceof WebAssembly.Memory);
    const globalExports = exportNames.filter(name => exports[name] instanceof WebAssembly.Global);

    console.log('[WasmLoader] Exports:', {
      total: exportNames.length,
      functions: functionExports.length,
      memory: memoryExports.length,
      globals: globalExports.length,
      functionNames: functionExports.slice(0, 10) // Log first 10 function names
    });

    if (functionExports.length === 0) {
      throw new Error('Bad WASM: no function exports found (likely corrupted or stub file)');
    }

    return instance;

  } catch (error) {
    console.error('[WasmLoader] Failed to load WASM:', error);

    // Enhance error message for common issues
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error(`WASM loading failed: ${error.message}. Check that fceux.wasm exists in public/wasm/ and is served correctly.`);
      } else if (error.message.includes('Bad WASM')) {
        throw new Error(`${error.message}. The WASM file may be corrupted, truncated, or a placeholder stub.`);
      }
    }

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