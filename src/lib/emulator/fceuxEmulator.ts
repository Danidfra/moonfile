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
  private wasmModule: any = null;
  private wasmInstance: any = null;
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
  private isInitialized = false;
  private memory: WebAssembly.Memory | null = null;

  constructor() {
    console.log('[FCEUXEmulator] constructing FCEUX emulator');
  }

  async init(canvas: HTMLCanvasElement, config: FCEUXConfig = {}): Promise<void> {
    console.log('[FCEUXEmulator] init canvas? ', !!canvas);

    if (this.isInitialized) {
      console.log('[FCEUXEmulator] Already initialized');
      return;
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;

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

    // Initialize WebAssembly module
    try {
      await this.initWebAssembly();
      this.isInitialized = true;
      console.log('[FCEUXEmulator] FCEUX initialized successfully');
    } catch (error) {
      console.error('[FCEUXEmulator] Failed to initialize WebAssembly:', error);
      throw error;
    }

    // Initialize audio if enabled
    if (config.audio) {
      this.initAudio();
    }
  }

  private async initWebAssembly(): Promise<void> {
    console.log('[FCEUXEmulator] Initializing WebAssembly module...');

    try {
      // Load FCEUX WebAssembly script
      await this.loadFCEUXScript();

      // Wait for FCEUX to be available
      await this.waitForFCEUX();

      // Initialize FCEUX
      if (typeof (window as any).FCEUX !== 'undefined') {
        this.wasmModule = (window as any).FCEUX;
        this.wasmInstance = await this.wasmModule.init();
        this.memory = this.wasmInstance.memory;

        console.log('[FCEUXEmulator] FCEUX WebAssembly module loaded successfully');
      } else {
        throw new Error('FCEUX WebAssembly module not found');
      }
    } catch (error) {
      console.error('[FCEUXEmulator] WebAssembly initialization failed:', error);
      throw new Error('Failed to initialize FCEUX WebAssembly module');
    }
  }

  private loadFCEUXScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/lib/fceux/fceux-web.js';
      script.async = true;

      script.onload = () => {
        console.log('[FCEUXEmulator] FCEUX script loaded');
        resolve();
      };

      script.onerror = () => {
        reject(new Error('Failed to load FCEUX WebAssembly script'));
      };

      document.head.appendChild(script);
    });
  }

  private waitForFCEUX(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkFCEUX = () => {
        if (typeof (window as any).FCEUX !== 'undefined') {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('FCEUX WebAssembly module not available within timeout'));
        } else {
          setTimeout(checkFCEUX, 100);
        }
      };

      checkFCEUX();
    });
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
    try {
      console.log('[FCEUXEmulator] loadROM bytes:', bytes.length);

      // Validate NES header
      if (!this.validateNESHeader(bytes)) {
        console.error('[FCEUXEmulator] Invalid NES ROM header');
        return false;
      }

      // Load ROM into FCEUX WebAssembly module
      if (this.wasmInstance && this.wasmInstance.loadRom) {
        // Convert Uint8Array to a format FCEUX can understand
        const romData = new Uint8Array(bytes);
        this.wasmInstance.loadRom(romData);
        console.log('[FCEUXEmulator] ROM loaded successfully into FCEUX');
      } else {
        // Fallback to stub implementation
        console.log('[FCEUXEmulator] ROM loaded successfully (stub implementation)');
      }

      return true;
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
    if (!this.isInitialized) {
      console.error('[FCEUXEmulator] Emulator not initialized');
      return;
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.isPaused = false;

      // Signal FCEUX to start running
      if (this.wasmInstance && this.wasmInstance.setRunning) {
        this.wasmInstance.setRunning(true);
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
    if (this.wasmInstance && this.wasmInstance.reset) {
      this.wasmInstance.reset();
    } else {
      console.log('[FCEUXEmulator] Reset emulator (stub implementation)');
    }
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;

    // Signal FCEUX to stop running
    if (this.wasmInstance && this.wasmInstance.setRunning) {
      this.wasmInstance.setRunning(false);
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
    // Execute FCEUX frame
    if (this.wasmInstance && this.wasmInstance.frame) {
      this.wasmInstance.frame();
    }

    // Handle frame rendering
    if (this.config.onFrame) {
      // Get frame buffer from FCEUX if available
      let frameBuffer: Uint8Array;
      if (this.wasmInstance && this.wasmInstance.getFrameBuffer) {
        frameBuffer = this.wasmInstance.getFrameBuffer();
      } else {
        // Generate a test frame pattern for stub implementation
        frameBuffer = new Uint8Array(256 * 240 * 3);
        this.generateTestFrame(frameBuffer);
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

        // Get frame from FCEUX or generate test pattern
        if (this.wasmInstance && this.wasmInstance.getFrameBuffer) {
          const frameBuffer = this.wasmInstance.getFrameBuffer();
          this.copyFrameBufferToImageData(frameBuffer);
        } else {
          this.generateTestFrameRGB(this.backingBuffer32);
        }

        // Draw single frame with putImageData
        this.ctx.putImageData(this.imageData, 0, 0);

        // Log every 60th frame
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
          console.log('[FCEUX] draw frame #', this.frameCount, 'putImageData 256x240');
        }

        // Log first frame
        if (this.frameCount === 1) {
          console.log('[FCEUX] First frame drawn successfully');
        }
      }
    }

    // Handle audio if enabled
    if (this.config.audio && this.audioContext && this.wasmInstance && this.wasmInstance.getAudioBuffer) {
      this.handleAudio();
    }
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
    // Generate a simple test pattern
    for (let y = 0; y < 240; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 3;

        // Create a simple gradient pattern
        buffer[i] = (x % 64) * 4;     // R
        buffer[i + 1] = (y % 64) * 4; // G
        buffer[i + 2] = 128;           // B
      }
    }
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
    if (!this.wasmInstance || !this.wasmInstance.getAudioBuffer) return;

    try {
      const audioBuffer = this.wasmInstance.getAudioBuffer();
      if (audioBuffer && audioBuffer.length > 0) {
        // Process audio buffer through Web Audio API
        // This is a simplified implementation
        if (this.config.onAudioSample) {
          // For each audio sample pair
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
    if (this.wasmInstance && this.wasmInstance.setButton) {
      // Map controls to FCEUX button indices
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
          this.wasmInstance.setButton(buttonIndex, pressed ? 1 : 0);
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
    this.wasmModule = null;
    this.wasmInstance = null;
    this.memory = null;
    this.isInitialized = false;

    console.log('[FCEUXEmulator] Emulator disposed');
  }
}