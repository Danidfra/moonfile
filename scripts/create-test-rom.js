#!/usr/bin/env node

/**
 * Create a minimal test NES ROM for emulator validation
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createTestRom() {
  console.log('Creating test NES ROM...');
  
  // Create a minimal NES ROM with proper header
  const rom = new Uint8Array(16 + 16384 + 8192); // Header + 1 PRG bank + 1 CHR bank
  
  // NES header
  rom[0] = 0x4E; // 'N'
  rom[1] = 0x45; // 'E'
  rom[2] = 0x53; // 'S'
  rom[3] = 0x1A; // EOF
  rom[4] = 1;    // 1 PRG-ROM bank (16KB)
  rom[5] = 1;    // 1 CHR-ROM bank (8KB)
  rom[6] = 0;    // Mapper 0, horizontal mirroring
  rom[7] = 0;    // No special flags
  rom[8] = 0;    // PRG-RAM size (0 = 8KB)
  rom[9] = 0;    // TV system (0 = NTSC)
  rom[10] = 0;   // TV system, PRG-RAM presence
  rom[11] = 0;   // Unused
  rom[12] = 0;   // Unused
  rom[13] = 0;   // Unused
  rom[14] = 0;   // Unused
  rom[15] = 0;   // Unused
  
  // Fill PRG-ROM with simple pattern
  for (let i = 16; i < 16 + 16384; i++) {
    rom[i] = (i - 16) % 256;
  }
  
  // Fill CHR-ROM with pattern
  for (let i = 16 + 16384; i < rom.length; i++) {
    rom[i] = ((i - 16 - 16384) % 256);
  }
  
  // Write to file
  const romPath = join(__dirname, '../public/roms/test-rom.nes');
  writeFileSync(romPath, rom);
  
  console.log(`Test ROM created: ${romPath}`);
  console.log(`Size: ${rom.length} bytes`);
  console.log('Header:', Array.from(rom.slice(0, 16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  
  // Create base64 encoded version for testing
  const base64 = Buffer.from(rom).toString('base64');
  const base64Path = join(__dirname, '../public/roms/test-rom-base64.txt');
  writeFileSync(base64Path, base64);
  
  console.log(`Base64 ROM created: ${base64Path}`);
  console.log(`Base64 length: ${base64.length} characters`);
}

createTestRom();