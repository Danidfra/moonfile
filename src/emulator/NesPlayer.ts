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
    const { width, height, format } = this.core.getFrameSpec();
    const src = this.core.getFrameBuffer();

    // Guard against wrong lengths
    const expected =
      format === 'RGBA32' ? width * height * 4 :
      format === 'RGB24'  ? width * height * 3 :
      format === 'INDEXED8' ? width * height :
      -1;

    if (src.length !== expected) {
      console.error('[NesPlayer] Unexpected frame length', { format, got: src.length, expected });
      return; // skip drawing this frame
    }

    // Create/recreate ImageData if dimensions changed
    if (!this.imageData || this.imageData.width !== width || this.imageData.height !== height) {
      this.imageData = this.ctx.createImageData(width, height);
    }

    const dst = this.imageData.data; // Uint8ClampedArray

    if (format === 'RGBA32') {
      // 256*240*4 = 245,760
      dst.set(src); // fast path
    } else if (format === 'RGB24') {
      // 256*240*3 = 184,320 → expand to RGBA (alpha 255)
      let si = 0, di = 0;
      while (si < src.length) {
        dst[di++] = src[si++]; // R
        dst[di++] = src[si++]; // G
        dst[di++] = src[si++]; // B
        dst[di++] = 255;       // A
      }
    } else if (format === 'INDEXED8') {
      // 256*240 = 61,440 → expand using the core palette
      const pal = this.core.getPalette?.();
      if (!pal) throw new Error('INDEXED8 without palette');

      // Accept palette either as Uint32 RGBA or Uint8[256*4]
      const useU32 = pal instanceof Uint32Array;
      let di = 0;
      for (let i = 0; i < src.length; i++) {
        const idx = src[i] & 0xff;
        if (useU32) {
          const rgba = pal[idx];     // 0xAABBGGRR or 0xRRGGBBAA depending on core
          // Assume little-endian RGBA: R at byte 0. If colors look swapped, swap order below.
          dst[di++] =  rgba        & 0xff;       // R
          dst[di++] = (rgba >>> 8) & 0xff;       // G
          dst[di++] = (rgba >>>16) & 0xff;       // B
          dst[di++] = (rgba >>>24) & 0xff;       // A
        } else {
          const base = idx * 4;
          dst[di++] = pal[base + 0];  // R
          dst[di++] = pal[base + 1];  // G
          dst[di++] = pal[base + 2];  // B
          dst[di++] = pal[base + 3] ?? 255; // A
        }
      }
    } else {
      throw new Error(`Unsupported frame format: ${format}`);
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