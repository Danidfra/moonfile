import { NesCore, FrameSpec, PixelFormat } from '../NesCore';

// Helper function to wait for FCEUX script to load
function waitForFCEUXScript(timeout: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof (window as any).FCEUX !== 'undefined') {
      resolve();
      return;
    }

    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (typeof (window as any).FCEUX !== 'undefined') {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`FCEUX script not loaded after ${timeout}ms timeout`));
      }
    }, 50);

    // Also listen for script load events
    const scriptTags = Array.from(document.getElementsByTagName('script'));
    const fceuxScript = scriptTags.find(script => script.src.includes('fceux'));

    if (fceuxScript && !(fceuxScript as HTMLScriptElement).readyState?.includes('complete')) {
      fceuxScript.addEventListener('load', () => {
        setTimeout(() => {
          if (typeof (window as any).FCEUX !== 'undefined') {
            resolve();
          } else {
            reject(new Error('FCEUX script loaded but window.FCEUX not available'));
          }
        }, 100);
      });

      fceuxScript.addEventListener('error', () => {
        clearInterval(checkInterval);
        reject(new Error('Failed to load FCEUX script'));
      });
    }
  });
}

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
      // Wait for FCEUX script to load
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] Waiting for FCEUX script to load...');
      }

      await waitForFCEUXScript();

      const core = (window as any).FCEUX;

      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[FCEUXWebAdapter] FCEUX script loaded, window.FCEUX exists:', !!core);
        console.log('[FCEUXWebAdapter] Core type:', typeof core);
        console.log('[FCEUXWebAdapter] Core methods:', Object.keys(core));
      }

      if (!core) {
        throw new Error('FCEUX core not available after script loading timeout');
      }

      // Verify core has required methods
      const requiredInitMethods = ['init', 'loadRom', 'frame', 'reset', 'setButton', 'getFrameBuffer', 'setRunning'];
      const missingMethods = requiredInitMethods.filter(method => typeof core[method] !== 'function');

      if (missingMethods.length > 0) {
        throw new Error(`FCEUX core missing required methods: ${missingMethods.join(', ')}`);
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