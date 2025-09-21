#!/usr/bin/env node

// Script to find and download a working NES WebAssembly core

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NES_CORES = [
  {
    name: 'QuickNES',
    url: 'https://unpkg.com/quicknes-wasm@latest/dist/quicknes-wasm.wasm',
    jsUrl: 'https://unpkg.com/quicknes-wasm@latest/dist/quicknes-wasm.js'
  },
  {
    name: 'FCEUX',
    url: 'https://unpkg.com/fceux-web@latest/dist/fceux-web.wasm',
    jsUrl: 'https://unpkg.com/fceux-web@latest/dist/fceux-web.js'
  },
  {
    name: 'Mesen',
    url: 'https://unpkg.com/mesen-wasm@latest/dist/mesen-wasm.wasm',
    jsUrl: 'https://unpkg.com/mesen-wasm@latest/dist/mesen-wasm.js'
  }
];

function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  const libDir = path.join(__dirname, '..', 'public', 'lib', 'fceux');

  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  console.log('Searching for NES WebAssembly cores...');

  for (const core of NES_CORES) {
    console.log(`\nTrying ${core.name}...`);

    try {
      const wasmPath = path.join(libDir, `${core.name.toLowerCase()}-web.wasm`);
      const jsPath = path.join(libDir, `${core.name.toLowerCase()}-web.js`);

      await downloadFile(core.url, wasmPath);
      await downloadFile(core.jsUrl, jsPath);

      console.log(`✅ ${core.name} downloaded successfully!`);
      return { name: core.name, wasmPath, jsPath };
    } catch (error) {
      console.log(`❌ ${core.name} failed: ${error.message}`);
    }
  }

  console.log('\n❌ No NES cores found. Will create a minimal implementation.');
  return null;
}

main().then((result) => {
  if (result) {
    console.log(`\n🎮 Using ${result.name} as NES core`);
  } else {
    console.log('\n🔧 No NES core available - will use minimal implementation');
  }
}).catch(console.error);