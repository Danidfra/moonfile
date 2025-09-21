#!/usr/bin/env node

// Create a minimal NES ROM file with proper header for testing
import { writeFileSync } from 'fs';

// NES header: "NES" + 0x1A + 16KB PRG + 8KB CHR + mapper 0
const header = Buffer.from([
  0x4E, 0x45, 0x53, 0x1A, // "NES^Z"
  0x01,                   // 1x 16KB PRG ROM
  0x01,                   // 1x 8KB CHR ROM
  0x00,                   // Mapper 0, no battery, no trainer
  0x00,                   // Mapper 0, VS Unisystem, PlayChoice-10
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // Unused
]);

// Simple PRG ROM (just a minimal program)
const prgRom = Buffer.alloc(16384); // 16KB
prgRom[0] = 0xA9; // LDA #$01
prgRom[1] = 0x01;
prgRom[2] = 0x8D; // STA $2000
prgRom[3] = 0x00;
prgRom[4] = 0x20;
prgRom[5] = 0x4C; // JMP $8000 (infinite loop)
prgRom[6] = 0x00;
prgRom[7] = 0x80;

// CHR ROM (pattern table)
const chrRom = Buffer.alloc(8192); // 8KB

// Create complete ROM
const rom = Buffer.concat([header, prgRom, chrRom]);

// Write to file
writeFileSync('public/roms/test-rom.nes', rom);

console.log('Created test ROM: public/roms/test-rom.nes');
console.log(`ROM size: ${rom.length} bytes`);