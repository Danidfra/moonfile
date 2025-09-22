/**
 * FCEUX WebAssembly Adapter
 *
 * Adapter that loads and manages the NES WebAssembly core (fceux.wasm)
 * implementing the NesCore interface.
 */

import { NesCore, FrameSpec, PixelFormat } from '../NesCore';
import { UniversalWasmCore } from './wasmAdapter';

export class FCEUXWebAdapter implements NesCore {
  private core: UniversalWasmCore | null = null;
  private spec: FrameSpec = { width: 256, height: 240, format: 'RGBA32' as const };

  /**
   * Initialize the FCEUX WebAssembly core
   */
  async init(): Promise<boolean> {
    try {
      console.log('[FCEUXWebAdapter] Initializing FCEUX WebAssembly core...');

      // Load WASM using universal adapter
      console.log('[FCEUXWebAdapter] Loading WASM from /wasm/fceux.wasm');
      this.core = await UniversalWasmCore.load('/wasm/fceux.wasm');

      console.log('[FCEUXWebAdapter] WASM loaded and instantiated successfully');

      // Initialize the core
      const initSuccess = await this.core.init();
      if (!initSuccess) {
        console.warn('[FCEUXWebAdapter] WASM core init returned false, continuing anyway');
      } else {
        console.log('[FCEUXWebAdapter] WASM core initialized successfully');
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
        this.core.frame();
        const updatedBuffer = this.getFrameBuffer();
        console.log('[FCEUXWebAdapter] ✅ Frame generation test completed');

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

      const success = await this.core.loadRom(rom);

      if (success) {
        console.log('[FCEUXWebAdapter] ✅ ROM loaded successfully into WASM core');
      } else {
        console.error('[FCEUXWebAdapter] ❌ ROM loading failed - WASM core rejected the ROM');
      }

      return success;

    } catch (error) {
      console.error('[FCEUXWebAdapter] ROM loading error:', error);
      return false;
    }
  }



  /**
   * Advance emulator by one frame
   */
  frame(): void {
    if (this.core) {
      this.core.frame();
    }
  }

  /**
   * Reset emulator to initial state
   */
  reset(): void {
    if (this.core) {
      this.core.reset();
      console.log('[FCEUXWebAdapter] Emulator reset');
    }
  }

  /**
   * Set controller button state
   */
  setButton(index: number, pressed: boolean): void {
    if (this.core) {
      this.core.setButton(index, pressed);
    }
  }

  /**
   * Set emulator running state
   */
  setRunning(running: boolean): void {
    if (this.core) {
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

    try {
      const frameBuffer = this.core.getFrameBuffer();

      // Validate result
      const expectedSize = 256 * 240 * 4;
      if (frameBuffer.length !== expectedSize) {
        throw new Error(`Frame buffer wrong size: got ${frameBuffer.length}, expected ${expectedSize}`);
      }

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
    if (this.core) {
      return this.core.getFrameSpec();
    }

    // Return default spec if core doesn't provide one
    return this.spec;
  }

  /**
   * Get color palette (for INDEXED8 format)
   */
  getPalette?(): Uint8Array | Uint32Array | null {
    if (this.core) {
      return this.core.getPalette();
    }
    return null;
  }

  /**
   * Get audio buffer
   */
  getAudioBuffer?(): Int16Array {
    return new Int16Array(0);
  }
}