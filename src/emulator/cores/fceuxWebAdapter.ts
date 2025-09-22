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

      // Log frame specification
      const spec = this.getFrameSpec();
      const buffer = this.getFrameBuffer();
      console.log('[FCEUXWebAdapter] Frame spec:', {
        width: spec.width,
        height: spec.height,
        format: spec.format,
        bufferLength: buffer.length
      });

      // Confirm we're not using fallback mode
      console.log('[FCEUXWebAdapter] ✅ Real NES emulator core active (no gradient fallback)');

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

      // Extract ROM info for logging
      const prgBanks = rom[4];
      const chrBanks = rom[5];
      const mapper = ((rom[6] >> 4) | (rom[7] & 0xF0));

      console.log('[FCEUXWebAdapter] ROM info:', {
        size: rom.length,
        prgBanks,
        chrBanks,
        mapper
      });

      // Load ROM into core
      const success = this.core.loadRom(rom);

      if (success) {
        console.log('[FCEUXWebAdapter] ROM loaded successfully');

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
        console.error('[FCEUXWebAdapter] ROM loading failed');
      }

      return !!success;

    } catch (error) {
      console.error('[FCEUXWebAdapter] ROM loading error:', error);
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

    return this.core.getFrameBuffer();
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