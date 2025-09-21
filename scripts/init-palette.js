#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create palette data for the NES emulator
function createPaletteData() {
  console.log('[Palette] Creating NES palette data...');
  
  // Standard NES palette (64 colors in RGB format)
  // Each color is 3 bytes: R, G, B
  const paletteData = [
    // Color 0-15: Grayscale
    0x54, 0x54, 0x54,  // 0: Dark gray
    0x00, 0x1C, 0x3C,  // 1: Dark blue
    0x10, 0x38, 0x64,  // 2: Blue
    0x00, 0x10, 0x64,  // 3: Dark blue-green
    0x08, 0x18, 0x20,  // 4: Very dark blue
    0x30, 0x18, 0x08,  // 5: Dark brown
    0x00, 0x00, 0x00,  // 6: Black
    0x00, 0x00, 0x00,  // 7: Black
    
    // Color 8-15: Lighter colors
    0x88, 0x88, 0x88,  // 8: Light gray
    0x00, 0x38, 0x6C,  // 9: Light blue
    0x00, 0x58, 0x94,  // 10: Lighter blue
    0x00, 0x44, 0x88,  // 11: Blue-green
    0x44, 0x58, 0x64,  // 12: Gray-blue
    0x5C, 0x78, 0x44,  // 13: Green
    0x00, 0x00, 0x00,  // 14: Black
    0x00, 0x00, 0x00,  // 15: Black
    
    // Color 16-31: Red shades
    0xBC, 0xBC, 0xBC,  // 16: White
    0x70, 0x94, 0xB0,  // 17: Light blue-white
    0x40, 0x8C, 0xAC,  // 18: Cyan
    0x00, 0x88, 0xB8,  // 19: Light cyan
    0x6C, 0x88, 0x98,  // 20: Gray-cyan
    0x84, 0xA8, 0x78,  // 21: Light green
    0x00, 0x00, 0x00,  // 22: Black
    0x00, 0x00, 0x00,  // 23: Black
    
    // Color 24-39: Bright colors
    0xFC, 0xFC, 0xFC,  // 24: Bright white
    0xB4, 0xCC, 0xE0,  // 25: Very light blue
    0x78, 0xC8, 0xE8,  // 26: Light cyan
    0x68, 0xB0, 0xDC,  // 27: Sky blue
    0x98, 0xB8, 0xC8,  // 28: Light gray-blue
    0xA0, 0xCC, 0xA0,  // 29: Light green
    0x00, 0x00, 0x00,  // 30: Black
    0x00, 0x00, 0x00,  // 31: Black
    
    // Color 32-47: More bright colors
    0xFC, 0xFC, 0xFC,  // 32: Bright white
    0xF8, 0x98, 0xF8,  // 33: Pink
    0xA0, 0xBC, 0xFC,  // 34: Light blue
    0x90, 0xC0, 0xFC,  // 35: Lighter blue
    0xB0, 0xCC, 0xFC,  // 36: Pale blue
    0xC0, 0xDC, 0xFC,  // 37: Very pale blue
    0x00, 0x00, 0x00,  // 38: Black
    0x00, 0x00, 0x00,  // 39: Black
    
    // Color 40-55: Bright pinks and purples
    0xFC, 0xFC, 0xFC,  // 40: Bright white
    0xFC, 0x90, 0xB0,  // 41: Light pink
    0xFC, 0x70, 0xA0,  // 42: Pink
    0xFC, 0x50, 0x90,  // 43: Bright pink
    0xFC, 0x30, 0x80,  // 44: Red-pink
    0xFC, 0x10, 0x70,  // 45: Red
    0x00, 0x00, 0x00,  // 46: Black
    0x00, 0x00, 0x00,  // 47: Black
    
    // Color 48-63: Reds and oranges
    0xFC, 0xFC, 0xFC,  // 48: Bright white
    0xFC, 0x00, 0x60,  // 49: Bright red
    0xFC, 0x00, 0x40,  // 50: Red
    0xFC, 0x00, 0x20,  // 51: Dark red
    0xC0, 0x00, 0x20,  // 52: Darker red
    0x80, 0x00, 0x20,  // 53: Very dark red
    0x00, 0x00, 0x00,  // 54: Black
    0x00, 0x00, 0x00,  // 55: Black
    
    // Fill remaining colors with simple patterns
    // Color 56-63: Simple patterns
    0x40, 0x40, 0x40,  // 56: Medium gray
    0x60, 0x60, 0x60,  // 57: Light gray
    0x80, 0x80, 0x80,  // 58: Lighter gray
    0xA0, 0xA0, 0xA0,  // 59: Pale gray
    0xC0, 0xC0, 0xC0,  // 60: Very pale gray
    0xE0, 0xE0, 0xE0,  // 61: Nearly white
    0xFF, 0xFF, 0xFF,  // 62: White
    0xFF, 0xFF, 0xFF,  // 63: White
  ];
  
  return new Uint8Array(paletteData);
}

// Create a separate JavaScript file to initialize the palette
function createPaletteInitScript() {
  const jsContent = `
// Palette initialization script
// This will be loaded to initialize the NES palette in WASM memory

window.initNESPalette = function(memory) {
  const paletteData = new Uint8Array([
${createPaletteData().join(', ')}
  ]);
  
  // Write palette to WASM memory at palette location (98304)
  const paletteView = new Uint8Array(memory, 98304, paletteData.length);
  paletteView.set(paletteData);
  
  console.log('[NES Palette] Initialized with', paletteData.length / 3, 'colors');
  return true;
};
`;
  
  return jsContent;
}

const paletteScriptPath = path.join(__dirname, '../public/wasm/palette-init.js');

try {
  const scriptContent = createPaletteInitScript();
  fs.writeFileSync(paletteScriptPath, scriptContent);
  console.log('[Palette] Palette initialization script created!');
  console.log(`[Palette] Script: ${paletteScriptPath}`);
} catch (error) {
  console.error('[Palette] Error creating palette script:', error);
  process.exit(1);
}