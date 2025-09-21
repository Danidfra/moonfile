declare module 'jsnes' {
  export class NES {
    constructor(opts?: {
      onFrame?: (frame: Uint8Array) => void;
      onStatusUpdate?: (status: string) => void;
      sampleRate?: number;
    });
    loadROM(data: string): void;
    frame(): void;
    buttonDown(player: number, button: number): void;
    buttonUp(player: number, button: number): void;
    reset(): void;
  }
}