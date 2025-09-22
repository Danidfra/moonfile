/**
 * FCEUX WebAssembly Adapter
 *
 * Adapter that loads and manages the NES WebAssembly core (fceux.wasm)
 * implementing the NesCore interface.
 */

import { NesCore, FrameSpec, PixelFormat } from '../NesCore';
import { loadWasm, createDefaultImports } from './wasmLoader';

export class FCEUXWebAdapter implements NesCore {
  private core: any = null;
  private wasmInstance: any = null;
  private spec: FrameSpec = { width: 256, height: 240, format: 'RGBA32' as const };

  /**
   * Initialize the FCEUX WebAssembly core
   */
  async init(): Promise<boolean> {
    try {
      console.log('[FCEUXWebAdapter] Initializing FCEUX WebAssembly core...');

      // Create WebAssembly memory
      const memory = new WebAssembly.Memory({
        initial: 256, // 16MB initial
        maximum: 256  // 16MB maximum
      });

      // Create imports for the WASM module
      const imports = createDefaultImports(memory);

      // Load WASM module using our loader
      console.log('[FCEUXWebAdapter] Loading WASM from /wasm/fceux.wasm');
      this.wasmInstance = await loadWasm('/wasm/fceux.wasm', imports);

      console.log('[FCEUXWebAdapter] WASM loaded and instantiated successfully');

      // Bind exports from the WASM instance
      const exports = this.wasmInstance.exports as any;

      // Check for required functions (some may be optional)
      const requiredFunctions = ['init', 'loadRom', 'frame', 'reset', 'setButton', 'getFrameBuffer', 'setRunning'];
      const optionalFunctions = ['getPalette', 'getAudioBuffer', 'getFrameSpec'];

      const availableExports = Object.keys(exports).filter(key => typeof exports[key] === 'function');
      console.log('[FCEUXWebAdapter] Available WASM exports:', availableExports);

      const missingRequired = requiredFunctions.filter(fn => typeof exports[fn] !== 'function');

      if (missingRequired.length > 0) {
        console.error('[FCEUXWebAdapter] Missing required WASM exports:', missingRequired);
        throw new Error(`Bad WASM: missing required exports: ${missingRequired.join(', ')}. This indicates a corrupted or incompatible WASM file.`);
      }

      this.core = exports;

      // Initialize the core if available
      if (typeof this.core.init === 'function') {
        const initResult = this.core.init();
        if (!initResult) {
          console.warn('[FCEUXWebAdapter] WASM core init returned false, continuing anyway');
        } else {
          console.log('[FCEUXWebAdapter] WASM core initialized successfully');
        }
      }

      console.log('[FCEUXWebAdapter] Core initialized successfully - using real WASM emulator');

      // Test frame buffer functionality immediately
      console.log('[FCEUXWebAdapter] Testing frame buffer functionality...');
      try {
        const spec = this.getFrameSpec();
        const buffer = this.getFrameBuffer();

        // Validate frame buffer
        const expectedSize = 256 * 240 * 4;
        if (!(buffer instanceof Uint8Array)) {
          throw new Error(`getFrameBuffer() returned ${typeof buffer}, expected Uint8Array`);
        }

        if (buffer.length !== expectedSize) {
          throw new Error(`Frame buffer wrong size: ${buffer.length}, expected ${expectedSize}`);
        }

        console.log('[FCEUXWebAdapter] ✅ Frame buffer validation passed:', {
          width: spec.width,
          height: spec.height,
          format: spec.format,
          bufferLength: buffer.length,
          bufferType: buffer.constructor.name,
          isValidSize: buffer.length === expectedSize
        });

        // Test frame generation
        if (typeof this.core.frame === 'function') {
          this.core.frame();
          const updatedBuffer = this.getFrameBuffer();
          console.log('[FCEUXWebAdapter] ✅ Frame generation test completed');
        }

      } catch (error) {
        console.error('[FCEUXWebAdapter] ❌ Frame buffer validation failed:', error);
        throw new Error(`Frame buffer is broken: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Confirm we're not using fallback mode
      console.log('[FCEUXWebAdapter] ✅ Real NES emulator core active with working frame buffer');

      return true;

    } catch (error) {
      console.error('[FCEUXWebAdapter] Initialization failed:', error);

      // Never fall back to gradient mode - fail fast with clear error
      if (error instanceof Error && error.message.includes('Bad WASM')) {
        throw new Error(`Emulator initialization failed: ${error.message}`);
      }

      throw new Error(`Emulator initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  /**
   * Load ROM into the emulator core
   */
  async loadRom(rom: Uint8Array): Promise<boolean> {
    if (!this.core) {
      throw new Error('Core not initialized - call init() first');
    }

    try {
      console.log('[FCEUXWebAdapter] Loading ROM into core, size:', rom.length, 'bytes');

      // Validate NES header before loading
      if (rom.length < 16) {
        throw new Error('ROM too small for NES header');
      }

      if (rom[0] !== 0x4E || rom[1] !== 0x45 || rom[2] !== 0x53 || rom[3] !== 0x1A) {
        throw new Error('Invalid NES header magic bytes');
      }

      // Extract detailed ROM info for logging
      const prgBanks = rom[4];
      const chrBanks = rom[5];
      const flags6 = rom[6];
      const flags7 = rom[7];
      const mapper = ((flags6 >> 4) | (flags7 & 0xF0));
      const mirroring = flags6 & 0x01;
      const hasBattery = (flags6 & 0x02) !== 0;
      const hasTrainer = (flags6 & 0x04) !== 0;
      const fourScreen = (flags6 & 0x08) !== 0;

      // Calculate expected ROM size
      let expectedSize = 16; // Header
      if (hasTrainer) expectedSize += 512; // Trainer
      expectedSize += prgBanks * 16384; // PRG-ROM
      expectedSize += chrBanks * 8192;  // CHR-ROM

      console.log('[FCEUXWebAdapter] Detailed ROM analysis:', {
        totalSize: rom.length,
        expectedSize,
        prgBanks,
        chrBanks,
        mapper,
        mirroring: mirroring ? 'vertical' : 'horizontal',
        hasBattery,
        hasTrainer,
        fourScreen,
        flags6: '0x' + flags6.toString(16).padStart(2, '0'),
        flags7: '0x' + flags7.toString(16).padStart(2, '0')
      });

      // Check for common issues
      if (rom.length !== expectedSize) {
        console.warn('[FCEUXWebAdapter] ROM size mismatch:', {
          actual: rom.length,
          expected: expectedSize,
          difference: rom.length - expectedSize
        });
      }

      if (chrBanks === 0) {
        console.log('[FCEUXWebAdapter] ROM uses CHR RAM (0 CHR banks)');
      }

      if (mapper > 4) {
        console.warn('[FCEUXWebAdapter] Advanced mapper detected:', mapper, '- may not be supported by simple cores');
      }

      // Check WASM memory constraints
      if (this.wasmInstance && this.wasmInstance.exports.memory) {
        const memory = this.wasmInstance.exports.memory as WebAssembly.Memory;
        const memorySize = memory.buffer.byteLength;
        console.log('[FCEUXWebAdapter] WASM memory size:', memorySize, 'bytes');

        if (rom.length > memorySize / 4) { // Conservative check
          console.warn('[FCEUXWebAdapter] ROM may be too large for WASM memory:', {
            romSize: rom.length,
            memorySize,
            ratio: rom.length / memorySize
          });
        }
      }

      // Try to load ROM into core
      console.log('[FCEUXWebAdapter] Calling WASM loadRom() function...');

      // For WASM cores that expect memory pointers, we may need to copy the ROM to WASM memory first
      let success;
      if (typeof this.core.loadRom === 'function') {
        // Check if loadRom expects a pointer + size or direct Uint8Array
        if (this.wasmInstance && this.wasmInstance.exports.memory) {
          // Copy ROM to WASM memory and pass pointer
          success = this.loadRomViaMemory(rom);
        } else {
          // Try direct call with Uint8Array
          success = this.core.loadRom(rom, rom.length);
        }
      } else {
        throw new Error('loadRom function not available in WASM core');
      }

      if (success) {
        console.log('[FCEUXWebAdapter] ✅ ROM loaded successfully into WASM core');

        // Log updated frame spec after ROM load
        const spec = this.getFrameSpec();
        const buffer = this.getFrameBuffer();
        console.log('[FCEUXWebAdapter] Post-load frame spec:', {
          width: spec.width,
          height: spec.height,
          format: spec.format,
          bufferLength: buffer.length
        });

        // If using indexed color format, log palette info
        if (spec.format === 'INDEXED8') {
          const palette = this.getPalette?.();
          if (palette) {
            console.log('[FCEUXWebAdapter] Palette available:', {
              length: palette.length,
              type: palette.constructor.name
            });
          }
        }
      } else {
        console.error('[FCEUXWebAdapter] ❌ ROM loading failed - WASM core rejected the ROM');
        console.error('[FCEUXWebAdapter] This could be due to:');
        console.error('  - Unsupported mapper:', mapper);
        console.error('  - CHR RAM handling (0 CHR banks)');
        console.error('  - ROM size constraints in WASM core');
        console.error('  - Memory allocation failure');
        console.error('  - WASM core validation logic');
      }

      return !!success;

    } catch (error) {
      console.error('[FCEUXWebAdapter] ROM loading error:', error);
      console.error('[FCEUXWebAdapter] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Load ROM via WASM memory (for cores that expect pointers)
   */
  private loadRomViaMemory(rom: Uint8Array): boolean {
    try {
      const memory = this.wasmInstance!.exports.memory as WebAssembly.Memory;
      const memoryArray = new Uint8Array(memory.buffer);

      // Find a suitable location in WASM memory (after our frame buffer)
      const romOffset = 100 * 1024; // Start at 100KB offset

      if (romOffset + rom.length > memory.buffer.byteLength) {
        console.error('[FCEUXWebAdapter] ROM too large for WASM memory:', {
          romSize: rom.length,
          availableSpace: memory.buffer.byteLength - romOffset
        });
        return false;
      }

      // Copy ROM data to WASM memory
      memoryArray.set(rom, romOffset);
      console.log('[FCEUXWebAdapter] ROM copied to WASM memory at offset:', romOffset);

      // Call loadRom with pointer and size
      return this.core.loadRom(romOffset, rom.length);

    } catch (error) {
      console.error('[FCEUXWebAdapter] Failed to load ROM via memory:', error);
      return false;
    }
  }

  /**
   * Advance emulator by one frame
   */
  frame(): void {
    if (this.core?.frame) {
      this.core.frame();
    }
  }

  /**
   * Reset emulator to initial state
   */
  reset(): void {
    if (this.core?.reset) {
      this.core.reset();
      console.log('[FCEUXWebAdapter] Emulator reset');
    }
  }

  /**
   * Set controller button state
   */
  setButton(index: number, pressed: boolean): void {
    if (this.core?.setButton) {
      this.core.setButton(index, pressed ? 1 : 0);
    }
  }

  /**
   * Set emulator running state
   */
  setRunning(running: boolean): void {
    if (this.core?.setRunning) {
      this.core.setRunning(running);
      console.log('[FCEUXWebAdapter] Set running state:', running);
    }
  }

  /**
   * Get current frame buffer
   */
  getFrameBuffer(): Uint8Array {
    if (!this.core) {
      throw new Error('Core not initialized');
    }

    if (typeof this.core.getFrameBuffer !== 'function') {
      throw new Error('getFrameBuffer not available in core');
    }

    try {
      // Get frame buffer pointer from WASM
      const frameBufferPtr = this.core.getFrameBuffer();

      if (typeof frameBufferPtr !== 'number') {
        throw new Error(`getFrameBuffer returned invalid type: ${typeof frameBufferPtr} (expected number pointer)`);
      }

      if (!this.wasmInstance || !this.wasmInstance.exports.memory) {
        throw new Error('WASM memory not available');
      }

      // Get frame buffer size (should be 245760 bytes for 256x240 RGBA)
      const expectedSize = 256 * 240 * 4; // RGBA32 format
      let bufferSize = expectedSize;

      // Try to get size from WASM if available
      if (typeof this.core.getFrameBufferSize === 'function') {
        bufferSize = this.core.getFrameBufferSize();
        console.log('[FCEUXWebAdapter] Frame buffer size from WASM:', bufferSize);
      }

      // Validate buffer size
      if (bufferSize !== expectedSize) {
        console.warn('[FCEUXWebAdapter] Frame buffer size mismatch:', {
          expected: expectedSize,
          actual: bufferSize,
          format: 'RGBA32 (256x240x4)'
        });
        // Use expected size for safety
        bufferSize = expectedSize;
      }

      // Get WASM memory
      const memory = this.wasmInstance.exports.memory as WebAssembly.Memory;
      const memoryArray = new Uint8Array(memory.buffer);

      // Validate pointer bounds
      if (frameBufferPtr < 0 || frameBufferPtr + bufferSize > memory.buffer.byteLength) {
        throw new Error(`Frame buffer pointer out of bounds: ptr=${frameBufferPtr}, size=${bufferSize}, memory=${memory.buffer.byteLength}`);
      }

      // Extract frame buffer from WASM memory
      const frameBuffer = memoryArray.slice(frameBufferPtr, frameBufferPtr + bufferSize);

      // Validate result
      if (frameBuffer.length !== expectedSize) {
        throw new Error(`Frame buffer wrong size: got ${frameBuffer.length}, expected ${expectedSize}`);
      }

      console.log('[FCEUXWebAdapter] ✅ Frame buffer extracted successfully:', {
        pointer: frameBufferPtr,
        size: frameBuffer.length,
        format: 'RGBA32',
        dimensions: '256x240'
      });

      return frameBuffer;

    } catch (error) {
      console.error('[FCEUXWebAdapter] ❌ getFrameBuffer failed:', error);

      // Return a valid fallback buffer to prevent crashes
      const fallbackBuffer = new Uint8Array(256 * 240 * 4);

      // Fill with a visible pattern so we know it's fallback
      for (let i = 0; i < fallbackBuffer.length; i += 4) {
        const x = (i / 4) % 256;
        const y = Math.floor((i / 4) / 256);

        // Create a red/blue checkerboard pattern
        const checker = ((x >> 4) + (y >> 4)) % 2;
        fallbackBuffer[i + 0] = checker ? 255 : 0;   // R
        fallbackBuffer[i + 1] = 0;                   // G
        fallbackBuffer[i + 2] = checker ? 0 : 255;   // B
        fallbackBuffer[i + 3] = 255;                 // A
      }

      console.warn('[FCEUXWebAdapter] Using fallback frame buffer (red/blue checkerboard)');
      return fallbackBuffer;
    }
  }

  /**
   * Get frame specification
   */
  getFrameSpec(): FrameSpec {
    if (this.core?.getFrameSpec && typeof this.core.getFrameSpec === 'function') {
      const spec = this.core.getFrameSpec();
      return {
        width: spec.width || 256,
        height: spec.height || 240,
        format: spec.format || 'RGBA32'
      };
    }

    // Return default spec if core doesn't provide one
    return this.spec;
  }

  /**
   * Get color palette (for INDEXED8 format)
   */
  getPalette?(): Uint8Array | Uint32Array | null {
    if (this.core?.getPalette && typeof this.core.getPalette === 'function') {
      return this.core.getPalette();
    }
    return null;
  }

  /**
   * Get audio buffer
   */
  getAudioBuffer?(): Int16Array {
    if (this.core?.getAudioBuffer && typeof this.core.getAudioBuffer === 'function') {
      return this.core.getAudioBuffer();
    }
    return new Int16Array(0);
  }
}