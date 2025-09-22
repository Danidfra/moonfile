#!/usr/bin/env node

/**
 * ROM Debugging Script
 * 
 * Analyzes a ROM file or base64 string to identify potential loading issues.
 * Usage: node scripts/debug-rom.js <rom-file-or-base64>
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import ROM utilities (simplified versions for Node.js)
function decodeBase64ToBytes(str) {
  const clean = str.replace(/\s+/g, "");
  const pad = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const bin = Buffer.from(pad, 'base64');
  return new Uint8Array(bin);
}

function parseINesHeader(bytes) {
  if (bytes.length < 16) {
    throw new Error('ROM too small for iNES header');
  }

  const magic = Array.from(bytes.slice(0, 4));
  if (magic[0] !== 0x4E || magic[1] !== 0x45 || magic[2] !== 0x53 || magic[3] !== 0x1A) {
    throw new Error(`Invalid iNES header: ${magic.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  }

  const prgBanks = bytes[4];
  const chrBanks = bytes[5];
  const flags6 = bytes[6];
  const flags7 = bytes[7];
  const mapper = (flags6 >> 4) | (flags7 & 0xF0);

  return {
    magic,
    prgBanks,
    chrBanks,
    mapper,
    hasBattery: (flags6 & 0x02) !== 0,
    hasTrainer: (flags6 & 0x04) !== 0,
    isVSUnisystem: (flags6 & 0x01) !== 0,
    isPlayChoice10: (flags7 & 0x02) !== 0,
    isNES2_0: (flags7 & 0x0C) === 0x08,
    flags6,
    flags7
  };
}

function analyzeRom(bytes) {
  console.log('🔍 ROM Analysis Starting...\n');
  
  const header = parseINesHeader(bytes);
  
  // Basic info
  console.log('📋 Basic Information:');
  console.log(`   Size: ${bytes.length} bytes (${Math.round(bytes.length / 1024)}KB)`);
  console.log(`   Magic: ${header.magic.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  console.log(`   PRG Banks: ${header.prgBanks} (${header.prgBanks * 16}KB)`);
  console.log(`   CHR Banks: ${header.chrBanks} ${header.chrBanks === 0 ? '(CHR RAM)' : '(' + header.chrBanks * 8 + 'KB)'}`);
  console.log(`   Mapper: ${header.mapper}`);
  console.log('');

  // Memory layout
  const headerSize = 16;
  const trainerSize = header.hasTrainer ? 512 : 0;
  const prgSize = header.prgBanks * 16384;
  const chrSize = header.chrBanks * 8192;
  const expectedSize = headerSize + trainerSize + prgSize + chrSize;
  
  console.log('🗂️ Memory Layout:');
  console.log(`   Header: ${headerSize} bytes`);
  if (header.hasTrainer) console.log(`   Trainer: ${trainerSize} bytes`);
  console.log(`   PRG-ROM: ${prgSize} bytes`);
  if (header.chrBanks > 0) console.log(`   CHR-ROM: ${chrSize} bytes`);
  console.log(`   Expected Total: ${expectedSize} bytes`);
  console.log(`   Actual Size: ${bytes.length} bytes`);
  if (bytes.length !== expectedSize) {
    const diff = bytes.length - expectedSize;
    console.log(`   Difference: ${diff > 0 ? '+' : ''}${diff} bytes`);
  }
  console.log('');

  // Mapper analysis
  const mappers = {
    0: { name: 'NROM', complexity: 'Simple', notes: 'Basic mapper, should work everywhere' },
    1: { name: 'MMC1', complexity: 'Moderate', notes: 'Sequential write registers, bank switching' },
    2: { name: 'UNROM', complexity: 'Simple', notes: 'Often uses CHR RAM, simple bank switching' },
    3: { name: 'CNROM', complexity: 'Simple', notes: 'CHR-ROM bank switching only' },
    4: { name: 'MMC3', complexity: 'Complex', notes: 'IRQ timer, complex bank switching' },
    7: { name: 'AxROM', complexity: 'Moderate', notes: '32KB PRG switching, single screen mirroring' }
  };

  const mapperInfo = mappers[header.mapper];
  console.log('🎮 Mapper Information:');
  if (mapperInfo) {
    console.log(`   Name: ${mapperInfo.name}`);
    console.log(`   Complexity: ${mapperInfo.complexity}`);
    console.log(`   Notes: ${mapperInfo.notes}`);
  } else {
    console.log(`   Name: Unknown Mapper ${header.mapper}`);
    console.log(`   Complexity: Unknown`);
    console.log(`   Notes: May not be supported by simple emulators`);
  }
  console.log('');

  // Flags analysis
  console.log('🏁 ROM Flags:');
  console.log(`   Flags 6: 0x${header.flags6.toString(16).padStart(2, '0')} (${header.flags6.toString(2).padStart(8, '0')})`);
  console.log(`   Flags 7: 0x${header.flags7.toString(16).padStart(2, '0')} (${header.flags7.toString(2).padStart(8, '0')})`);
  console.log(`   Mirroring: ${header.flags6 & 0x01 ? 'Vertical' : 'Horizontal'}`);
  console.log(`   Battery: ${header.hasBattery ? 'Yes' : 'No'}`);
  console.log(`   Trainer: ${header.hasTrainer ? 'Yes' : 'No'}`);
  console.log(`   Four Screen: ${header.flags6 & 0x08 ? 'Yes' : 'No'}`);
  console.log(`   VS Unisystem: ${header.isVSUnisystem ? 'Yes' : 'No'}`);
  console.log(`   PlayChoice-10: ${header.isPlayChoice10 ? 'Yes' : 'No'}`);
  console.log(`   NES 2.0: ${header.isNES2_0 ? 'Yes' : 'No'}`);
  console.log('');

  // Compatibility analysis
  console.log('⚠️ Potential Issues:');
  const issues = [];
  
  if (header.chrBanks === 0) {
    issues.push('CHR RAM: Emulator must allocate 8KB CHR RAM');
  }
  
  if (header.mapper === 2 && header.chrBanks === 0) {
    issues.push('UNROM + CHR RAM: Common combination but requires proper implementation');
  }
  
  if (header.mapper > 4 && header.mapper !== 7) {
    issues.push(`Advanced mapper ${header.mapper}: May not be supported by simple cores`);
  }
  
  if (header.hasTrainer) {
    issues.push('Trainer present: Adds 512-byte offset, not all emulators support');
  }
  
  if (bytes.length > 512 * 1024) {
    issues.push('Large ROM: May hit WASM memory constraints');
  }
  
  if (header.isVSUnisystem || header.isPlayChoice10) {
    issues.push('Special cartridge: Requires specialized emulator support');
  }

  if (issues.length === 0) {
    console.log('   ✅ No obvious compatibility issues detected');
  } else {
    issues.forEach(issue => console.log(`   ⚠️ ${issue}`));
  }
  console.log('');

  // Recommendations
  console.log('💡 Recommendations:');
  if (header.mapper <= 4 || header.mapper === 7) {
    console.log('   ✅ Mapper is commonly supported');
  } else {
    console.log('   🔧 Use a full-featured emulator core (FCEUX, Nestopia, etc.)');
  }
  
  if (header.chrBanks === 0) {
    console.log('   💾 Ensure emulator properly handles CHR RAM allocation');
  }
  
  if (bytes.length > expectedSize) {
    console.log('   📦 ROM has extra data - possibly padding or additional content');
  }
  
  console.log('');

  return header;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/debug-rom.js <rom-file-or-base64-string>');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/debug-rom.js game.nes');
    console.log('  node scripts/debug-rom.js "TkVTGgEBAAA..."');
    console.log('  node scripts/debug-rom.js public/roms/test-rom.nes');
    process.exit(1);
  }

  const input = args[0];
  let romBytes;

  try {
    // Try to read as file first
    if (input.includes('.nes') || input.includes('/') || input.includes('\\')) {
      console.log(`📁 Reading ROM file: ${input}\n`);
      const buffer = readFileSync(input);
      romBytes = new Uint8Array(buffer);
    } else {
      // Treat as base64 string
      console.log(`📝 Decoding base64 string (${input.length} characters)\n`);
      romBytes = decodeBase64ToBytes(input);
    }

    analyzeRom(romBytes);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();