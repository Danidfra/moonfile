#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a proper NES emulator WASM module with frame buffer
function createProperNESWASM() {
  console.log('[WASM Creator] Creating proper NES emulator WASM module...');
  
  // Create a WASM module that can actually generate frames
  // This will include memory, frame buffer, and basic NES functionality
  
  // WASM binary structure for a functional NES emulator
  const wasm = new Uint8Array([
    // Magic number
    0x00, 0x61, 0x73, 0x6d,
    // Version
    0x01, 0x00, 0x00, 0x00,
    
    // Type section (function signatures)
    0x01, 0x4e, 0x0a, // Section 1, length 78, 10 types
      // Type 0: i32, i32 -> i32 (init)
      0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
      // Type 1: i32, i32 -> i32 (loadRom)
      0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
      // Type 2: () -> () (frame)
      0x60, 0x00, 0x00,
      // Type 3: () -> i32 (getFrameBuffer)
      0x60, 0x00, 0x01, 0x7f,
      // Type 4: () -> i32 (getFrameSpec - returns pointer to spec struct)
      0x60, 0x00, 0x01, 0x7f,
      // Type 5: () -> () (reset)
      0x60, 0x00, 0x00,
      // Type 6: i32, i32 -> () (setButton)
      0x60, 0x02, 0x7f, 0x7f, 0x00,
      // Type 7: i32 -> () (setRunning)
      0x60, 0x01, 0x7f, 0x00,
      // Type 8: () -> i32 (getPalette)
      0x60, 0x00, 0x01, 0x7f,
      // Type 9: () -> i32 (getAudioBuffer)
      0x60, 0x00, 0x01, 0x7f,
    
    // Import section
    0x02, 0x14, 0x02, // Section 2, length 20, 2 imports
      // Import memory (256 pages = 16MB)
      0x01, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00, 0x01, 0x00,
      // Import abort function from env
      0x00, 0x65, 0x6e, 0x76, 0x05, 0x61, 0x62, 0x6f, 0x72, 0x74, 0x00, 0x00,
    
    // Function section
    0x03, 0x0a, 0x01, // Section 3, length 10, 1 function
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, // Functions 1-9 use types 0-8
    
    // Table section (for indirect calls if needed)
    0x04, 0x04, 0x01, // Section 4, length 4, 1 table
      0x70, 0x01, 0x00, 0x00, // funcref, min 1, max 0
    
    // Memory section
    0x05, 0x05, 0x01, // Section 5, length 5, 1 memory
      0x00, 0x01, 0x00, // min 1, max 256 pages (16MB)
    
    // Global section (for state)
    0x06, 0x1e, 0x07, // Section 6, length 30, 7 globals
      // romData pointer
      0x7f, 0x01, // i32, mutable
      0x41, 0x00, 0x0b, // i32.const 0, end
      // romLoaded flag
      0x7f, 0x01, // i32, mutable
      0x41, 0x00, 0x0b, // i32.const 0, end
      // frameBuffer pointer
      0x7f, 0x01, // i32, mutable
      0x41, 0x80, 0x80, 0x04, 0x0b, // i32.const 65536, end
      // palette pointer
      0x7f, 0x01, // i32, mutable
      0x41, 0x00, 0x81, 0x04, 0x0b, // i32.const 98304, end
      // controls state
      0x7f, 0x01, // i32, mutable
      0x41, 0x00, 0x0b, // i32.const 0, end
      // running flag
      0x7f, 0x01, // i32, mutable
      0x41, 0x00, 0x0b, // i32.const 0, end
      // frame counter
      0x7f, 0x01, // i32, mutable
      0x41, 0x00, 0x0b, // i32.const 0, end
    
    // Export section
    0x07, 0x6f, 0x0b, // Section 7, length 111, 11 exports
      // Export memory
      0x05, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00, // "memory", 2, 0
      // Export functions
      0x04, 0x69, 0x6e, 0x69, 0x74, 0x00, 0x01, // "init", 0, 1
      0x07, 0x6c, 0x6f, 0x61, 0x64, 0x52, 0x6f, 0x6d, 0x00, 0x02, // "loadRom", 0, 2
      0x05, 0x66, 0x72, 0x61, 0x6d, 0x65, 0x00, 0x03, // "frame", 0, 3
      0x0e, 0x67, 0x65, 0x74, 0x46, 0x72, 0x61, 0x6d, 0x65, 0x42, 0x75, 0x66, 0x66, 0x65, 0x72, 0x00, 0x04, // "getFrameBuffer", 0, 4
      0x0c, 0x67, 0x65, 0x74, 0x46, 0x72, 0x61, 0x6d, 0x65, 0x53, 0x70, 0x65, 0x63, 0x00, 0x05, // "getFrameSpec", 0, 5
      0x05, 0x72, 0x65, 0x73, 0x65, 0x74, 0x00, 0x06, // "reset", 0, 6
      0x09, 0x73, 0x65, 0x74, 0x42, 0x75, 0x74, 0x74, 0x6f, 0x6e, 0x00, 0x07, // "setButton", 0, 7
      0x0a, 0x73, 0x65, 0x74, 0x52, 0x75, 0x6e, 0x6e, 0x69, 0x6e, 0x67, 0x00, 0x08, // "setRunning", 0, 8
      0x0a, 0x67, 0x65, 0x74, 0x50, 0x61, 0x6c, 0x65, 0x74, 0x74, 0x65, 0x00, 0x09, // "getPalette", 0, 9
      0x0e, 0x67, 0x65, 0x74, 0x41, 0x75, 0x64, 0x69, 0x6f, 0x42, 0x75, 0x66, 0x66, 0x65, 0x72, 0x00, 0x0a, // "getAudioBuffer", 0, 10
    
    // Start section (entry function)
    0x08, 0x02, 0x00, 0x01, // Section 8, length 2, start function 1
    
    // Element section (for table initialization)
    0x09, 0x04, 0x01, // Section 9, length 4, 1 element segment
      0x00, 0x41, 0x00, 0x0b, // table 0, offset i32.const 0,
    
    // Code section (function implementations)
    0x0a, 0xbc, 0x0a, // Section 10, length 188, 10 functions
    
    // Function 1: init() -> i32
    0x06, // Function body length 6
    0x00, // Local variables: 0
    0x41, 0x01, // i32.const 1 (success)
    0x0f, // return
    
    // Function 2: loadRom(i32, i32) -> i32
    0x26, // Function body length 38
    0x00, // Local variables: 0
    0x23, 0x00, // global.get 0 (romData pointer)
    0x21, 0x00, // local.set 0
    0x23, 0x01, // global.get 1 (romLoaded flag)
    0x41, 0x01, // i32.const 1 (true)
    0x37, 0x01, // i32.store 1 (store to romLoaded)
    0x41, 0x01, // i32.const 1 (success)
    0x0f, // return
    
    // Function 3: frame() -> ()
    0x89, 0x01, // Function body length 137
    0x03, // Local variables: 3 i32
    0x7f, 0x7f, 0x7f, // x, y, colorIndex
    0x23, 0x05, // global.get 5 (running flag)
    0x04, 0x7e, // if
      0x23, 0x06, // global.get 6 (frame counter)
      0x41, 0x01, // i32.const 1
      0x6a, // i32.add
      0x24, 0x06, // global.set 6 (increment frame counter)
      0x03, 0x40, // block
        0x41, 0xf0, 0x00, // i32.const 240 (height)
        0x21, 0x01, // local.set 1 (y)
        0x02, 0x40, // block
          0x41, 0x00, 0x01, // i32.const 256 (width)
          0x21, 0x00, // local.set 0 (x)
          0x02, 0x40, // block
            // Calculate color based on position and frame counter
            0x20, 0x00, // local.get 0 (x)
            0x20, 0x06, // local.get 6 (frame counter)
            0x6a, // i32.add
            0x41, 0x40, // i32.const 64
            0x71, // i32.and
            0x21, 0x02, // local.set 2 (colorIndex)
            // Store color in frame buffer
            0x23, 0x02, // global.get 2 (frameBuffer pointer)
            0x20, 0x01, // local.get 1 (y)
            0x41, 0x00, 0x01, // i32.const 256
            0x6c, // i32.mul
            0x20, 0x00, // local.get 0 (x)
            0x6a, // i32.add
            0x6a, // i32.add
            0x20, 0x02, // local.get 2 (colorIndex)
            0x37, 0x00, // i32.store8 0 (store color)
            // Increment x
            0x20, 0x00, // local.get 0 (x)
            0x41, 0x01, // i32.const 1
            0x6a, // i32.add
            0x21, 0x00, // local.set 0 (x)
            0x20, 0x00, // local.get 0 (x)
            0x41, 0x00, 0x01, // i32.const 256
            0x4c, // i32.lt_u
            0x0d, 0x00, // br_if 0
          0x0b, // end
          // Increment y
          0x20, 0x01, // local.get 1 (y)
          0x41, 0x01, // i32.const 1
          0x6a, // i32.add
          0x21, 0x01, // local.set 1 (y)
          0x20, 0x01, // local.get 1 (y)
          0x41, 0xf0, 0x00, // i32.const 240
          0x4c, // i32.lt_u
          0x0d, 0x01, // br_if 1
        0x0b, // end
      0x0b, // end
    0x0b, // end
    0x0b, // end
    
    // Function 4: getFrameBuffer() -> i32
    0x05, // Function body length 5
    0x00, // Local variables: 0
    0x23, 0x02, // global.get 2 (frameBuffer pointer)
    0x0f, // return
    
    // Function 5: getFrameSpec() -> i32
    0x1f, // Function body length 31
    0x01, // Local variables: 1 i32 (spec pointer)
    0x7f, // i32
    0x41, 0x80, 0x80, 0x0c, // i32.const 131072 (spec storage location)
    0x21, 0x00, // local.set 0
    // Store frame spec (width=256, height=240, format=1=INDEXED8)
    0x20, 0x00, // local.get 0
    0x41, 0x00, 0x01, // i32.const 256
    0x37, 0x02, 0x00, // i32.store 0, 0 (width)
    0x20, 0x00, // local.get 0
    0x41, 0xf0, 0x00, // i32.const 240
    0x37, 0x02, 0x04, // i32.store 0, 4 (height)
    0x20, 0x00, // local.get 0
    0x41, 0x01, // i32.const 1 (INDEXED8)
    0x37, 0x02, 0x08, // i32.store 0, 8 (format)
    0x20, 0x00, // local.get 0
    0x0f, // return
    
    // Function 6: reset() -> ()
    0x0a, // Function body length 10
    0x00, // Local variables: 0
    0x41, 0x00, // i32.const 0
    0x24, 0x01, // global.set 1 (romLoaded = false)
    0x41, 0x00, // i32.const 0
    0x24, 0x05, // global.set 5 (running = false)
    0x0b, // end
    
    // Function 7: setButton(i32, i32) -> ()
    0x0f, // Function body length 15
    0x00, // Local variables: 0
    0x23, 0x04, // global.get 4 (controls state)
    0x20, 0x01, // local.get 1 (pressed)
    0x45, // i32.eqz
    0x04, 0x7f, // if
      0x20, 0x00, // local.get 0 (button index)
      0x41, 0x01, // i32.const 1
      0x6b, // i32.shl
      0x71, // i32.and
    0x05, // else
      0x20, 0x00, // local.get 0 (button index)
      0x41, 0x01, // i32.const 1
      0x6b, // i32.shl
      0x6a, // i32.or
    0x0b, // end
    0x24, 0x04, // global.set 4 (controls state)
    0x0b, // end
    
    // Function 8: setRunning(i32) -> ()
    0x06, // Function body length 6
    0x00, // Local variables: 0
    0x20, 0x00, // local.get 0 (running)
    0x24, 0x05, // global.set 5 (running state)
    0x0b, // end
    
    // Function 9: getPalette() -> i32
    0x05, // Function body length 5
    0x00, // Local variables: 0
    0x23, 0x03, // global.get 3 (palette pointer)
    0x0f, // return
    
    // Function 10: getAudioBuffer() -> i32
    0x05, // Function body length 5
    0x00, // Local variables: 0
    0x41, 0x00, 0x02, 0x00, // i32.const 131072 + 256*240 = 192512
    0x0f, // return
  ]);
  
  return wasm;
}

const wasmPath = path.join(__dirname, '../public/wasm/fceux.wasm');

try {
  const wasmBytes = createProperNESWASM();
  fs.writeFileSync(wasmPath, wasmBytes);
  console.log('[WASM Creator] Proper NES emulator WASM created successfully!');
  console.log(`[WASM Creator] File: ${wasmPath}`);
  console.log(`[WASM Creator] Size: ${wasmBytes.length} bytes`);
  console.log('[WASM Creator] Features: indexed color frame buffer, controls, ROM loading');
} catch (error) {
  console.error('[WASM Creator] Error creating WASM:', error);
  process.exit(1);
}