/**
 * NES Player
 *
 * Manages the game loop, rendering frames to canvas, handling pause/resume and cleanup.
 */

import { NesCore, PixelFormat } from './NesCore';

// Debug logging flag - can be enabled/disabled easily
let ENABLE_FRAME_DEBUG_LOGS = true;

// Export function to control debug logging
export function setFrameDebugLogging(enabled: boolean): void {
  ENABLE_FRAME_DEBUG_LOGS = enabled;
  console.log('[NesPlayer] Frame debug logging:', enabled ? 'ENABLED' : 'DISABLED');
}

export class NesPlayer {
  private ctx: CanvasRenderingContext2D;
  private imageData?: ImageData;
  private rafId: number | null = null;
  private isPlaying = false;
  private visibilityHandler?: () => void;
  private frameCount = 0;
  private debugInitialized = false;

  constructor(private core: NesCore, private canvas: HTMLCanvasElement) {
    console.log('[NesPlayer] Initializing player with canvas:', canvas.width, 'x', canvas.height);

    // Get 2D rendering context
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context from canvas');
    }

    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false; // Preserve pixel art

    // Initial debug logging
    if (ENABLE_FRAME_DEBUG_LOGS) {
      this.logCanvasDebugInfo();
    }

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
   * Log canvas and context debug information
   */
  private logCanvasDebugInfo(): void {
    console.log('[NesPlayer] Canvas Debug Info:', {
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      canvasClientWidth: this.canvas.clientWidth,
      canvasClientHeight: this.canvas.clientHeight,
      contextType: this.ctx.constructor.name,
      imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
      globalAlpha: this.ctx.globalAlpha,
      globalCompositeOperation: this.ctx.globalCompositeOperation
    });

    // Force disable image smoothing and log result
    this.ctx.imageSmoothingEnabled = false;
    console.log('[NesPlayer] Image smoothing forced to:', this.ctx.imageSmoothingEnabled);
  }

  /**
   * Test canvas rendering with a solid red pixel
   */
  private testCanvasRendering(): void {
    if (!ENABLE_FRAME_DEBUG_LOGS) return;

    try {
      // Create a 1x1 red pixel ImageData
      const testPixel = new Uint8ClampedArray([255, 0, 0, 255]); // Red, opaque
      const testImageData = new ImageData(testPixel, 1, 1);

      // Draw test pixel at (100, 100)
      this.ctx.putImageData(testImageData, 100, 100);

      console.log('[NesPlayer] ✅ Test red pixel drawn at (100, 100)');

      // Read back the pixel to verify it was written
      const readBack = this.ctx.getImageData(100, 100, 1, 1);
      console.log('[NesPlayer] Test pixel readback:', Array.from(readBack.data));

    } catch (error) {
      console.error('[NesPlayer] ❌ Test canvas rendering failed:', error);
    }
  }

  /**
   * Log frame buffer preview data
   */
  private logFrameBufferPreview(frameBuffer: Uint8Array): void {
    if (!ENABLE_FRAME_DEBUG_LOGS) return;

    console.log('[NesPlayer] Frame buffer preview (first 32 bytes):', Array.from(frameBuffer.slice(0, 32)));

    // Log some sample pixels from different areas
    const samples = [
      { name: 'Top-left', offset: 0 },
      { name: 'Top-right', offset: (255 * 4) },
      { name: 'Center', offset: ((120 * 256) + 128) * 4 },
      { name: 'Bottom-left', offset: (239 * 256) * 4 },
      { name: 'Bottom-right', offset: ((239 * 256) + 255) * 4 }
    ];

    samples.forEach(sample => {
      if (sample.offset + 3 < frameBuffer.length) {
        const r = frameBuffer[sample.offset];
        const g = frameBuffer[sample.offset + 1];
        const b = frameBuffer[sample.offset + 2];
        const a = frameBuffer[sample.offset + 3];
        console.log(`[NesPlayer] ${sample.name} pixel: RGBA(${r}, ${g}, ${b}, ${a})`);
      }
    });

    // Check for common issues
    const allZero = frameBuffer.every(byte => byte === 0);
    const allMax = frameBuffer.every(byte => byte === 255);
    const hasVariation = new Set(frameBuffer).size > 1;

    console.log('[NesPlayer] Frame buffer analysis:', {
      allZero,
      allMax,
      hasVariation,
      uniqueValues: new Set(frameBuffer.slice(0, 1000)).size // Sample first 1000 bytes
    });
  }

  /**
   * Verify ImageData creation and content
   */
  private verifyImageData(imageData: ImageData, sourceBuffer: Uint8Array): void {
    if (!ENABLE_FRAME_DEBUG_LOGS) return;

    console.log('[NesPlayer] ImageData verification:', {
      width: imageData.width,
      height: imageData.height,
      dataLength: imageData.data.length,
      sourceLength: sourceBuffer.length,
      dataConstructor: imageData.data.constructor.name
    });

    // Check if data was copied correctly
    const firstPixelSource = Array.from(sourceBuffer.slice(0, 4));
    const firstPixelImageData = Array.from(imageData.data.slice(0, 4));

    console.log('[NesPlayer] First pixel comparison:', {
      source: firstPixelSource,
      imageData: firstPixelImageData,
      match: JSON.stringify(firstPixelSource) === JSON.stringify(firstPixelImageData)
    });
  }

