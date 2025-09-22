import { NesCore, FrameSpec, PixelFormat } from '../NesCore';
import { initNESCore } from './nes-interface.js';

export class FCEUXWebAdapter implements NesCore {
  private core: any;
  private spec = { width: 256, height: 240, format: 'RGBA32' as const };
  private wasmInstance: any = null;

  async init(): Promise<boolean> {
    try {
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Initializing FCEUX WebAssembly core...');
      }

      // Create WebAssembly memory for core
      const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
      
      // Provide imports as needed by core
      const imports = {
        env: {
          memory: memory,
          abort: (msg: number, file: number, line: number, column: number) => {
            console.error('[FCEUXWebAdapter] WASM abort:', { msg, file, line, column });
          }
        }
      };

      // Use CSP-safe loader
      const { instance } = await initNESCore('/wasm/fceux.wasm', imports);
      this.wasmInstance = instance;

      // Bind required exports from instance.exports
      const ex = instance.exports as any;

      // Sanity checks
      const requiredFunctions = ['init', 'loadRom', 'frame', 'reset', 'setButton', 'getFrameBuffer', 'getPalette', 'setRunning'];
      const missingFunctions = requiredFunctions.filter(fn => typeof ex[fn] !== 'function');
      
      if (missingFunctions.length > 0) {
        // Log available exports for debugging
        const availableExports = Object.keys(ex).filter(key => typeof ex[key] === 'function');
        console.error('[FCEUXWebAdapter] Available exports:', availableExports);
        throw new Error(`WASM exports missing: ${missingFunctions.join(', ')}. Available: ${availableExports.join(', ')}`);
      }

      this.core = ex;
      
      // Initialize core
      const initResult = this.core.init();
      if (!initResult) {
        throw new Error('WASM core initialization failed');
      }

      // Initialize palette if available
      if (typeof (window as any).initNESPalette === 'function') {
        (window as any).initNESPalette(memory);
      }

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Core initialized successfully');
        
        // Log frame spec for diagnostics
        const spec = this.getFrameSpec();
        const buffer = this.getFrameBuffer();
        console.log('[FCEUXWebAdapter] Frame spec:', {
          width: spec.width,
          height: spec.height,
          format: spec.format,
          bufferLength: buffer.length
        });

        // Log CSP diagnostics and WASM response headers
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        console.log('[FCEUXWebAdapter] Effective CSP:', cspMeta?.getAttribute('content') || 'none');
        
        // Log WASM response headers for verification
        try {
          const wasmResponse = await fetch('/wasm/fceux.wasm', { method: 'HEAD' });
          console.log('[FCEUXWebAdapter] WASM Response Headers:', {
            status: wasmResponse.status,
            contentType: wasmResponse.headers.get('content-type'),
            contentLength: wasmResponse.headers.get('content-length')
          });
        } catch (error) {
          console.warn('[FCEUXWebAdapter] Could not fetch WASM headers:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('[FCEUXWebAdapter] Failed to initialize:', error);
      return false;
    }
  }

  async loadRom(rom: Uint8Array): Promise<boolean> {
    if (!this.core) {
      throw new Error('Core not initialized');
    }

    try {
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Loading ROM, size:', rom.length);
      }

      // Validate NES header
      if (rom.length < 16) {
        throw new Error('ROM too small');
      }

      if (rom[0] !== 0x4E || rom[1] !== 0x45 || rom[2] !== 0x53 || rom[3] !== 0x1A) {
        throw new Error('Invalid NES header');
      }

      // Log ROM info for diagnostics
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] ROM info:', {
          size: rom.length,
          prgBanks: rom[4],
          chrBanks: rom[5],
          mapper: ((rom[6] >> 4) | (rom[7] & 0xF0))
        });
      }

      // Load ROM into core
      const success = this.core.loadRom(rom);

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] ROM loaded result:', success);

        // Log frame spec after ROM load
        const spec = this.getFrameSpec();
        console.log('[FCEUXWebAdapter] Frame spec after ROM load:', {
          width: spec.width,
          height: spec.height,
          format: spec.format
        });

        const buffer = this.getFrameBuffer();
        console.log('[FCEUXWebAdapter] Frame buffer length after ROM load:', buffer.length);

        // If INDEXED8 format, log palette info
        if (spec.format === 'INDEXED8') {
          const palette = this.getPalette?.();
          if (palette) {
            console.log('[FCEUXWebAdapter] Palette info:', {
              length: palette.length,
              type: palette.constructor.name
            });
          }
        }
      }

      return !!success;
    } catch (error) {
      console.error('[FCEUXWebAdapter] Failed to load ROM:', error);
      return false;
    }
  }

  frame(): void {
    if (this.core) {
      this.core.frame();
    }
  }

  reset(): void {
    if (this.core?.reset) {
      this.core.reset();
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Core reset');
      }
    }
  }

  setButton(index: number, pressed: boolean): void {
    if (this.core?.setButton) {
      this.core.setButton(index, pressed ? 1 : 0);
    }
  }

  setRunning(running: boolean): void {
    if (this.core?.setRunning) {
      this.core.setRunning(running);
    }
    if (localStorage.getItem('debug')?.includes('retro:*')) {
      console.log('[FCEUXWebAdapter] Set running:', running);
    }
  }

  getFrameBuffer(): Uint8Array {
    if (!this.core) {
      throw new Error('Core not initialized');
    }
    return this.core.getFrameBuffer();
  }

  getFrameSpec(): FrameSpec {
    if (this.core?.getFrameSpec) {
      const spec = this.core.getFrameSpec();
      return {
        width: spec.width || 256,
        height: spec.height || 240,
        format: spec.format || 'RGBA32'
      };
    }
    return this.spec;
  }

  getPalette?(): Uint8Array | Uint32Array | null {
    if (this.core?.getPalette) {
      return this.core.getPalette();
    }
    return null;
  }

  getAudioBuffer?(): Int16Array {
    if (this.core?.getAudioBuffer) {
      return this.core.getAudioBuffer();
    }
    return new Int16Array(0);
  }
}