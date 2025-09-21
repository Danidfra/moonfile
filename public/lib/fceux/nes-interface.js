// NES WebAssembly Interface
// Provides JavaScript interface to NES WebAssembly core

class NESInterface {
  constructor() {
    this.wasmModule = null;
    this.wasmInstance = null;
    this.memory = null;
    this.exports = null;
    this.romLoaded = false;
    this.initialized = false;
  }

  async init() {
    console.log('[NES Interface] Initializing NES WebAssembly...');

    try {
      // Load and compile WebAssembly module
      const watResponse = await fetch('/lib/fceux/nes-core.wat');
      const watSource = await watResponse.text();

      // Compile WebAssembly module
      const wasmModule = await WebAssembly.compile(watSource);
      console.log('[NES Interface] WebAssembly module compiled successfully');

      // Create instance
      const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
      const wasmInstance = await WebAssembly.instantiate(wasmModule, { memory });

      this.wasmModule = wasmModule;
      this.wasmInstance = wasmInstance;
      this.memory = memory;
      this.exports = wasmInstance.exports;

      // Initialize NES core
      const initResult = this.exports.init();
      if (initResult) {
        this.initialized = true;
        console.log('[NES Interface] NES core initialized successfully');
        return true;
      } else {
        console.error('[NES Interface] NES core initialization failed');
        return false;
      }
    } catch (error) {
      console.error('[NES Interface] Failed to initialize NES core:', error);
      return false;
    }
  }

  loadROM(romData) {
    if (!this.initialized || !this.exports) {
      console.error('[NES Interface] NES core not initialized');
      return false;
    }

    try {
      console.log('[NES Interface] Loading ROM...', romData.length, 'bytes');

      // Create a copy of ROM data in WASM memory
      const romPtr = this.romData ? this.romData.ptr : this.allocMemory(romData.length);
      const romView = new Uint8Array(this.memory.buffer, romPtr, romData.length);
      romView.set(romData);

      // Load ROM into NES core
      const result = this.exports.loadRom(romPtr, romData.length);

      if (result) {
        this.romLoaded = true;
        this.romData = { ptr: romPtr, size: romData.length };
        console.log('[NES Interface] ROM loaded successfully');

        // Log ROM info
        this.logROMInfo(romData);
        return true;
      } else {
        console.error('[NES Interface] Failed to load ROM');
        return false;
      }
    } catch (error) {
      console.error('[NES Interface] ROM loading error:', error);
      return false;
    }
  }

  logROMInfo(romData) {
    try {
      // Parse NES header
      if (romData.length >= 16) {
        const prgBanks = romData[4];
        const chrBanks = romData[5];
        const flags6 = romData[6];
        const flags7 = romData[7];
        const mapper = (flags6 >> 4) | (flags7 & 0xF0);
        const mirroring = flags6 & 0x01 ? 'horizontal' : 'vertical';
        const hasBattery = (flags6 & 0x02) !== 0;
        const hasTrainer = (flags6 & 0x04) !== 0;
        const isNES2_0 = (flags7 & 0x0C) === 0x08;

        console.log('[NES Interface] ROM Info:', {
          prgBanks,
          chrBanks,
          mapper,
          mirroring,
          hasBattery,
          hasTrainer,
          isNES2_0,
          totalSize: romData.length
        });
      }
    } catch (error) {
      console.warn('[NES Interface] Failed to parse ROM info:', error);
    }
  }

  reset() {
    if (this.exports && this.initialized) {
      this.exports.reset();
      console.log('[NES Interface] NES reset');
    }
  }

  frame() {
    if (this.exports && this.initialized && this.romLoaded) {
      this.exports.runFrame();
    }
  }

  getFrameBuffer() {
    if (this.exports && this.initialized) {
      const framePtr = this.exports.getFrameBuffer();
      if (framePtr) {
        // Check if we have a direct RGBA buffer or indexed buffer + palette
        const palettePtr = this.exports.getPalette();

        if (palettePtr) {
          // Indexed color mode - convert to RGBA
          const palette = new Uint8Array(this.memory.buffer, palettePtr, 192);
          const indexedBuffer = new Uint8Array(this.memory.buffer, framePtr, 256 * 240);

          // Convert indexed to RGBA
          const rgbaBuffer = new Uint8ClampedArray(256 * 240 * 4);

          for (let i = 0; i < indexedBuffer.length; i++) {
            const colorIndex = indexedBuffer[i] & 0x3F; // Limit to 64 colors
            const paletteIndex = colorIndex * 3;

            // Ensure palette index is within bounds
            if (paletteIndex + 2 < palette.length) {
              rgbaBuffer[i * 4] = palette[paletteIndex];     // R
              rgbaBuffer[i * 4 + 1] = palette[paletteIndex + 1]; // G
              rgbaBuffer[i * 4 + 2] = palette[paletteIndex + 2]; // B
              rgbaBuffer[i * 4 + 3] = 255;                  // A
            } else {
              // Fallback to black if palette index is out of bounds
              rgbaBuffer[i * 4] = 0;     // R
              rgbaBuffer[i * 4 + 1] = 0; // G
              rgbaBuffer[i * 4 + 2] = 0; // B
              rgbaBuffer[i * 4 + 3] = 255; // A
            }
          }

          return rgbaBuffer;
        } else {
          // Direct RGBA mode
          return new Uint8ClampedArray(this.memory.buffer, framePtr, 256 * 240 * 4);
        }
      }
    }
    return new Uint8Array(256 * 240 * 4); // Return empty buffer if not available
  }

  getFrameSpec() {
    if (this.exports && this.initialized) {
      const palettePtr = this.exports.getPalette();

      if (palettePtr) {
        // Indexed color mode
        return {
          width: 256,
          height: 240,
          format: 'INDEXED8'
        };
      } else {
        // Direct RGBA mode
        return {
          width: 256,
          height: 240,
          format: 'RGBA32'
        };
      }
    }
    return {
      width: 256,
      height: 240,
      format: 'RGBA32' // fallback
    };
  }

  getPalette() {
    if (this.exports && this.initialized) {
      const palettePtr = this.exports.getPalette();
      if (palettePtr) {
        // Return palette as Uint8Array (RGB format, 64 colors * 3 bytes)
        return new Uint8Array(this.memory.buffer, palettePtr, 192);
      }
    }
    return null;
  }

  getAudioBuffer() {
    if (this.exports && this.initialized && this.romLoaded) {
      // In a real implementation, this would get audio samples from the core
      // For now, return empty buffer
      return new Int16Array(1024);
    }
    return null;
  }

  setButton(button, pressed) {
    if (this.exports && this.initialized) {
      this.exports.setButton(button, pressed ? 1 : 0);
    }
  }

  allocMemory(size) {
    // Simple linear allocation for now
    if (this.memory) {
      const currentSize = this.memory.buffer.byteLength;
      if (currentSize - this.allocOffset >= size) {
        const ptr = this.allocOffset;
        this.allocOffset += size;
        return ptr;
      }
    }

    // Fallback - allocate at end of memory
    return this.memory.buffer.byteLength - size;
  }

  dispose() {
    this.wasmModule = null;
    this.wasmInstance = null;
    this.memory = null;
    this.exports = null;
    this.romLoaded = false;
    this.initialized = false;
    this.allocOffset = 0;
    console.log('[NES Interface] Disposed');
  }
}

// Export the NES interface
window.NESInterface = NESInterface;

console.log('[NES Interface] Module loaded');