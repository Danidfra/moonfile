#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { readFileSync } from 'fs';

// Read our test ROM
const romPath = 'public/roms/test-rom.nes';
const romBuffer = readFileSync(romPath);
const romBytes = new Uint8Array(romBuffer);

// Convert to Base64
const base64 = Buffer.from(romBytes).toString('base64');

// Compute SHA256
async function computeSHA256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Create test Nostr event
async function createTestEvent() {
  const sha256 = await computeSHA256(romBytes);
  
  const event = {
    id: 'test-event-id',
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 31996,
    tags: [
      ['d', 'test-game'],
      ['name', 'Test NES Game'],
      ['summary', 'A test NES game for Phase 2 implementation'],
      ['t', 'test'],
      ['t', 'singleplayer'],
      ['platform', 'NES'],
      ['status', 'released'],
      ['version', '1.0.0'],
      ['credits', 'Test Developer'],
      ['encoding', 'base64'],
      ['compression', 'none'],
      ['size', romBytes.length.toString()],
      ['sha256', sha256],
      ['mime', 'application/x-nes-rom'],
      ['image', 'cover', 'https://via.placeholder.com/400/300/6366f1/ffffff?text=Test+Game+Cover'],
      ['image', 'screenshot', 'https://via.placeholder.com/320/240/6366f1/ffffff?text=Screenshot+1'],
      ['image', 'screenshot', 'https://via.placeholder.com/320/240/6366f1/ffffff?text=Screenshot+2'],
    ],
    content: base64,
    sig: 'test-signature'
  };

  // Save to file
  writeFileSync('public/test-event.json', JSON.stringify(event, null, 2));
  
  console.log('Test Nostr event created: public/test-event.json');
  console.log(`ROM size: ${romBytes.length} bytes`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Base64 length: ${base64.length} characters`);
}

createTestEvent().catch(console.error);