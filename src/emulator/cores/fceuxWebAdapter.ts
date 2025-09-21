import { NesCore, FrameSpec, PixelFormat } from '../NesCore';

export class FCEUXWebAdapter implements NesCore {
  private core: any = null;
  private running = false;
  private frameSpec: FrameSpec = {
    width: 256,
    height: 240,
    format: 'RGBA32' // Default, will be determined after core init
  };

  async init(): Promise<boolean> {
    try {
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Initializing FCEUX WebAssembly core...');
      }

      // Wait for NES Interface script to load
      if (typeof (window as any).NESInterface === 'undefined') {
        throw new Error('NES Interface not loaded. Make sure nes-interface.js is loaded.');
      }

      // Create NES Interface instance
      const NESInterface = (window as any).NESInterface;
      this.core = new NESInterface();

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] NES Interface instance created');
      }

      // Initialize the core
      const initResult = await this.core.init();
      if (!initResult) {
        throw new Error('NES Interface initialization failed');
      }

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Core initialized successfully');
      }

      // Verify required methods exist
      const requiredMethods = ['loadROM', 'frame', 'reset', 'setButton', 'getFrameBuffer', 'getFrameSpec'];
      for (const method of requiredMethods) {
        if (typeof this.core[method] !== 'function') {
          throw new Error(`FCEUX core missing ${method}() function`);
        }
      }

      // Get frame spec from core
      const spec = this.core.getFrameSpec();
      if (spec) {
        this.frameSpec = {
          width: spec.width || 256,
          height: spec.height || 240,
          format: spec.format || 'RGBA32'
        };
      }

      // Log diagnostics
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Frame spec after init:', {
          width: this.frameSpec.width,
          height: this.frameSpec.height,
          format: this.frameSpec.format
        });

        const testBuffer = this.core.getFrameBuffer();
        if (testBuffer) {
          console.log('[FCEUXWebAdapter] Initial frame buffer length:', testBuffer.length);
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

      // Load ROM into core
      const success = this.core.loadROM(rom);

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] ROM loaded result:', success);

        // Log frame spec after ROM load
        const spec = this.core.getFrameSpec();
        console.log('[FCEUXWebAdapter] Frame spec after ROM load:', {
          width: spec.width,
          height: spec.height,
          format: spec.format
        });

        const buffer = this.core.getFrameBuffer();
        if (buffer) {
          console.log('[FCEUXWebAdapter] Frame buffer length after ROM load:', buffer.length);
        }

        // If INDEXED8 format, log palette info
        if (spec.format === 'INDEXED8') {
          const palette = this.core.getPalette?.();
          if (palette) {
            console.log('[FCEUXWebAdapter] Palette info:', {
              length: palette.length,
              type: palette.constructor.name
            });
          }
        }
      }

      return success;
    } catch (error) {
      console.error('[FCEUXWebAdapter] Failed to load ROM:', error);
      return false;
    }
  }

  frame(): void {
    if (this.core && this.running) {
      this.core.frame();
    }
  }

  reset(): void {
    if (this.core) {
      this.core.reset();
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Core reset');
      }
    }
  }

  setButton(index: number, pressed: boolean): void {
    if (this.core && typeof this.core.setButton === 'function') {
      this.core.setButton(index, pressed);
    }
  }

  setRunning(running: boolean): void {
    this.running = running;
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
    return this.frameSpec;
  }

  getPalette?(): Uint8Array | Uint32Array | null {
    if (this.core && typeof this.core.getPalette === 'function') {
      return this.core.getPalette();
    }
    return null;
  }

  getAudioBuffer?(): Int16Array {
    if (this.core && typeof this.core.getAudioBuffer === 'function') {
      return this.core.getAudioBuffer();
    }
    return new Int16Array(0);
  }
}