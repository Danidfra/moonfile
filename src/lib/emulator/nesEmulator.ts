import { NES } from 'jsnes';

export interface NESControls {
  right: boolean;
  left: boolean;
  down: boolean;
  up: boolean;
  start: boolean;
  select: boolean;
  b: boolean;
  a: boolean;
}

export interface NESConfig {
  audio?: boolean;
  onFrame?: (buffer: Uint8Array) => void;
  onAudioSample?: (left: number, right: number) => void;
}

export class NESEmulator {
  private nes: NES;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;
  private backingBuffer: Uint8ClampedArray | null = null;
  private backingBuffer32: Uint32Array | null = null;
  private animationFrameId: number | null = null;
  private audioContext: AudioContext | null = null;
  private config: NESConfig = {};
  private isRunning = false;
  private isPaused = false;
  private frameCount = 0;

  constructor() {
    console.log('[NESEmulator] constructing NES');
    this.nes = new NES({
      onFrame: (frame: Uint8Array) => this.onFrame?.(frame),
      onStatusUpdate: (s: string) => console.log('[NES]', s),
      sampleRate: this.audioContext?.sampleRate,
    });
    console.log('[NESEmulator] NES ready');
  }

  // Convert Uint8Array to binary string for jsnes
  private u8ToBinaryString(u8: Uint8Array): string {
    // chunk to avoid call stack / max arg issues
    const CHUNK = 0x8000;
    let res = '';
    for (let i = 0; i < u8.length; i += CHUNK) {
      const slice = u8.subarray(i, i + CHUNK);
      res += String.fromCharCode.apply(null, Array.from(slice) as any);
    }
    return res;
  }

  init(canvas: HTMLCanvasElement, config: NESConfig = {}): void {
    console.log('[NESEmulator] init canvas? ', !!canvas);
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
      console.log('[Retro] canvas attr size', canvas.width, canvas.height, 'dpr', dpr);
      console.log('[Retro] CSS size', canvas.getBoundingClientRect());
      console.log('[Retro] imageData', this.imageData.width, this.imageData.height);
    }

    // Initialize audio if enabled
    if (config.audio) {
      this.initAudio();
    }
  }

  private initAudio(): void {
    // Audio disabled for now - will implement later
    console.log('[NESEmulator] Audio initialization skipped (disabled for now)');
    this.config.audio = false;
  }

  loadROM(bytes: Uint8Array): boolean {
    try {
      console.log('[NESEmulator] loadROM bytes:', bytes.length);
      const bin = this.u8ToBinaryString(bytes);
      this.nes.loadROM(bin);
      this.nes.frame();
      return true;
    } catch (error) {
      console.error('Failed to load ROM:', error);
      return false;
    }
  }

  play(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.isPaused = false;
      this.startFrameLoop();

      // Resume audio context if suspended (autoplay restriction)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    }
  }

  pause(): void {
    this.isPaused = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset(): void {
    this.nes.reset();
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private startFrameLoop(): void {
    const frameLoop = () => {
      if (!this.isRunning || this.isPaused) return;

      this.nes.frame();
      this.animationFrameId = requestAnimationFrame(frameLoop);
    };

    frameLoop();
  }

  private onFrame = (frame: Uint8Array): void => {
    // Handle both Uint8Array (RGB) and Uint32Array (0x00RRGGBB) formats
    if (this.config.onFrame) {
      this.config.onFrame(frame);
      return;
    }

    // Default frame rendering
    if (this.ctx && this.imageData && this.backingBuffer && this.backingBuffer32) {
      const dpr = window.devicePixelRatio || 1;

      // Reset transform each frame to prevent accumulation
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear canvas area
      this.ctx.clearRect(0, 0, 256, 240);

      // Check if frame is Uint32Array (0x00RRGGBB format)
      if (frame instanceof Uint32Array) {
        const frame32 = frame as Uint32Array;

        // Convert 0x00RRGGBB to 0xFFRRGGBB in place
        for (let i = 0; i < frame32.length; i++) {
          this.backingBuffer32[i] = 0xFF000000 | frame32[i];
        }
      } else {
        // Handle Uint8Array (RGB format) - copy RGB and add alpha
        for (let i = 0, j = 0; i < frame.length; i += 3, j += 4) {
          this.backingBuffer[j] = frame[i];         // R
          this.backingBuffer[j + 1] = frame[i + 1]; // G
          this.backingBuffer[j + 2] = frame[i + 2]; // B
          this.backingBuffer[j + 3] = 0xFF;         // A
        }
      }

      // Draw single frame with putImageData
      this.ctx.putImageData(this.imageData, 0, 0);

      // Log every 60th frame
      this.frameCount++;
      if (this.frameCount % 60 === 0) {
        console.log('[Retro] draw frame #', this.frameCount, 'putImageData 256x240');
      }

      // Log first frame
      if (this.frameCount === 1) {
        console.log('[Retro] First frame drawn successfully');
      }
    }
  };

  // Audio handling disabled for now
  // private handleAudioSample(left: number, right: number): void {
  //   // Audio disabled for now
  // }

  setControls(controls: Partial<NESControls>): void {
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
      const buttonIndex = buttonMap[button as keyof NESControls];
      if (buttonIndex !== undefined) {
        if (pressed) {
          this.nes.buttonDown(1, buttonIndex);
        } else {
          this.nes.buttonUp(1, buttonIndex);
        }
      }
    });
  }

  toggleAudio(enabled: boolean): void {
    // Audio disabled for now - no-op
    console.log('[NESEmulator] toggleAudio called (disabled for now):', enabled);
    this.config.audio = enabled;
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

    this.canvas = null;
    this.ctx = null;
    this.imageData = null;
    this.animationFrameId = null;
  }
}