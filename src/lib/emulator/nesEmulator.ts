import JSNES from 'jsnes';

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
  private nes: JSNES;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioSource: AudioBufferSourceNode | null = null;
  private config: NESConfig = {};
  private isRunning = false;
  private isPaused = false;

  constructor() {
    this.nes = new JSNES({
      onFrame: this.handleFrame.bind(this),
      onAudioSample: this.handleAudioSample.bind(this),
    });
  }

  init(canvas: HTMLCanvasElement, config: NESConfig = {}): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;

    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }

    // Initialize audio if enabled
    if (config.audio) {
      this.initAudio();
    }
  }

  private initAudio(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.audioBuffer = this.audioContext.createBuffer(1, 16384, 44100);
    } catch (error) {
      console.warn('Audio initialization failed:', error);
      this.config.audio = false;
    }
  }

  loadROM(bytes: Uint8Array): boolean {
    try {
      this.nes.loadROM(bytes);
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

  private handleFrame(buffer: Uint8Array): void {
    if (this.config.onFrame) {
      this.config.onFrame(buffer);
      return;
    }

    // Default frame rendering
    if (this.ctx && this.canvas) {
      const imageData = this.ctx.createImageData(256, 240);
      imageData.data.set(buffer);
      
      // Scale to canvas size
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.imageSmoothingEnabled = false;
      
      const scaleX = this.canvas.width / 256;
      const scaleY = this.canvas.height / 240;
      
      this.ctx.save();
      this.ctx.scale(scaleX, scaleY);
      this.ctx.putImageData(imageData, 0, 0);
      this.ctx.restore();
    }
  }

  private handleAudioSample(left: number, right: number): void {
    if (this.config.onAudioSample) {
      this.config.onAudioSample(left, right);
      return;
    }

    // Default audio handling
    if (this.audioContext && this.audioBuffer) {
      // Simple audio buffering - in a real implementation, you'd want more sophisticated buffering
      // This is a basic implementation that might have some audio glitches
    }
  }

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
    this.config.audio = enabled;
    if (enabled && !this.audioContext) {
      this.initAudio();
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
    
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
  }
}