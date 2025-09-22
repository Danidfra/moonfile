#!/usr/bin/env node

/**
 * Compile WebAssembly Text Format to Binary
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import wabt from 'wabt';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function compileWat() {
  try {
    console.log('Initializing WABT...');
    const wabtModule = await wabt();
    
    console.log('Reading WAT file...');
    const watPath = join(__dirname, '../public/lib/fceux/nes-core.wat');
    const watSource = readFileSync(watPath, 'utf8');
    
    console.log('Compiling WAT to WASM...');
    const wasmModule = wabtModule.parseWat('nes-core.wat', watSource);
    const { buffer } = wasmModule.toBinary({});
    
    console.log('Writing WASM binary...');
    const wasmPath = join(__dirname, '../public/wasm/fceux.wasm');
    writeFileSync(wasmPath, buffer);
    
    console.log(`Successfully compiled WASM binary: ${buffer.length} bytes`);
    console.log(`Output: ${wasmPath}`);
    
    // Validate the output
    if (buffer.length < 100 * 1024) {
      console.warn(`Warning: WASM file is only ${buffer.length} bytes (expected >100KB for full emulator)`);
    }
    
    // Check magic bytes
    const magic = Array.from(buffer.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0'));
    console.log('WASM magic bytes:', magic.join(' '));
    
    wasmModule.destroy();
    
  } catch (error) {
    console.error('Failed to compile WAT to WASM:', error);
    process.exit(1);
  }
}

compileWat();