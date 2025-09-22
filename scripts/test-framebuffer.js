#!/usr/bin/env node

/**
 * Frame Buffer Test Utility
 * 
 * Tests the WebAssembly frame buffer functionality independently.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import wabt from 'wabt';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function testFrameBuffer() {
  try {
    console.log('🧪 Testing WebAssembly Frame Buffer...\n');

    // Load and compile WASM
    console.log('📁 Loading WASM file...');
    const wasmPath = join(__dirname, '../public/wasm/fceux.wasm');
    const wasmBytes = readFileSync(wasmPath);
    console.log(`   Size: ${wasmBytes.length} bytes`);

    // Create imports
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
    const imports = {
      env: {
        memory: memory,
        abort: () => console.log('WASM abort called')
      }
    };

    // Instantiate WASM
    console.log('⚡ Instantiating WASM...');
    const wasmModule = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(wasmModule, imports);
    
    const exports = instance.exports;
    console.log('   Available exports:', Object.keys(exports).filter(k => typeof exports[k] === 'function'));

    // Test initialization
    console.log('\n🚀 Testing initialization...');
    if (typeof exports.init === 'function') {
      const initResult = exports.init();
      console.log(`   init() returned: ${initResult}`);
    } else {
      console.log('   ⚠️ init() not available');
    }

    // Test frame buffer
    console.log('\n🖼️ Testing frame buffer...');
    
    if (typeof exports.getFrameBuffer !== 'function') {
      console.error('   ❌ getFrameBuffer() not available');
      return;
    }

    // Get frame buffer pointer
    const frameBufferPtr = exports.getFrameBuffer();
    console.log(`   Frame buffer pointer: ${frameBufferPtr}`);

    if (typeof frameBufferPtr !== 'number') {
      console.error(`   ❌ getFrameBuffer() returned ${typeof frameBufferPtr}, expected number`);
      return;
    }

    // Get buffer size
    let bufferSize = 256 * 240 * 4; // Default RGBA size
    if (typeof exports.getFrameBufferSize === 'function') {
      bufferSize = exports.getFrameBufferSize();
      console.log(`   Frame buffer size from WASM: ${bufferSize}`);
    } else {
      console.log(`   Using default buffer size: ${bufferSize}`);
    }

    // Validate memory access
    const memoryArray = new Uint8Array(memory.buffer);
    console.log(`   WASM memory size: ${memory.buffer.byteLength} bytes`);

    if (frameBufferPtr + bufferSize > memory.buffer.byteLength) {
      console.error('   ❌ Frame buffer exceeds WASM memory bounds');
      return;
    }

    // Extract frame buffer
    const frameBuffer = memoryArray.slice(frameBufferPtr, frameBufferPtr + bufferSize);
    console.log(`   Extracted buffer size: ${frameBuffer.length} bytes`);

    // Validate buffer
    const expectedSize = 256 * 240 * 4;
    if (frameBuffer.length === expectedSize) {
      console.log('   ✅ Frame buffer size is correct');
    } else {
      console.error(`   ❌ Frame buffer size wrong: expected ${expectedSize}, got ${frameBuffer.length}`);
    }

    // Test frame generation
    console.log('\n🎬 Testing frame generation...');
    if (typeof exports.frame === 'function') {
      // Generate a frame
      exports.frame();
      
      // Read the updated buffer
      const updatedBuffer = memoryArray.slice(frameBufferPtr, frameBufferPtr + bufferSize);
      
      // Check if buffer changed
      let changed = false;
      for (let i = 0; i < Math.min(frameBuffer.length, updatedBuffer.length); i++) {
        if (frameBuffer[i] !== updatedBuffer[i]) {
          changed = true;
          break;
        }
      }
      
      console.log(`   Frame generated, buffer changed: ${changed}`);
      
      // Sample some pixels
      if (updatedBuffer.length >= 16) {
        console.log('   Sample pixels:');
        for (let i = 0; i < 4; i++) {
          const offset = i * 4;
          const r = updatedBuffer[offset];
          const g = updatedBuffer[offset + 1];
          const b = updatedBuffer[offset + 2];
          const a = updatedBuffer[offset + 3];
          console.log(`     Pixel ${i}: RGBA(${r}, ${g}, ${b}, ${a})`);
        }
      }
      
    } else {
      console.log('   ⚠️ frame() not available');
    }

    console.log('\n✅ Frame buffer test completed successfully!');

  } catch (error) {
    console.error('\n❌ Frame buffer test failed:', error);
    process.exit(1);
  }
}

testFrameBuffer();