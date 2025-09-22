# NES Emulator Integration Guide

## Current Status

The project now includes a **complete NES emulator architecture** with proper WASM loading, validation, and error handling. The current implementation uses a **demo WebAssembly core** (826 bytes) that validates the integration but doesn't execute real ROM code.

## What's Working

✅ **WASM Loading & Validation**
- Loads WASM files with cache-busting and integrity checks
- Validates file size, magic bytes, and version
- Serves WASM with correct headers (`application/wasm`, no compression)
- Fails fast with clear error messages for invalid files

✅ **ROM Processing** 
- Decodes base64 ROM data from Nostr events (kind 31996)
- Validates NES header (NES\x1A) and ROM structure
- Extracts mapper, PRG/CHR banks, and other metadata
- Computes SHA256 hash for verification

✅ **Emulator Architecture**
- Clean `NesCore` interface for any emulator implementation
- `FCEUXWebAdapter` handles WASM instantiation and exports
- `NesPlayer` manages game loop, canvas rendering, and cleanup
- Proper keyboard controls and state management

✅ **UI Integration**
- GamePage reads Nostr events and initializes emulator
- Comprehensive error handling with user-friendly messages
- Debug logging for each phase of initialization
- Proper cleanup on component unmount

## Demo Core Capabilities

The current 826-byte demo core provides:

- ✅ **Valid WASM structure** with proper exports
- ✅ **ROM loading** with NES header validation
- ✅ **Frame generation** based on button inputs (demo pattern)
- ✅ **Control mapping** for all 8 NES buttons
- ✅ **Memory management** with frame buffer and palette
- ✅ **Integration testing** to verify the complete pipeline

**What it shows:** A colorful pattern that changes when you press buttons, confirming that the entire emulator pipeline works correctly.

## Integrating a Real Emulator

To replace the demo core with a real NES emulator:

### Option 1: Compile FCEUX to WebAssembly

```bash
# Clone FCEUX source
git clone https://github.com/TASEmulators/fceux.git
cd fceux

# Install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Configure FCEUX for WebAssembly
mkdir build-wasm
cd build-wasm
emconfigure cmake .. -DCMAKE_BUILD_TYPE=Release

# Build to WebAssembly
emmake make

# Copy the generated .wasm file
cp fceux.wasm /path/to/your/project/public/wasm/fceux.wasm
```

### Option 2: Use Pre-built Emulator

Download a pre-compiled NES emulator WASM file:

```bash
# Example sources (verify licensing):
# - https://github.com/binji/binjnes (MIT license)
# - https://github.com/floooh/chips (zlib license)
# - Other WebAssembly NES emulators

# Place the .wasm file in the correct location
cp downloaded-emulator.wasm public/wasm/fceux.wasm
```

### Option 3: Compile Custom Emulator

Create a minimal NES emulator targeting WebAssembly:

```c
// minimal-nes.c
#include <emscripten.h>
#include <stdint.h>

// NES state
static uint8_t rom_data[1024 * 1024];
static uint32_t rom_size = 0;
static uint8_t frame_buffer[256 * 240 * 4]; // RGBA
static uint8_t controls = 0;

EMSCRIPTEN_KEEPALIVE
int init() {
    // Initialize NES emulator
    return 1;
}

EMSCRIPTEN_KEEPALIVE  
int loadRom(uint8_t* rom, uint32_t size) {
    // Validate and load ROM
    if (size < 16) return 0;
    if (rom[0] != 0x4E || rom[1] != 0x45 || rom[2] != 0x53 || rom[3] != 0x1A) return 0;
    
    // Copy ROM data
    for (uint32_t i = 0; i < size && i < sizeof(rom_data); i++) {
        rom_data[i] = rom[i];
    }
    rom_size = size;
    return 1;
}

EMSCRIPTEN_KEEPALIVE
void frame() {
    // Execute one frame of NES emulation
    // Update frame_buffer with rendered graphics
}

EMSCRIPTEN_KEEPALIVE
uint8_t* getFrameBuffer() {
    return frame_buffer;
}

// Compile with:
// emcc minimal-nes.c -o fceux.wasm -s WASM=1 -s EXPORTED_FUNCTIONS="['_init','_loadRom','_frame','_getFrameBuffer']"
```

## Required WASM Exports

The `FCEUXWebAdapter` expects these exports:

```javascript
// Required exports
instance.exports.init()                    // Initialize emulator
instance.exports.loadRom(ptr, size)        // Load ROM data  
instance.exports.frame()                   // Execute one frame
instance.exports.reset()                   // Reset emulator
instance.exports.setButton(index, pressed) // Set button state
instance.exports.setRunning(running)       // Set running state
instance.exports.getFrameBuffer()          // Get frame buffer pointer

// Optional exports
instance.exports.getFrameSpec()            // Get frame specification
instance.exports.getPalette()              // Get color palette
instance.exports.getAudioBuffer()          // Get audio samples
```

## Frame Buffer Formats

The emulator supports multiple pixel formats:

### RGBA32 (Recommended)
```
Buffer size: 256 * 240 * 4 = 245,760 bytes
Format: [R, G, B, A, R, G, B, A, ...]
Usage: Direct copy to canvas ImageData
```

### RGB24
```
Buffer size: 256 * 240 * 3 = 184,320 bytes  
Format: [R, G, B, R, G, B, ...]
Usage: Converted to RGBA with alpha=255
```

### INDEXED8 (with palette)
```
Buffer size: 256 * 240 = 61,440 bytes
Format: [colorIndex, colorIndex, ...]
Palette: 64 colors * 3 bytes RGB = 192 bytes
Usage: Palette lookup to convert to RGBA
```

## Testing Your Emulator

1. **Replace the WASM file:**
   ```bash
   cp your-emulator.wasm public/wasm/fceux.wasm
   ```

2. **Test with the included test ROM:**
   ```bash
   # Use the generated test ROM
   cat public/roms/test-rom-base64.txt
   # Copy this base64 content to test ROM loading
   ```

3. **Verify in browser:**
   - Open browser dev console
   - Look for `[WasmLoader] Exports:` log
   - Confirm `[FCEUXWebAdapter] ✅ Real NES emulator core active`
   - Test that button presses affect the display

## Troubleshooting

### WASM File Too Small
```
Error: Bad WASM: WASM file too small: 826 bytes
Solution: Use a real emulator core (should be >100KB)
```

### Missing Exports
```
Error: Bad WASM: missing required exports: init, loadRom
Solution: Ensure your WASM exports all required functions
```

### ROM Loading Fails
```
Error: Failed to load ROM into emulator
Solution: Check ROM format and emulator compatibility
```

### No Graphics
```
Issue: Black screen or gradient pattern
Solution: Verify frame buffer is populated by emulator
```

## Performance Considerations

- **Frame Rate:** Target 60 FPS with `requestAnimationFrame`
- **Memory:** Use shared WASM memory for frame buffers
- **Canvas:** Use `putImageData()` for best performance
- **Controls:** Update button state before each frame

## Security Notes

- WASM files are served with `no-store` cache headers
- All ROM data is validated before loading
- Memory access is bounds-checked in WASM
- No eval() or unsafe JavaScript execution

## Next Steps

1. **Choose an emulator** (FCEUX, Binjnes, custom)
2. **Compile to WebAssembly** with required exports
3. **Replace demo WASM** with real emulator
4. **Test with actual NES ROMs** from Nostr events
5. **Add audio support** if needed
6. **Implement save states** for game progress

The architecture is ready - you just need to drop in a real emulator core!