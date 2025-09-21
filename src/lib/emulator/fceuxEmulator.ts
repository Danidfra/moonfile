export interface FCEUXControls {
  right: boolean;
  left: boolean;
  down: boolean;
  up: boolean;
  start: boolean;
  select: boolean;
  b: boolean;
  a: boolean;
}

export interface FCEUXConfig {
  audio?: boolean;
  onFrame?: (buffer: Uint8Array) => void;
  onAudioSample?: (left: number, right: number) => void;
}

export class FCEUXEmulator {
  private core: any = null;
  private ready = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;
  private rafId: number = 0;
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private config: FCEUXConfig = {};
  private running = false;
  private frameCount = 0;
  private memory: WebAssembly.Memory | null = null;

  constructor() {
    console.log('[FCEUXEmulator] constructing FCEUX emulator');
  }

  async init(canvas: HTMLCanvasElement, opts: { audio: boolean }): Promise<void> {
    console.log('[FCEUXEmulator] init start');

    if (this.ready) {
      console.log('[FCEUXEmulator] Already initialized');
      return;
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.config = opts;

    if (this.ctx) {
      // Set canvas attributes directly (not just CSS)
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = 2; // 2x scale for better visibility
      canvas.width = 256 * dpr * scale;
      canvas.height = 240 * dpr * scale;

      // CSS sizing for layout
      canvas.style.width = `${256 * scale}px`;
      canvas.style.height = `${240 * scale}px`;

      // Set up transform and create ImageData
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;

      // Create single ImageData for frame buffer
      this.imageData = this.ctx.createImageData(256, 240);

      // Log diagnostics
      console.log('[FCEUX] canvas attr size', canvas.width, canvas.height, 'dpr', dpr, 'scale', scale);
      console.log('[FCEUX] CSS size', canvas.style.width, canvas.style.height);
      console.log('[FCEUX] imageData', this.imageData.width, this.imageData.height);
    }

    // Initialize core
    try {
      const core = (window as any).FCEUX;

      if (!core) {
        throw new Error('FCEUX core not found on window object');
      }

      console.log('[FCEUXEmulator] Found core, type:', typeof core);
      console.log('[FCEUXEmulator] Core has init:', typeof core.init);
      console.log('[FCEUXEmulator] Core has loadRom:', typeof core.loadRom);
      console.log('[FCEUXEmulator] Core has frame:', typeof core.frame);
      console.log('[FCEUXEmulator] Core has reset:', typeof core.reset);

      // Hard assertions for required methods
      if (typeof core.init !== 'function') {
        throw new Error('FCEUX core missing init() function');
      }

      console.log('[FCEUXEmulator] Calling core.init()...');
      const initResult = await core.init();
      console.log('[FCEUXEmulator] core.init() returned:', initResult);

      // After init, verify core has all required methods
      this.core = core;
      const methods = Object.keys(this.core);
      console.log('[FCEUXEmulator] core api:', methods);

      // Assert presence of critical methods
      if (typeof this.core.loadRom !== 'function') {
        console.error('[FCEUXEmulator] core missing loadRom()', methods);
        throw new Error('Core missing loadRom()');
      }

      if (typeof this.core.frame !== 'function') {
        console.error('[FCEUXEmulator] core missing frame()', methods);
        throw new Error('Core missing frame()');
      }

      if (typeof this.core.reset !== 'function') {
        console.error('[FCEUXEmulator] core missing reset()', methods);
        throw new Error('Core missing reset()');
      }

      if (typeof this.core.setButton !== 'function') {
        console.error('[FCEUXEmulator] core missing setButton()', methods);
        throw new Error('Core missing setButton()');
      }

      if (typeof this.core.getFrameBuffer !== 'function') {
        console.error('[FCEUXEmulator] core missing getFrameBuffer()', methods);
        throw new Error('Core missing getFrameBuffer()');
      }

      if (typeof this.core.setRunning !== 'function') {
        console.error('[FCEUXEmulator] core missing setRunning()', methods);
        throw new Error('Core missing setRunning()');
      }

      this.memory = null; // Core manages its own memory
      this.ready = true;

      console.log('[FCEUXEmulator] init done, api:', Object.keys(core));
      console.log('[FCEUXEmulator] Core ready:', this.ready);

      // Initialize audio if enabled
      if (opts.audio) {
        this.initAudio();
      }
    } catch (error) {
      console.error('[FCEUXEmulator] Core initialization failed:', error);
      throw error;
    }
  }

  private initAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('[FCEUXEmulator] Audio context initialized');
    } catch (error) {
      console.warn('[FCEUXEmulator] Audio initialization failed:', error);
      this.config.audio = false;
    }
  }

  loadROM(bytes: Uint8Array): boolean {
    console.log('[FCEUXEmulator] loadROM called, ready:', this.ready, 'has core:', !!this.core);

    // Hard assertions and logging
    if (!this.core) {
      console.error('[FCEUXEmulator] loadROM called but core is null');
      throw new Error('FCEUX core not set');
    }

    if (!this.ready) {
      console.error('[FCEUXEmulator] loadROM called before ready');
      throw new Error('NES core not available - not ready');
    }

    const methods = Object.keys(this.core);
    console.log('[FCEUXEmulator] core api:', methods);

    if (typeof this.core.loadRom !== 'function') {
      console.error('[FCEUXEmulator] Core missing loadRom() function');
      console.error('[FCEUXEmulator] Available core methods:', methods);
      throw new Error('Core missing loadRom()');
    }

    try {
      console.log('[FCEUXEmulator] loadROM bytes:', bytes.length);

      // Validate NES header
      if (!this.validateNESHeader(bytes)) {
        console.error('[FCEUXEmulator] Invalid NES ROM header');
        return false;
      }

      // Load ROM into NES core
      console.log('[FCEUXEmulator] Calling core.loadRom()...');
      const success = this.core.loadRom(bytes, bytes.length);
      console.log('[FCEUXEmulator] core.loadRom() returned:', success);

      if (success) {
        console.log('✅ loadROM call succeeded');
        return true;
      } else {
        console.error('[FCEUXEmulator] Failed to load ROM into NES core');
        return false;
      }
    } catch (error) {
      console.error('[FCEUXEmulator] Failed to load ROM:', error);
      return false;
    }
  }

  private validateNESHeader(bytes: Uint8Array): boolean {
    console.log('[FCEUXEmulator] Validating NES header:', Array.from(bytes.slice(0, 4)));

    // Check for NES header "NES^Z" (0x4E 0x45 0x53 0x1A)
    const isValid = bytes[0] === 0x4E && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1A;

    if (!isValid) {
      console.error('[FCEUXEmulator] Not a valid NES ROM header');
    } else {
      console.log('[FCEUXEmulator] Valid NES ROM header confirmed');
    }

    return isValid;
  }

  play(): void {
    console.log('[FCEUXEmulator] play() called, running:', this.running, 'ready:', this.ready);

    if (!this.ready || !this.core) {
      console.error('[FCEUXEmulator] Emulator not ready');
      return;
    }

    if (!this.running) {
      this.running = true;
      this.core.setRunning(true);

      console.log('[FCEUXEmulator] Starting game loop...');

      const loop = () => {
        if (!this.running) {
          console.log('[FCEUXEmulator] Game loop stopped');
          return;
        }

        this.core.frame();
        this.blitFrame(); // writes framebuffer to canvas
        this.rafId = requestAnimationFrame(loop);
      };

      if (!this.rafId) {
        this.rafId = requestAnimationFrame(loop);
      }

      // Resume audio context if suspended (autoplay restriction)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      console.log('[FCEUXEmulator] Emulator started');
    }
  }

  pause(): void {
    console.log('[FCEUXEmulator] pause() called, running:', this.running);

    this.running = false;
    this.core.setRunning(false);

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    console.log('[FCEUXEmulator] Emulator paused');
  }

  reset(): void {
    if (this.core && typeof this.core.reset === 'function') {
      this.core.reset();
    } else {
      console.log('[FCEUXEmulator] Reset emulator (stub implementation)');
    }
  }

  stop(): void {
    this.running = false;
    this.core.setRunning(false);

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    console.log('[FCEUXEmulator] Emulator stopped');
  }

  private blitFrame(): void {
    if (!this.ctx || !this.imageData) {
      console.warn('[FCEUXEmulator] blitFrame: ctx or imageData not available');
      return;
    }

    try {
      // Get frame buffer from NES core (RGB format)
      const src = this.core.getFrameBuffer(); // Uint8Array length 256*240*3
      if (!src || src.length !== 256 * 240 * 3) {
        console.warn('[FCEUXEmulator] Invalid frame buffer, length:', src?.length);
        return;
      }

      const w = 256, h = 240;
      const dst = this.imageData.data; // Uint8ClampedArray length 256*240*4

      let si = 0, di = 0;
      for (let i = 0; i < w * h; i++) {
        dst[di++] = src[si++];   // R
        dst[di++] = src[si++];   // G
        dst[di++] = src[si++];   // B
        dst[di++] = 255;         // A
      }

      // Always draw putImageData at (0,0). Don't scale the ImageData; scaling is via canvas pixel size.
      this.ctx.putImageData(this.imageData, 0, 0);

      // Log every ~60 frames for debugging
      this.frameCount++;
      if (this.frameCount % 60 === 0) {
        console.log('[FCEUXEmulator] blit frame #' + this.frameCount);
      }
    } catch (error) {
      console.error('[FCEUXEmulator] blitFrame error:', error);
    }
  }

  private frame(): void {
    // Frame execution is now handled directly in the play() loop
    // This method is kept for backward compatibility but should not be called
    console.warn('[FCEUXEmulator] frame() method should not be called directly - use play() loop');
  }





  private handleAudio(): void {
    if (!this.core || typeof this.core.getAudioBuffer !== 'function') return;

    try {
      const audioBuffer = this.core.getAudioBuffer();
      if (audioBuffer && audioBuffer.length > 0) {
        // Process audio buffer through Web Audio API
        if (this.config.onAudioSample) {
          // For each audio sample pair (stereo)
          for (let i = 0; i < audioBuffer.length; i += 2) {
            this.config.onAudioSample(audioBuffer[i], audioBuffer[i + 1] || 0);
          }
        }
      }
    } catch (error) {
      console.warn('[FCEUXEmulator] Audio processing error:', error);
    }
  }

  setControls(controls: Partial<FCEUXControls>): void {
    if (this.core && typeof this.core.setButton === 'function') {
      // Map controls to NES button indices
      const buttonMap = {
        right: 0,
        left: 1,
        down: 2,
        up: 3,
        start: 4,
        select: 5,
        b: 6,
        a: 7,
      };

      Object.entries(controls).forEach(([button, pressed]) => {
        const buttonIndex = buttonMap[button as keyof FCEUXControls];
        if (buttonIndex !== undefined) {
          this.core.setButton(buttonIndex, pressed);
        }
      });
    } else {
      console.log('[FCEUXEmulator] Controls updated:', controls);
    }
  }

  toggleAudio(enabled: boolean): void {
    this.config.audio = enabled;
    console.log('[FCEUXEmulator] Audio toggled:', enabled);

    if (enabled && this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  isAudioEnabled(): boolean {
    return this.config.audio || false;
  }

  getIsRunning(): boolean {
    return this.running;
  }

  getIsPaused(): boolean {
    return !this.running;
  }

  dispose(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    this.canvas = null;
    this.ctx = null;
    this.imageData = null;
    this.core = null;
    this.memory = null;
    this.ready = false;
    this.running = false;

    console.log('[FCEUXEmulator] Emulator disposed');
  }

  getIsReady(): boolean {
    return this.ready;
  }
}