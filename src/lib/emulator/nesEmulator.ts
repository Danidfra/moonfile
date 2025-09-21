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
  private animationFrameId: number | null = null;
  private audioContext: AudioContext | null = null;
  private config: NESConfig = {};
  private isRunning = false;
  private isPaused = false;

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
      this.ctx.imageSmoothingEnabled = false;
      this.imageData = this.ctx.createImageData(256, 240);
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
    // frame is 256*240*3 (RGB)
    if (this.config.onFrame) {
      this.config.onFrame(frame);
      return;
    }

    // Default frame rendering
    if (this.ctx && this.imageData) {
      const data = this.imageData.data;
      for (let i = 0, j = 0; i < frame.length; i += 3, j += 4) {
        data[j] = frame[i];     // R
        data[j + 1] = frame[i + 1]; // G
        data[j + 2] = frame[i + 2]; // B
        data[j + 3] = 0xFF;       // A
      }
      this.ctx.putImageData(this.imageData, 0, 0);
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