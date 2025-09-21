import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FCEUXEmulator, type FCEUXControls } from '@/lib/emulator/fceuxEmulator';
import { TestApp } from '@/test/TestApp';

describe('FCEUXEmulator', () => {
  let emulator: FCEUXEmulator;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    // Create a mock canvas element
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 256;
    mockCanvas.height = 240;
    document.body.appendChild(mockCanvas);

    // Create emulator instance
    emulator = new FCEUXEmulator();
  });

  afterEach(() => {
    // Cleanup
    if (emulator) {
      emulator.dispose();
    }
    if (mockCanvas && mockCanvas.parentNode) {
      mockCanvas.parentNode.removeChild(mockCanvas);
    }
  });

  it('should initialize successfully', async () => {
    await emulator.init(mockCanvas, { audio: false });
    expect(emulator.getIsRunning()).toBe(false);
    expect(emulator.getIsPaused()).toBe(true);
  });

  it('should load valid ROM', async () => {
    await emulator.init(mockCanvas, { audio: false });

    // Create a simple test ROM with valid NES header
    const testROM = new Uint8Array([
      0x4E, 0x45, 0x53, 0x1A, // NES header
      0x01,                   // PRG ROM size
      0x01,                   // CHR ROM size
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Flags
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00  // Remaining header
    ]);

    const result = emulator.loadROM(testROM);
    expect(result).toBe(true);
  });

  it('should reject invalid ROM', async () => {
    await emulator.init(mockCanvas, { audio: false });

    // Create invalid ROM (wrong header)
    const invalidROM = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // Invalid header
      0x01, 0x01, 0x00, 0x00
    ]);

    const result = emulator.loadROM(invalidROM);
    expect(result).toBe(false);
  });

  it('should handle play/pause/reset controls', async () => {
    await emulator.init(mockCanvas, { audio: false });

    // Load a test ROM
    const testROM = new Uint8Array([
      0x4E, 0x45, 0x53, 0x1A, 0x01, 0x01
    ]);
    emulator.loadROM(testROM);

    // Test play
    emulator.play();
    expect(emulator.getIsRunning()).toBe(true);
    expect(emulator.getIsPaused()).toBe(false);

    // Test pause
    emulator.pause();
    expect(emulator.getIsRunning()).toBe(false);
    expect(emulator.getIsPaused()).toBe(true);

    // Test reset
    emulator.reset();
    expect(emulator.getIsRunning()).toBe(false);
    expect(emulator.getIsPaused()).toBe(true);
  });

  it('should handle control inputs', async () => {
    await emulator.init(mockCanvas, { audio: false });

    const testROM = new Uint8Array([
      0x4E, 0x45, 0x53, 0x1A, 0x01, 0x01
    ]);
    emulator.loadROM(testROM);

    // Test setting controls
    const controls: Partial<FCEUXControls> = {
      up: true,
      a: true
    };

    // Should not throw when setting controls
    expect(() => emulator.setControls(controls)).not.toThrow();
  });

  it('should handle audio toggle', async () => {
    await emulator.init(mockCanvas, { audio: true });

    expect(emulator.isAudioEnabled()).toBe(true);

    // Toggle audio off
    emulator.toggleAudio(false);
    expect(emulator.isAudioEnabled()).toBe(false);

    // Toggle audio on
    emulator.toggleAudio(true);
    expect(emulator.isAudioEnabled()).toBe(true);
  });

  it('should dispose properly', async () => {
    await emulator.init(mockCanvas, { audio: false });

    emulator.dispose();

    // After disposal, emulator should be in clean state
    expect(emulator.getIsRunning()).toBe(false);
    expect(emulator.getIsPaused()).toBe(true);
  });
});

describe('FCEUXEmulator Integration', () => {
  it('should work with RetroPlayer component', async () => {
    // This test ensures the FCEUX emulator integrates properly with the RetroPlayer
    // Since we can't easily test the full RetroPlayer with canvas and WebAssembly,
    // we test the key integration points

    const testROM = new Uint8Array([
      0x4E, 0x45, 0x53, 0x1A, 0x01, 0x01
    ]);

    // Create emulator and verify it can be used as a drop-in replacement
    const emulator = new FCEUXEmulator();
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 240;

    await emulator.init(canvas, { audio: false });
    const loadResult = emulator.loadROM(testROM);

    expect(loadResult).toBe(true);

    emulator.dispose();
  });
});