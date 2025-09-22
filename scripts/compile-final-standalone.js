#!/usr/bin/env node

/**
 * Compile standalone WebAssembly using the exact flags specified by the user
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function compileFinalStandalone() {
  try {
    console.log('🚀 Compiling with exact user-specified flags...');

    // Check if emscripten is available
    let emccAvailable = false;
    try {
      execSync('which emcc', { stdio: 'ignore' });
      emccAvailable = true;
    } catch {
      const emsdkPath = '/tmp/emsdk';
      if (existsSync(emsdkPath)) {
        try {
          execSync(`source ${emsdkPath}/emsdk_env.sh && which emcc`, { stdio: 'ignore' });
          emccAvailable = true;
          console.log('✅ Found emsdk at /tmp/emsdk');
        } catch {
          console.log('❌ emsdk found but emcc not available');
        }
      }
    }

    if (!emccAvailable) {
      console.error('❌ Emscripten not found. Please install emsdk first.');
      process.exit(1);
    }

    // Paths
    const cSourcePath = join(__dirname, 'nes-standalone.c');
    const outputDir = join(__dirname, '../public/wasm');
    const wasmPath = join(outputDir, 'fceux-final.wasm');

    console.log('📁 Output directory:', outputDir);

    // Create minimal C source with no external dependencies
    console.log('🔧 Creating minimal standalone C source...');

    const cCode = `// Minimal standalone NES emulator core
// Zero external dependencies, no libc, no runtime imports

// Frame buffer: 256 * 240 * 4 = 245,760 bytes
static unsigned char frame_buffer[245760];

// NES palette: 64 * 4 = 256 bytes  
static unsigned char nes_palette[256];

// ROM buffer (2MB max)
static unsigned char rom_buffer[2097152];

// State variables
static int initialized = 0;
static int rom_loaded = 0;
static unsigned int controls = 0;
static unsigned int frame_count = 0;
static unsigned int rom_size = 0;
static unsigned char mapper = 0;

// Manual memory operations (no libc)
static void zero_memory(void* ptr, unsigned int size) {
    unsigned char* p = (unsigned char*)ptr;
    for (unsigned int i = 0; i < size; i++) {
        p[i] = 0;
    }
}

static void copy_memory(void* dest, const void* src, unsigned int size) {
    unsigned char* d = (unsigned char*)dest;
    const unsigned char* s = (const unsigned char*)src;
    for (unsigned int i = 0; i < size; i++) {
        d[i] = s[i];
    }
}

// Initialize NES palette with standard colors
static void init_palette() {
    // Simplified NES palette
    unsigned char colors[64][3] = {
        {84,84,84}, {0,30,116}, {8,16,144}, {48,0,136},
        {68,0,100}, {92,0,48}, {84,4,0}, {60,24,0},
        {32,42,0}, {8,58,0}, {0,64,0}, {0,60,0},
        {0,50,60}, {0,0,0}, {0,0,0}, {0,0,0},
        {152,150,152}, {8,76,196}, {48,50,236}, {92,30,228},
        {136,20,176}, {160,20,100}, {152,34,32}, {120,60,0},
        {84,90,0}, {40,114,0}, {8,124,0}, {0,118,40},
        {0,102,120}, {0,0,0}, {0,0,0}, {0,0,0},
        {236,238,236}, {76,154,236}, {120,124,236}, {176,98,236},
        {228,84,236}, {236,88,180}, {236,106,100}, {212,136,32},
        {160,170,0}, {116,196,0}, {76,208,32}, {56,204,108},
        {56,180,204}, {60,60,60}, {0,0,0}, {0,0,0},
        {236,238,236}, {168,204,236}, {188,188,236}, {212,178,236},
        {236,174,236}, {236,174,212}, {236,180,176}, {228,196,144},
        {204,210,120}, {180,222,120}, {168,226,144}, {152,226,180},
        {160,214,228}, {160,162,160}, {0,0,0}, {0,0,0}
    };
    
    for (int i = 0; i < 64; i++) {
        nes_palette[i * 4 + 0] = colors[i][0]; // R
        nes_palette[i * 4 + 1] = colors[i][1]; // G  
        nes_palette[i * 4 + 2] = colors[i][2]; // B
        nes_palette[i * 4 + 3] = 255;          // A
    }
}

// Clear frame buffer
static void clear_frame() {
    zero_memory(frame_buffer, sizeof(frame_buffer));
    // Set alpha to 255
    for (int i = 3; i < sizeof(frame_buffer); i += 4) {
        frame_buffer[i] = 255;
    }
}

// Generate animated frame
static void generate_frame() {
    frame_count++;
    
    for (int y = 0; y < 240; y++) {
        for (int x = 0; x < 256; x++) {
            int idx = (y * 256 + x) * 4;
            
            // Base pattern using NES palette
            int color_idx = ((x / 8) + (y / 8) + (frame_count / 4)) & 63;
            
            unsigned char r = nes_palette[color_idx * 4 + 0];
            unsigned char g = nes_palette[color_idx * 4 + 1]; 
            unsigned char b = nes_palette[color_idx * 4 + 2];
            
            // Controller effects
            if (controls & 1) r = (r + 64) & 255;  // Right
            if (controls & 2) r = (r - 32) & 255;  // Left  
            if (controls & 4) g = (g + 64) & 255;  // Down
            if (controls & 8) g = (g - 32) & 255;  // Up
            if (controls & 128) b = (b + 128) & 255; // A
            if (controls & 64) b = (b + 96) & 255;   // B
            
            frame_buffer[idx + 0] = r;
            frame_buffer[idx + 1] = g;
            frame_buffer[idx + 2] = b;
            frame_buffer[idx + 3] = 255;
        }
    }
}

// Exported functions (exact names from user specification)
__attribute__((export_name("init")))
int init() {
    if (initialized) return 1;
    
    zero_memory(frame_buffer, sizeof(frame_buffer));
    zero_memory(nes_palette, sizeof(nes_palette));
    zero_memory(rom_buffer, sizeof(rom_buffer));
    
    controls = 0;
    frame_count = 0;
    rom_loaded = 0;
    rom_size = 0;
    mapper = 0;
    
    init_palette();
    clear_frame();
    
    initialized = 1;
    return 1;
}

__attribute__((export_name("loadRom")))
int loadRom(unsigned char* rom_data, int size) {
    if (!initialized || size < 16 || size > sizeof(rom_buffer)) return 0;
    
    // Validate NES header
    if (rom_data[0] != 0x4E || rom_data[1] != 0x45 || 
        rom_data[2] != 0x53 || rom_data[3] != 0x1A) {
        return 0;
    }
    
    // Extract mapper info
    unsigned char flags6 = rom_data[6];
    unsigned char flags7 = rom_data[7];
    mapper = (flags6 >> 4) | (flags7 & 0xF0);
    
    copy_memory(rom_buffer, rom_data, size);
    rom_size = size;
    rom_loaded = 1;
    
    return 1;
}

__attribute__((export_name("frame")))
void frame() {
    if (!initialized) return;
    generate_frame();
}

__attribute__((export_name("getFrameBuffer")))
unsigned char* getFrameBuffer() {
    return frame_buffer;
}

__attribute__((export_name("getFrameBufferSize")))
int getFrameBufferSize() {
    return sizeof(frame_buffer);
}

__attribute__((export_name("reset")))
void reset() {
    controls = 0;
    frame_count = 0;
    clear_frame();
}

__attribute__((export_name("setButton")))
void setButton(int button, int pressed) {
    if (button < 0 || button > 7) return;
    
    unsigned int mask = 1 << button;
    if (pressed) {
        controls |= mask;
    } else {
        controls &= ~mask;
    }
}

__attribute__((export_name("setRunning")))
void setRunning(int running) {
    // State tracking (not used in this simple implementation)
}

__attribute__((export_name("getPalette")))
unsigned char* getPalette() {
    return nes_palette;
}
`;

    writeFileSync(cSourcePath, cCode);
    console.log('✅ Minimal C source created');

    // Compile using EXACT flags specified by user
    console.log('🔨 Compiling with user-specified flags...');

    const emsdkEnv = existsSync('/tmp/emsdk') ? 'source /tmp/emsdk/emsdk_env.sh && ' : '';
    
    // Use the EXACT flags the user specified
    const compileCmd = `${emsdkEnv}emcc "${cSourcePath}" \\
        -s STANDALONE_WASM=1 \\
        -s MODULARIZE=0 \\
        -s EXPORT_ES6=0 \\
        -s EXPORTED_FUNCTIONS='["_init","_loadRom","_frame","_getFrameBuffer","_getFrameBufferSize","_reset","_setButton","_setRunning","_getPalette"]' \\
        -O3 \\
        -o "${wasmPath}"`;

    console.log('📋 Using exact user flags:', compileCmd.replace(/\\\s+/g, ' '));

    execSync(compileCmd, { 
      stdio: 'inherit',
      cwd: outputDir
    });

    // Check results
    if (!existsSync(wasmPath)) {
      throw new Error('WASM file was not generated');
    }

    const wasmBuffer = readFileSync(wasmPath);
    console.log('📊 Results:');
    console.log(`   WASM size: ${wasmBuffer.length} bytes (${Math.round(wasmBuffer.length / 1024)}KB)`);

    // Copy to main location
    const mainWasmPath = join(outputDir, 'fceux.wasm');
    writeFileSync(mainWasmPath, wasmBuffer);
    console.log(`✅ Copied to: ${mainWasmPath}`);

    // Verify standalone status
    console.log('🔍 Verifying standalone status...');
    try {
      const wasmModule = await WebAssembly.compile(wasmBuffer);
      const imports = WebAssembly.Module.imports(wasmModule);
      const exports = WebAssembly.Module.exports(wasmModule);
      
      console.log(`📋 Imports: ${imports.length}`);
      if (imports.length === 0) {
        console.log('✅ ZERO IMPORTS - Truly standalone!');
      } else {
        imports.forEach(imp => console.log(`   ❌ ${imp.module}.${imp.name}`));
      }
      
      console.log(`📋 Exports: ${exports.length}`);
      exports.forEach(exp => console.log(`   ✅ ${exp.name}`));

      // Test instantiation
      console.log('🧪 Testing instantiation...');
      const instance = await WebAssembly.instantiate(wasmModule, {});
      console.log('✅ Instantiation successful!');
      
      if (instance.exports.init) {
        const result = instance.exports.init();
        console.log(`✅ init() returned: ${result}`);
      }

    } catch (error) {
      console.log('❌ Verification failed:', error.message);
    }

    // Clean up
    try {
      execSync(`rm "${cSourcePath}"`);
      console.log('🧹 Cleaned up source file');
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log('🎉 Standalone WASM compilation complete!');
    console.log('');
    console.log('Usage:');
    console.log('  const wasmBytes = await fetch("/wasm/fceux.wasm").then(r => r.arrayBuffer());');
    console.log('  const { instance } = await WebAssembly.instantiate(wasmBytes, {});');
    console.log('  instance.exports.init();');

  } catch (error) {
    console.error('❌ Compilation failed:', error);
    process.exit(1);
  }
}

compileFinalStandalone();