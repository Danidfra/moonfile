export type PixelFormat = 'RGB24' | 'RGBA32' | 'INDEXED8';

export interface FrameSpec {
  width: number;   // expect 256
  height: number;  // expect 240
  format: PixelFormat;
}

export interface NesCore {
  init(): Promise<boolean>;
  loadRom(rom: Uint8Array): Promise<boolean>;
  frame(): void;                       // advance one frame
  reset(): void;
  setButton(index: number, pressed: boolean): void;
  setRunning(running: boolean): void;
  getFrameBuffer(): Uint8Array;        // raw pixel buffer
  getFrameSpec(): FrameSpec;           // MUST return format + dims
  getPalette?(): Uint8Array | Uint32Array | null;  // optional, for INDEXED8 format
  getAudioBuffer?(): Int16Array;       // optional
}