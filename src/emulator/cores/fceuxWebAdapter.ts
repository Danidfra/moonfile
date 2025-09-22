/**
 * FCEUX WebAssembly Adapter
 *
 * Adapter that loads and manages the NES WebAssembly core (fceux.wasm)
 * implementing the NesCore interface.
 * 
 * TODO: Remove this file - replaced by new emulator core integration
 */

// COMMENTED OUT - FCEUX emulator core removed
/*
import { NesCore, FrameSpec, PixelFormat } from '../NesCore';
import { UniversalWasmCore } from './wasmAdapter';

export class FCEUXWebAdapter implements NesCore {
  private core: UniversalWasmCore | null = null;
  private spec: FrameSpec = { width: 256, height: 240, format: 'RGBA32' as const };

  async init(): Promise<boolean> {
    try {
      console.log('[FCEUXWebAdapter] Initializing FCEUX WebAssembly core...');
      console.log('[FCEUXWebAdapter] Loading WASM from /wasm/fceux.wasm');
      this.core = await UniversalWasmCore.load('/wasm/fceux.wasm');
      console.log('[FCEUXWebAdapter] WASM loaded and instantiated successfully');
      const initSuccess = await this.core.init();
      if (!initSuccess) {
        console.warn('[FCEUXWebAdapter] WASM core init returned false, continuing anyway');
      } else {
        console.log('[FCEUXWebAdapter] WASM core initialized successfully');
      }
      console.log('[FCEUXWebAdapter] Core initialized successfully - using real WASM emulator');
      console.log('[FCEUXWebAdapter] Testing frame buffer functionality...');
      try {
        const spec = this.getFrameSpec();
        const buffer = this.getFrameBuffer();
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
        this.core.frame();
        const updatedBuffer = this.getFrameBuffer();
        console.log('[FCEUXWebAdapter] ✅ Frame generation test completed');
      } catch (error) {
        console.error('[FCEUXWebAdapter] ❌ Frame buffer validation failed:', error);
        throw new Error(`Frame buffer is broken: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      console.log('[FCEUXWebAdapter] ✅ Real NES emulator core active with working frame buffer');
      return true;
    } catch (error) {
      console.error('[FCEUXWebAdapter] Initialization failed:', error);
      if (error instanceof Error && error.message.includes('Bad WASM')) {
        throw new Error(`Emulator initialization failed: ${error.message}`);
      }
      throw new Error(`Emulator initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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

  frame(): void {
    if (this.core) {
      this.core.frame();
    }
  }

  reset(): void {
    if (this.core) {
      this.core.reset();
      console.log('[FCEUXWebAdapter] Emulator reset');
    }
  }

  setButton(index: number, pressed: boolean): void {
    if (this.core) {
      this.core.setButton(index, pressed);
    }
  }

  setRunning(running: boolean): void {
    if (this.core) {
      this.core.setRunning(running);
      console.log('[FCEUXWebAdapter] Set running state:', running);
    }
  }

  getFrameBuffer(): Uint8Array {
    if (!this.core) {
      throw new Error('Core not initialized');
    }
    try {
      const frameBuffer = this.core.getFrameBuffer();
      const expectedSize = 256 * 240 * 4;
      if (frameBuffer.length !== expectedSize) {
        throw new Error(`Frame buffer wrong size: got ${frameBuffer.length}, expected ${expectedSize}`);
      }
      return frameBuffer;
    } catch (error) {
      console.error('[FCEUXWebAdapter] ❌ getFrameBuffer failed:', error);
      const fallbackBuffer = new Uint8Array(256 * 240 * 4);
      for (let i = 0; i < fallbackBuffer.length; i += 4) {
        const x = (i / 4) % 256;
        const y = Math.floor((i / 4) / 256);
        const checker = ((x >> 4) + (y >> 4)) % 2;
        fallbackBuffer[i + 0] = checker ? 255 : 0;
        fallbackBuffer[i + 1] = 0;
        fallbackBuffer[i + 2] = checker ? 0 : 255;
        fallbackBuffer[i + 3] = 255;
      }
      console.warn('[FCEUXWebAdapter] Using fallback frame buffer (red/blue checkerboard)');
      return fallbackBuffer;
    }
  }

  getFrameSpec(): FrameSpec {
    if (this.core) {
      return this.core.getFrameSpec();
    }
    return this.spec;
  }

  getPalette?(): Uint8Array | Uint32Array | null {
    if (this.core) {
      return this.core.getPalette();
    }
    return null;
  }

  getAudioBuffer?(): Int16Array {
    return new Int16Array(0);
  }
}
*/

// TODO: Implement new emulator core integration
export class FCEUXWebAdapter {
  constructor() {
    throw new Error('FCEUX emulator core has been removed. Please integrate new emulator core.');
  }
}