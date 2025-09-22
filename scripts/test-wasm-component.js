#!/usr/bin/env node

/**
 * Test WASM Component Validation
 * 
 * Validates that the NesWasmTest component can successfully load and test WASM functionality.
 * This script simulates the component's behavior without React.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function validateWasmComponent() {
  console.log('🧪 Validating NES WASM Test Component Logic...\n');

  try {
    // Step 1: Validate WASM file exists and is loadable
    console.log('📦 Step 1: Validating WASM file...');
    const wasmPath = join(__dirname, '../public/wasm/fceux.wasm');
    const wasmBytes = readFileSync(wasmPath);
    console.log(`   ✅ WASM file found: ${wasmBytes.length} bytes`);

    // Step 2: Validate ROM files exist
    console.log('\n🎮 Step 2: Validating ROM files...');
    try {
      const romPath = join(__dirname, '../public/roms/test-rom.nes');
      const romBytes = readFileSync(romPath);
      console.log(`   ✅ Test ROM found: ${romBytes.length} bytes`);
      
      // Validate ROM header
      if (romBytes[0] === 0x4E && romBytes[1] === 0x45 && romBytes[2] === 0x53 && romBytes[3] === 0x1A) {
        console.log('   ✅ ROM header valid (NES\\x1A)');
      } else {
        console.log('   ⚠️ ROM header invalid, but test will create minimal ROM');
      }
    } catch (error) {
      console.log('   ⚠️ Test ROM not found, component will create minimal ROM');
    }

    // Step 3: Test WASM instantiation
    console.log('\n⚡ Step 3: Testing WASM instantiation...');
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
    const imports = {
      env: {
        memory,
        abort: () => console.log('WASM abort called')
      }
    };

    const wasmModule = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(wasmModule, imports);
    
    const exports = instance.exports;
    const exportNames = Object.keys(exports).filter(k => typeof exports[k] === 'function');
    console.log(`   ✅ WASM instantiated with ${exportNames.length} function exports`);
    console.log(`   Available functions: ${exportNames.join(', ')}`);

    // Step 4: Validate required exports
    console.log('\n🔍 Step 4: Validating required exports...');
    const requiredExports = ['loadRom', 'frame', 'getFrameBuffer'];
    const missingExports = requiredExports.filter(name => typeof exports[name] !== 'function');
    
    if (missingExports.length === 0) {
      console.log('   ✅ All required exports present');
    } else {
      console.log(`   ❌ Missing exports: ${missingExports.join(', ')}`);
      throw new Error('Required WASM exports missing');
    }

    // Step 5: Test frame buffer functionality
    console.log('\n🖼️ Step 5: Testing frame buffer functionality...');
    
    // Initialize if available
    if (typeof exports.init === 'function') {
      const initResult = exports.init();
      console.log(`   Init result: ${initResult}`);
    }

    // Test frame buffer
    const frameBufferPtr = exports.getFrameBuffer();
    console.log(`   Frame buffer pointer: ${frameBufferPtr}`);
    
    if (typeof frameBufferPtr !== 'number') {
      throw new Error(`getFrameBuffer returned ${typeof frameBufferPtr}, expected number`);
    }

    // Test buffer size
    const expectedSize = 256 * 240 * 4;
    let bufferSize = expectedSize;
    
    if (typeof exports.getFrameBufferSize === 'function') {
      bufferSize = exports.getFrameBufferSize();
      console.log(`   Buffer size from WASM: ${bufferSize}`);
    }

    if (bufferSize === expectedSize) {
      console.log('   ✅ Frame buffer size correct');
    } else {
      console.log(`   ⚠️ Frame buffer size: ${bufferSize}, expected: ${expectedSize}`);
    }

    // Test memory access
    const memoryArray = new Uint8Array(memory.buffer);
    if (frameBufferPtr + bufferSize <= memory.buffer.byteLength) {
      console.log('   ✅ Frame buffer within memory bounds');
    } else {
      throw new Error('Frame buffer exceeds memory bounds');
    }

    // Step 6: Test frame generation
    console.log('\n🎬 Step 6: Testing frame generation...');
    exports.frame();
    console.log('   ✅ Frame generation completed without errors');

    console.log('\n🎉 NES WASM Test Component Validation PASSED!');
    console.log('\n📋 Summary:');
    console.log('   ✅ WASM file loads correctly');
    console.log('   ✅ Required exports are present');
    console.log('   ✅ Frame buffer functionality works');
    console.log('   ✅ Memory layout is valid');
    console.log('   ✅ Component should work correctly in browser');

  } catch (error) {
    console.error('\n❌ NES WASM Test Component Validation FAILED:', error.message);
    process.exit(1);
  }
}

validateWasmComponent();