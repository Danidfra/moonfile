#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create minimal 1x1 black PNG icons to satisfy manifest
function createMinimalPNG() {
  // This is a minimal valid 1x1 PNG file (black pixel)
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
    0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x7F, 0x78, 0xDA, 0x62, 0x00,
    0x01, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
    0x60, 0x82
  ]);
}

async function createIcons() {
  console.log('[Icons] Creating minimal placeholder icons...');
  
  const iconsDir = path.join(__dirname, '../public/icons');
  
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  try {
    const minimalPNG = createMinimalPNG();
    
    // Create 192x192 icon
    fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), minimalPNG);
    console.log('[Icons] Created icon-192.png');
    
    // Create 512x512 icon
    fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), minimalPNG);
    console.log('[Icons] Created icon-512.png');
    
    console.log('[Icons] All placeholder icons created successfully!');
  } catch (error) {
    console.error('[Icons] Error creating icons:', error);
  }
}

createIcons().catch(console.error);