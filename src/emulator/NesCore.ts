/**
 * NES Emulator Core Interface
 * 
 * This interface defines the contract for NES emulator cores.
 * Implementations should handle WebAssembly loading, ROM management,
 * frame rendering, and input handling.
 */

export type PixelFormat = 'RGB24' | 'RGBA32' | 'INDEXED8';

export interface FrameSpec {
  width: number;   // Expected: 256
  height: number;  // Expected: 240
  format: PixelFormat;
}

export interface NesCore {
  /**
   * Initialize the emulator core
   * @returns Promise that resolves to true if initialization succeeded
   */
  init(): Promise<boolean>;

  /**
   * Load a ROM into the emulator
   * @param rom The ROM data as a Uint8Array
   * @returns Promise that resolves to true if ROM was loaded successfully
   */
  loadRom(rom: Uint8Array): Promise<boolean>;

  /**
   * Advance the emulator by one frame
   */
  frame(): void;

  /**
   * Reset the emulator to initial state
   */
  reset(): void;

  /**
   * Set button state for controller input
   * @param index Button index (0-7: right, left, down, up, start, select, b, a)
   * @param pressed Whether the button is pressed
   */
  setButton(index: number, pressed: boolean): void;

  /**
   * Set the running state of the emulator
   * @param running Whether the emulator should be running
   */
  setRunning(running: boolean): void;

  /**
   * Get the current frame buffer
   * @returns Raw pixel buffer data
   */
  getFrameBuffer(): Uint8Array;

  /**
   * Get the frame specification (dimensions and format)
   * @returns Frame specification object
   */
  getFrameSpec(): FrameSpec;

  /**
   * Get the color palette (optional, for INDEXED8 format)
   * @returns Palette data or null if not available
   */
  getPalette?(): Uint8Array | Uint32Array | null;

  /**
   * Get audio buffer (optional)
   * @returns Audio sample buffer or empty array if not available
   */
  getAudioBuffer?(): Int16Array;
}