  /**
   * Render current frame to canvas
   * TODO: Update to work with new emulator core
   */
  private blit(): void {
    try {
      this.frameCount++;

      // One-time debug initialization
      if (ENABLE_FRAME_DEBUG_LOGS && !this.debugInitialized) {
        this.testCanvasRendering();
        this.debugInitialized = true;
      }

      // TODO: Replace with new emulator core getFrameSpec method
      const { width, height, format } = this.core.getFrameSpec();

      if (ENABLE_FRAME_DEBUG_LOGS && this.frameCount <= 3) {
        console.log(`[NesPlayer] Frame ${this.frameCount} - Frame spec:`, { width, height, format });
      }

      // Get frame buffer with validation
      let src: Uint8Array;
      try {
        // TODO: Replace with new emulator core getFrameBuffer method
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

      // Debug logging for frame buffer
      if (ENABLE_FRAME_DEBUG_LOGS && this.frameCount <= 3) {
        this.logFrameBufferPreview(src);
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

      // Method 1: Try new ImageData constructor (preferred method)
      let imageData: ImageData | undefined;
      let conversionNeeded = false;

      if (format === 'RGBA32' && src.length === expectedSize) {
        try {
          // Direct ImageData creation from frame buffer
          imageData = new ImageData(new Uint8ClampedArray(src), width, height);

          if (ENABLE_FRAME_DEBUG_LOGS && this.frameCount <= 3) {
            console.log('[NesPlayer] ✅ Using direct ImageData constructor');
            this.verifyImageData(imageData, src);
          }
        } catch (error) {
          console.warn('[NesPlayer] Direct ImageData creation failed, falling back to manual method:', error);
          conversionNeeded = true;
        }
      } else {
        conversionNeeded = true;
      }

      // Method 2: Fallback to manual ImageData creation and conversion
      if (conversionNeeded) {
        // Create or recreate ImageData if dimensions changed
        if (!this.imageData || this.imageData.width !== width || this.imageData.height !== height) {
          this.imageData = this.ctx.createImageData(width, height);
          if (ENABLE_FRAME_DEBUG_LOGS) {
            console.log('[NesPlayer] Created new ImageData via context:', width, 'x', height);
          }
        }

        const dst = this.imageData.data; // Uint8ClampedArray (RGBA format)

        // Convert source format to RGBA
        this.convertToRGBA(src, dst, format);
        imageData = this.imageData;

        if (ENABLE_FRAME_DEBUG_LOGS && this.frameCount <= 3) {
          console.log('[NesPlayer] ✅ Using manual conversion method');
          this.verifyImageData(imageData, src);
        }
      }

      // Ensure imageData is defined before drawing
      if (!imageData) {
        console.error('[NesPlayer] Failed to create ImageData, skipping frame');
        return;
      }

      // Verify canvas state before drawing
      if (ENABLE_FRAME_DEBUG_LOGS && this.frameCount <= 3) {
        console.log('[NesPlayer] Pre-draw canvas state:', {
          imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
          globalAlpha: this.ctx.globalAlpha,
          globalCompositeOperation: this.ctx.globalCompositeOperation
        });
      }

      // Draw to canvas
      this.ctx.putImageData(imageData, 0, 0);

      if (ENABLE_FRAME_DEBUG_LOGS && this.frameCount <= 3) {
        console.log(`[NesPlayer] ✅ Frame ${this.frameCount} rendered to canvas`);

        // Verify what was actually drawn by reading back a pixel
        const readback = this.ctx.getImageData(128, 120, 1, 1); // Center pixel
        console.log('[NesPlayer] Center pixel readback:', Array.from(readback.data));
      }

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
   * TODO: Update to work with new emulator core
   */
  play(): void {
    if (this.rafId !== null) {
      console.log('[NesPlayer] Already playing, ignoring play() call');
      return;
    }

    console.log('[NesPlayer] Starting game loop');
    this.isPlaying = true;
    // TODO: Replace with new emulator core setRunning method
    // this.core.setRunning(true);

    const gameLoop = () => {
      if (!this.isPlaying) {
        return; // Exit loop if stopped
      }

      try {
        // TODO: Replace with new emulator core frame method
        // Advance emulator by one frame
        // this.core.frame();

        // Render frame to canvas (keep canvas rendering logic)
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
   * TODO: Update to work with new emulator core
   */
  pause(): void {
    if (this.rafId !== null) {
      console.log('[NesPlayer] Pausing game loop');
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.isPlaying = false;
    // TODO: Replace with new emulator core setRunning method
    // this.core.setRunning(false);
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