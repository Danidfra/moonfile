/**
 * NES Player
 *
 * Manages the game loop, rendering frames to canvas, handling pause/resume and cleanup.
 */

import { NesCore, PixelFormat } from './NesCore';

export class NesPlayer {
  private ctx: CanvasRenderingContext2D;
  private imageData?: ImageData;
  private rafId: number | null = null;
  private isPlaying = false;
  private visibilityHandler?: () => void;

  constructor(private core: NesCore, private canvas: HTMLCanvasElement) {
    console.log('[NesPlayer] Initializing player with canvas:', canvas.width, 'x', canvas.height);

    // Get 2D rendering context
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context from canvas');
    }

    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false; // Preserve pixel art

    // Handle page visibility changes (pause when tab is hidden)
    this.visibilityHandler = () => {
      if (document.hidden && this.isPlaying) {
        console.log('[NesPlayer] Page hidden, pausing emulator');
        this.pause();
      } else if (!document.hidden && !this.isPlaying) {
        console.log('[NesPlayer] Page visible, resuming emulator');
        this.play();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);

    console.log('[NesPlayer] Player initialized successfully');
  }

  /**
   * Render current frame to canvas
   */
  private blit(): void {
    try {
      const { width, height, format } = this.core.getFrameSpec();

      // Get frame buffer with validation
      let src: Uint8Array;
      try {
        src = this.core.getFrameBuffer();
      } catch (error) {
        console.error('[NesPlayer] Failed to get frame buffer:', error);
        return; // Skip this frame
      }

      // Validate frame buffer
      if (!src || !ArrayBuffer.isView(src) || !(src.constructor === Uint8Array)) {
        console.error('[NesPlayer] Invalid frame buffer:', {
          type: typeof src,
          isUint8Array: src?.constructor === Uint8Array,
          value: src
        });
        return; // Skip this frame
      }

      // Calculate expected buffer size based on format
      const expectedSize = this.calculateExpectedBufferSize(width, height, format);

      if (src.length !== expectedSize) {
        console.error('[NesPlayer] Frame buffer size mismatch:', {
          format,
          expected: expectedSize,
          actual: src.length,
          dimensions: `${width}x${height}`,
          ratio: src.length / expectedSize
        });

        // Don't skip the frame - try to render what we have
        if (src.length === 0) {
          console.error('[NesPlayer] Frame buffer is empty, skipping frame');
          return;
        }
      }

      // Create or recreate ImageData if dimensions changed
      if (!this.imageData || this.imageData.width !== width || this.imageData.height !== height) {
        this.imageData = this.ctx.createImageData(width, height);
        console.log('[NesPlayer] Created new ImageData:', width, 'x', height);
      }

      const dst = this.imageData.data; // Uint8ClampedArray (RGBA format)

      // Convert source format to RGBA
      this.convertToRGBA(src, dst, format);

      // Draw to canvas
      this.ctx.putImageData(this.imageData, 0, 0);

    } catch (error) {
      console.error('[NesPlayer] Blit error:', error);
    }
  }

  /**
   * Calculate expected buffer size for given format and dimensions
   */
  private calculateExpectedBufferSize(width: number, height: number, format: PixelFormat): number {
    switch (format) {
      case 'RGBA32':
        return width * height * 4;
      case 'RGB24':
        return width * height * 3;
      case 'INDEXED8':
        return width * height;
      default:
        throw new Error(`Unsupported pixel format: ${format}`);
    }
  }

  /**
   * Convert source buffer to RGBA format
   */
  private convertToRGBA(src: Uint8Array, dst: Uint8ClampedArray, format: PixelFormat): void {
    switch (format) {
      case 'RGBA32':
        // Direct copy for RGBA32
        dst.set(src);
        break;

      case 'RGB24': {
        // Convert RGB24 to RGBA32 (add alpha channel)
        let srcIndex = 0;
        let dstIndex = 0;
        while (srcIndex < src.length) {
          dst[dstIndex++] = src[srcIndex++]; // R
          dst[dstIndex++] = src[srcIndex++]; // G
          dst[dstIndex++] = src[srcIndex++]; // B
          dst[dstIndex++] = 255;             // A (opaque)
        }
        break;
      }

      case 'INDEXED8': {
        // Convert indexed color using palette
        const palette = this.core.getPalette?.();
        if (!palette) {
          throw new Error('INDEXED8 format requires palette from core');
        }

        this.convertIndexedToRGBA(src, dst, palette);
        break;
      }

      default:
        throw new Error(`Unsupported pixel format: ${format}`);
    }
  }

  /**
   * Convert indexed color data to RGBA using palette
   */
  private convertIndexedToRGBA(
    src: Uint8Array,
    dst: Uint8ClampedArray,
    palette: Uint8Array | Uint32Array
  ): void {
    const isUint32Palette = palette instanceof Uint32Array;
    let dstIndex = 0;

    for (let i = 0; i < src.length; i++) {
      const colorIndex = src[i] & 0xFF;

      if (isUint32Palette) {
        // Uint32Array palette (packed RGBA)
        const rgba = palette[colorIndex];
        // Assume little-endian RGBA format
        dst[dstIndex++] = (rgba >>> 0) & 0xFF;  // R
        dst[dstIndex++] = (rgba >>> 8) & 0xFF;  // G
        dst[dstIndex++] = (rgba >>> 16) & 0xFF; // B
        dst[dstIndex++] = (rgba >>> 24) & 0xFF; // A
      } else {
        // Uint8Array palette (separate RGBA bytes)
        const baseIndex = colorIndex * 4;
        dst[dstIndex++] = palette[baseIndex + 0] || 0;     // R
        dst[dstIndex++] = palette[baseIndex + 1] || 0;     // G
        dst[dstIndex++] = palette[baseIndex + 2] || 0;     // B
        dst[dstIndex++] = palette[baseIndex + 3] || 255;   // A
      }
    }
  }

  /**
   * Start the game loop
   */
  play(): void {
    if (this.rafId !== null) {
      console.log('[NesPlayer] Already playing, ignoring play() call');
      return;
    }

    console.log('[NesPlayer] Starting game loop');
    this.isPlaying = true;
    this.core.setRunning(true);

    const gameLoop = () => {
      if (!this.isPlaying) {
        return; // Exit loop if stopped
      }

      try {
        // Advance emulator by one frame
        this.core.frame();

        // Render frame to canvas
        this.blit();

        // Schedule next frame
        this.rafId = requestAnimationFrame(gameLoop);
      } catch (error) {
        console.error('[NesPlayer] Game loop error:', error);
        this.pause(); // Stop on error
      }
    };

    // Start the loop
    this.rafId = requestAnimationFrame(gameLoop);
  }

  /**
   * Pause the game loop
   */
  pause(): void {
    if (this.rafId !== null) {
      console.log('[NesPlayer] Pausing game loop');
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.isPlaying = false;
    this.core.setRunning(false);
  }

  /**
   * Check if player is currently playing
   */
  isRunning(): boolean {
    return this.isPlaying;
  }

  /**
   * Clean up resources and stop the player
   */
  dispose(): void {
    console.log('[NesPlayer] Disposing player');

    // Stop the game loop
    this.pause();

    // Remove event listeners
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }

    // Clear canvas
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Clear image data
    this.imageData = undefined;

    console.log('[NesPlayer] Player disposed successfully');
  }
}