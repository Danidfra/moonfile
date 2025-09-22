#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create simple placeholder PNG icons
function createPlaceholderIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Draw a simple NES controller icon
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  
  // Draw controller shape
  ctx.fillStyle = '#808080';
  const centerX = size / 2;
  const centerY = size / 2;
  const scale = size / 64;
  
  // Controller body
  ctx.fillRect(centerX - 20 * scale, centerY - 15 * scale, 40 * scale, 30 * scale);
  
  // D-pad
  ctx.fillRect(centerX - 15 * scale, centerY - 10 * scale, 8 * scale, 8 * scale);
  ctx.fillRect(centerX - 7 * scale, centerY - 10 * scale, 8 * scale, 8 * scale);
  ctx.fillRect(centerX - 15 * scale, centerY - 2 * scale, 8 * scale, 8 * scale);
  ctx.fillRect(centerX - 7 * scale, centerY - 2 * scale, 8 * scale, 8 * scale);
  
  // A/B buttons
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(centerX + 12 * scale, centerY - 5 * scale, 5 * scale, 0, 2 * Math.PI);
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(centerX + 12 * scale, centerY + 5 * scale, 5 * scale, 0, 2 * Math.PI);
  ctx.fill();
  
  // Add border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  
  return canvas.toBuffer('image/png');
}

async function createIcons() {
  console.log('[Icons] Creating placeholder icons...');
  
  const iconsDir = path.join(__dirname, '../public/icons');
  
  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  try {
    // Create 192x192 icon
    const icon192 = createPlaceholderIcon(192);
    fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);
    console.log('[Icons] Created icon-192.png');
    
    // Create 512x512 icon
    const icon512 = createPlaceholderIcon(512);
    fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);
    console.log('[Icons] Created icon-512.png');
    
    console.log('[Icons] All placeholder icons created successfully!');
  } catch (error) {
    console.error('[Icons] Error creating icons:', error);
    console.log('[Icons] Creating minimal fallback icons instead...');
    
    // Fallback: create simple 1x1 pixel PNG files
    const minimalPNG = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x7F, 0x78, 0xDA, 0x62, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
      0x60, 0x82
    ]);
    
    fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), minimalPNG);
    fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), minimalPNG);
    console.log('[Icons] Created minimal fallback icons');
  }
}

createIcons().catch(console.error);