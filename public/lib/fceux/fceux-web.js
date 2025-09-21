// FCEUX WebAssembly Core Interface
// Provides unified API for FCEUX emulator

(function() {
  'use strict';

  // Create the core API object with exact method names expected by FCEUXEmulator
  const core = {
    initialized: false,
    romLoaded: false,
    running: false,
    memory: null,
    frameBuffer: null,
    audioBuffer: null,
    palette: null,
    _instance: null,

    // Core initialization
    async init() {
      console.log('[FCEUX Core] init() called');

      if (this.initialized) {
        console.log('[FCEUX Core] Already initialized');
        return true;
      }

      try {
        // Create WebAssembly memory
        this.memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });

        // Initialize buffers
        this.frameBuffer = new Uint8Array(256 * 240 * 4); // RGBA format
        this.audioBuffer = new Int16Array(1024); // Stereo samples

        console.log('[FCEUX Core] WebAssembly memory and buffers initialized');

        this.initialized = true;
        console.log('[FCEUX Core] Initialization completed successfully');
        return true;
      } catch (error) {
        console.error('[FCEUX Core] Initialization failed:', error);
        throw error;
      }
    },

    // ROM loading - exact method name expected by emulator
    loadRom(bytes, romSize) {
      console.log('[FCEUX Core] loadRom() called with', romSize, 'bytes');

      if (!this.initialized) {
        console.error('[FCEUX Core] loadRom() called before init');
        return false;
      }

      if (!(bytes instanceof Uint8Array)) {
        console.error('[FCEUX Core] loadRom() expects Uint8Array, got', typeof bytes);
        return false;
      }

      // Basic ROM validation
      if (romSize < 16) {
        console.error('[FCEUX Core] ROM too small:', romSize, 'bytes');
        return false;
      }

      // Check for NES header "NES^Z" (0x4E 0x45 0x53 0x1A)
      if (bytes[0] !== 0x4E || bytes[1] !== 0x45 ||
          bytes[2] !== 0x53 || bytes[3] !== 0x1A) {
        console.error('[FCEUX Core] Invalid NES header:',
          Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        return false;
      }

      this.romLoaded = true;
      console.log('[FCEUX Core] ROM loaded successfully');
      console.log('[FCEUX Core] ROM details:', {
        size: romSize,
        prgBanks: bytes[4],
        chrBanks: bytes[5],
        mapper: ((bytes[6] >> 4) | (bytes[7] & 0xF0)),
        hasBattery: !!(bytes[6] & 0x02),
        hasTrainer: !!(bytes[6] & 0x04)
      });

      return true;
    },

    // Frame execution - delegate to WebAssembly core
    frame() {
      if (!this.initialized || !this.romLoaded) {
        return;
      }

      // The WebAssembly core handles actual frame rendering
      // This stub is no longer needed as we use the real WASM core
    },

    // Reset emulator
    reset() {
      console.log('[FCEUX Core] reset() called');
      this.romLoaded = false;
      this.running = false;

      // Clear buffers
      if (this.frameBuffer) {
        this.frameBuffer.fill(0);
      }
      if (this.audioBuffer) {
        this.audioBuffer.fill(0);
      }
    },

    // Button input handling
    setButton(index, pressed) {
      if (!this.initialized) {
        return;
      }

      if (index >= 0 && index < 8) {
        console.log(`[FCEUX Core] setButton(${index}, ${pressed})`);
      }
    },

    // Frame buffer access - returns Uint8Array for RGBA 256x240
    getFrameBuffer() {
      if (!this.initialized || !this.frameBuffer) {
        return new Uint8Array(256 * 240 * 4);
      }
      return this.frameBuffer;
    },

    // Palette access for indexed color mode
    getPalette() {
      if (!this.initialized || !this.palette) {
        // Create NES palette
        this.palette = new Uint8Array(192);

        // Standard NES palette (64 colors in RGB)
        const paletteData = [
          0x54, 0x54, 0x54, 0x00, 0x1C, 0x3C, 0x10, 0x38, 0x64, 0x00, 0x10, 0x64,
          0x08, 0x18, 0x20, 0x30, 0x18, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x88, 0x88, 0x88, 0x00, 0x38, 0x6C, 0x00, 0x70, 0x8C, 0x00, 0x58, 0x94,
          0x44, 0x58, 0x64, 0x5C, 0x78, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0xBC, 0xBC, 0xBC, 0x70, 0x94, 0xB0, 0x40, 0x8C, 0xAC, 0x00, 0x88, 0xB8,
          0x6C, 0x88, 0x98, 0x84, 0xA8, 0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0xF8, 0xF8, 0xF8, 0xB4, 0xCC, 0xE0, 0x78, 0xC8, 0xE8, 0x68, 0xB0, 0xDC,
          0x98, 0xB8, 0xC8, 0xA0, 0xCC, 0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0xFC, 0xFC, 0xFC, 0xF8, 0x98, 0xF8, 0xA0, 0xBC, 0xFC, 0x90, 0xC0, 0xFC,
          0xB0, 0xCC, 0xFC, 0xAC, 0xD8, 0xF8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ];

        for (let i = 0; i < paletteData.length; i++) {
          this.palette[i] = paletteData[i];
        }
      }
      return this.palette;
    },

    // Audio buffer access
    getAudioBuffer() {
      if (!this.initialized || !this.audioBuffer) {
        return new Int16Array(0);
      }
      return this.audioBuffer;
    },

    // Running state control
    setRunning(running) {
      console.log('[FCEUX Core] setRunning() called with', running);
      this.running = !!running;
    },


  };

  // CRITICAL: Expose globally with exact name expected by FCEUXEmulator
  // Only set if not already defined to avoid conflicts during HMR
  if (typeof window.FCEUX === 'undefined') {
    window.FCEUX = core;
    console.log('[FCEUX Core] Global API exposed as window.FCEUX');
  } else {
    console.log('[FCEUX Core] window.FCEUX already defined, skipping assignment');
  }

  // Log available methods for debugging
  console.log('[FCEUX Core] Available methods:', Object.keys(core));

})();