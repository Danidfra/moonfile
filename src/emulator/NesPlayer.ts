import { NesCore, FrameSpec, PixelFormat } from './NesCore';

export class NesPlayer {
  private ctx: CanvasRenderingContext2D;
  private imageData?: ImageData;
  private rafId: number | null = null;
  private visibilityHandler?: () => void;

  constructor(private core: NesCore, private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D context unavailable');
    
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    // Handle visibility changes
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.play();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private blit() {
    const spec = this.core.getFrameSpec();
    const fb = this.core.getFrameBuffer();
    const { width, height, format } = spec;

    const expected = width * height * (format === 'RGB24' ? 3 : 4);

    if (!fb || fb.length !== expected) {
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.warn('[NesPlayer] Unexpected frame buffer length', {
          got: fb?.length,
          expected,
          format,
          width,
          height
        });
      }
      return; // skip this frame
    }

    if (!this.imageData || this.imageData.width !== width || this.imageData.height !== height) {
      this.imageData = this.ctx.createImageData(width, height);
      
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[NesPlayer] Created new ImageData:', width, 'x', height, 'format:', format);
      }
    }

    const dst = this.imageData.data; // RGBA
    
    if (format === 'RGB24') {
      // expand RGB -> RGBA
      for (let si = 0, di = 0; si < fb.length; ) {
        dst[di++] = fb[si++]; // R
        dst[di++] = fb[si++]; // G
        dst[di++] = fb[si++]; // B
        dst[di++] = 255;      // A
      }
    } else {
      // RGBA32 -> copy as-is
      dst.set(fb);
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  play() {
    if (this.rafId !== null) return; // Already playing

    this.core.setRunning(true);
    
    const loop = () => {
      this.core.frame();
      this.blit();
      this.rafId = requestAnimationFrame(loop);
    };
    
    this.rafId = requestAnimationFrame(loop);
    
    if (localStorage.getItem('debug')?.includes('retro:*')) {
      console.log('[NesPlayer] Started game loop');
    }
  }

  pause() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.core.setRunning(false);
      
      if (localStorage.getItem('debug')?.includes('retro:*')) {
        console.log('[NesPlayer] Paused game loop');
      }
    }
  }

  dispose() {
    this.pause();
    
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }
    
    if (localStorage.getItem('debug')?.includes('retro:*')) {
      console.log('[NesPlayer] Disposed');
    }
  }
}