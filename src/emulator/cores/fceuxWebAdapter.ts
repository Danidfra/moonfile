import { NesCore, FrameSpec, PixelFormat } from '../NesCore';

export class FCEUXWebAdapter implements NesCore {
  private core: any = null;
  private running = false;
  private frameSpec: FrameSpec = {
    width: 256,
    height: 240,
    format: 'RGB24' // Will be determined after core init
  };

  async init(): Promise<boolean> {
    try {
      // Load FCEUX core from window (loaded via script tag)
      const core = (window as any).fceuxWeb;
      if (!core) {
        throw new Error('FCEUX core not found on window object. Make sure the script is loaded.');
      }

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Core loaded from window:', typeof core);
        console.log('[FCEUXWebAdapter] Core methods:', Object.keys(core));
      }

      this.core = core;

      // Initialize the core
      if (typeof this.core.init !== 'function') {
        throw new Error('FCEUX core missing init() function');
      }

      await this.core.init();

      // Verify required methods exist
      const requiredMethods = ['loadRom', 'frame', 'reset', 'setButton', 'getFrameBuffer', 'setRunning'];
      for (const method of requiredMethods) {
        if (typeof this.core[method] !== 'function') {
          throw new Error(`FCEUX core missing ${method}() function`);
        }
      }

      // Determine pixel format by checking frame buffer after a test frame
      this.core.frame(); // Run one frame to get buffer
      const buffer = this.core.getFrameBuffer();

      if (buffer.length === 256 * 240 * 4) {
        this.frameSpec.format = 'RGBA32';
      } else if (buffer.length === 256 * 240 * 3) {
        this.frameSpec.format = 'RGB24';
      } else {
        throw new Error(`Unexpected frame buffer size: ${buffer.length}`);
      }

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Core initialized with format:', this.frameSpec.format);
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
      // Validate NES header
      if (!this.validateNESHeader(rom)) {
        throw new Error('Invalid NES ROM header');
      }

      const success = this.core.loadRom(rom, rom.length);

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] ROM loaded:', success);
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
    if (this.core && typeof this.core.setRunning === 'function') {
      this.core.setRunning(running);
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

  getAudioBuffer?(): Int16Array {
    if (this.core && typeof this.core.getAudioBuffer === 'function') {
      return this.core.getAudioBuffer();
    }
    return new Int16Array(0);
  }

  private validateNESHeader(bytes: Uint8Array): boolean {
    if (bytes.length < 4) return false;

    // Check for NES header "NES^Z" (0x4E 0x45 0x53 0x1A)
    const isValid = bytes[0] === 0x4E && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1A;

    if (localStorage.getItem('debug')?.includes('retro:*')) {
      console.log('[FCEUXWebAdapter] Header validation:', isValid,
        Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    }

    return isValid;
  }
}