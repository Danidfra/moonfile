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
  private backingBuffer: Uint8ClampedArray | null = null;
  private backingBuffer32: Uint32Array | null = null;
  private animationFrameId: number | null = null;
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private config: FCEUXConfig = {};
  private isRunning = false;
  private isPaused = false;
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
    this.ctx = canvas.getContext('2d');
    this.config = opts;

    if (this.ctx) {
      // Set canvas attributes directly (not just CSS)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = 256 * dpr;
      canvas.height = 240 * dpr;

      // CSS sizing for layout
      canvas.style.width = '100%';
      canvas.style.height = 'auto';

      // Set up transform and create backbuffer
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;

      // Create single ImageData and backing buffer
      this.imageData = this.ctx.createImageData(256, 240);
      this.backingBuffer = new Uint8ClampedArray(this.imageData.data.buffer);
      this.backingBuffer32 = new Uint32Array(this.imageData.data.buffer);

      // Log diagnostics
      console.log('[FCEUX] canvas attr size', canvas.width, canvas.height, 'dpr', dpr);
      console.log('[FCEUX] CSS size', canvas.getBoundingClientRect());
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
    if (!this.ready || !this.core) {
      console.error('[FCEUXEmulator] Emulator not ready');
      return;
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.isPaused = false;

      // Signal FCEUX to start running
      if (this.core && typeof this.core.setRunning === 'function') {
        this.core.setRunning(true);
      }

      this.startFrameLoop();

      // Resume audio context if suspended (autoplay restriction)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      console.log('[FCEUXEmulator] Emulator started');
    }
  }

  pause(): void {
    this.isPaused = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
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
    this.isRunning = false;
    this.isPaused = false;

    // Signal FCEUX to stop running
    if (this.core && typeof this.core.setRunning === 'function') {
      this.core.setRunning(false);
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log('[FCEUXEmulator] Emulator stopped');
  }

  private startFrameLoop(): void {
    const frameLoop = () => {
      if (!this.isRunning || this.isPaused) return;

      this.frame();
      this.animationFrameId = requestAnimationFrame(frameLoop);
    };

    frameLoop();
  }

  private frame(): void {
    // Execute NES core frame
    if (this.core && typeof this.core.frame === 'function') {
      this.core.frame();
    }

    // Handle frame rendering
    if (this.config.onFrame) {
      // Get frame buffer from NES core
      let frameBuffer: Uint8Array;
      if (this.core && typeof this.core.getFrameBuffer === 'function') {
        const framePtr = this.core.getFrameBuffer();
        const palettePtr = typeof this.core.getPalette === 'function' ? this.core.getPalette() : null;

        if (framePtr && palettePtr) {
          // Indexed color mode with palette - not implemented yet
          frameBuffer = new Uint8Array(256 * 240 * 4);
        } else if (framePtr) {
          // Direct RGBA mode - core returns Uint8Array directly
          frameBuffer = this.core.getFrameBuffer();
        } else {
          // NES core not available - this is an error state
          console.warn('[FCEUXEmulator] NES core frame buffer not available');
          frameBuffer = new Uint8Array(256 * 240 * 4);
        }
      } else {
        // NES core not available - this is an error state
        console.warn('[FCEUXEmulator] NES core not available for frame rendering');
        frameBuffer = new Uint8Array(256 * 240 * 4);
      }
      this.config.onFrame(frameBuffer);
    } else {
      // Default frame rendering
      if (this.ctx && this.imageData && this.backingBuffer && this.backingBuffer32) {
        const dpr = window.devicePixelRatio || 1;

        // Reset transform each frame to prevent accumulation
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear canvas area
        this.ctx.clearRect(0, 0, 256, 240);

        // Get frame from NES core
        if (this.core && typeof this.core.getFrameBuffer === 'function') {
          const framePtr = this.core.getFrameBuffer();
          const palettePtr = typeof this.core.getPalette === 'function' ? this.core.getPalette() : null;

          if (palettePtr) {
            // Indexed color mode - convert to RGBA
            this.copyIndexedBufferToImageData(framePtr, palettePtr);
          } else {
            // Direct RGBA mode - core returns Uint8Array directly
            const frameData = this.core.getFrameBuffer();
            if (frameData && frameData.length === 256 * 240 * 4) {
              this.imageData.data.set(frameData);
            } else {
              this.generateTestFrameRGB(this.backingBuffer32);
            }
          }
        } else {
          this.generateTestFrameRGB(this.backingBuffer32);
        }

        // Draw single frame with putImageData
        this.ctx.putImageData(this.imageData, 0, 0);

        // Log first frame only
        if (this.frameCount === 0) {
          console.log('[FCEUX] First frame drawn successfully - NES core active');
          this.frameCount++;
        }
      }
    }

    // Handle audio if enabled
    if (this.config.audio && this.audioContext && this.core && typeof this.core.getAudioBuffer === 'function') {
      this.handleAudio();
    }
  }

  private copyIndexedBufferToImageData(framePtr: number, palettePtr: number): void {
    if (!this.backingBuffer32 || !this.memory) return;

    // Get indexed buffer and palette from WASM memory
    const indexedBuffer = new Uint8Array(this.memory.buffer, framePtr, 256 * 240);
    const palette = new Uint8Array(this.memory.buffer, palettePtr, 192);

    // Convert indexed colors to RGBA
    for (let i = 0, j = 0; i < indexedBuffer.length; i++, j += 1) {
      const colorIndex = indexedBuffer[i] & 0x3F;
      const paletteIndex = colorIndex * 3;

      this.backingBuffer32[j] = 0xFF000000 |
        (palette[paletteIndex] << 16) |
        (palette[paletteIndex + 1] << 8) |
        (palette[paletteIndex + 2]);
    }
  }

  private convertIndexedToRGBA(framePtr: number, palettePtr: number): Uint8Array {
    if (!this.memory) {
      return new Uint8Array(256 * 240 * 4);
    }

    // Get indexed buffer and palette from WASM memory
    const indexedBuffer = new Uint8Array(this.memory.buffer, framePtr, 256 * 240);
    const palette = new Uint8Array(this.memory.buffer, palettePtr, 192);

    // Convert indexed colors to RGBA
    const rgbaBuffer = new Uint8Array(256 * 240 * 4);

    for (let i = 0, j = 0; i < indexedBuffer.length; i++, j += 4) {
      const colorIndex = indexedBuffer[i] & 0x3F;
      const paletteIndex = colorIndex * 3;

      rgbaBuffer[j] = palette[paletteIndex];     // R
      rgbaBuffer[j + 1] = palette[paletteIndex + 1]; // G
      rgbaBuffer[j + 2] = palette[paletteIndex + 2]; // B
      rgbaBuffer[j + 3] = 255;                  // A
    }

    return rgbaBuffer;
  }

  private copyFrameBufferToImageData(frameBuffer: Uint8Array): void {
    if (!this.backingBuffer32) return;

    // Convert FCEUX RGB buffer to RGBA
    for (let i = 0, j = 0; i < frameBuffer.length; i += 3, j += 1) {
      const r = frameBuffer[i];
      const g = frameBuffer[i + 1];
      const b = frameBuffer[i + 2];
      this.backingBuffer32[j] = 0xFF000000 | (r << 16) | (g << 8) | b;
    }
  }

  private generateTestFrame(buffer: Uint8Array): void {
    // This method should not be called with a real NES core
    // Only provide a fallback if NES core is not available
    console.warn('[FCEUXEmulator] generateTestFrame called - NES core should provide frames');

    // Generate a minimal test pattern (black screen)
    buffer.fill(0);
  }

  private generateTestFrameRGB(buffer32: Uint32Array): void {
    // Generate a simple test pattern in RGBA format
    for (let y = 0; y < 240; y++) {
      for (let x = 0; x < 256; x++) {
        const i = y * 256 + x;

        // Create a simple gradient pattern
        const r = (x % 64) * 4;
        const g = (y % 64) * 4;
        const b = 128;

        buffer32[i] = 0xFF000000 | (r << 16) | (g << 8) | b;
      }
    }
  }

  private handleAudio(): void {
    if (!this.wasmModule || !this.wasmModule.getAudioBuffer) return;

    try {
      const audioBuffer = this.wasmModule.getAudioBuffer();
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
    return this.isRunning && !this.isPaused;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  dispose(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.canvas = null;
    this.ctx = null;
    this.imageData = null;
    this.backingBuffer = null;
    this.backingBuffer32 = null;
    this.core = null;
    this.memory = null;
    this.ready = false;

    console.log('[FCEUXEmulator] Emulator disposed');
  }

  isAudioEnabled(): boolean {
    return this.config.audio || false;
  }

  getIsRunning(): boolean {
    return this.isRunning && !this.isPaused;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getIsReady(): boolean {
    return this.ready;
  }
}