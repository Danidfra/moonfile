#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { get } from 'https';

const FCEUX_WASM_URL = 'https://raw.githubusercontent.com/TASEmulators/fceux-web/master/dist/fceux-web.wasm';
const FCEUX_JS_URL = 'https://raw.githubusercontent.com/TASEmulators/fceux-web/master/dist/fceux-web.js';

const downloadFile = (url, filePath) => {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        writeFileSync(filePath, data);
        console.log(`Downloaded ${filePath}`);
        resolve();
      });
    }).on('error', reject);
  });
};

const main = async () => {
  const libDir = join(process.cwd(), 'public', 'lib', 'fceux');

  if (!existsSync(libDir)) {
    mkdirSync(libDir, { recursive: true });
  }

  console.log('Downloading FCEUX WebAssembly...');

  try {
    await downloadFile(FCEUX_WASM_URL, join(libDir, 'fceux-web.wasm'));
    await downloadFile(FCEUX_JS_URL, join(libDir, 'fceux-web.js'));

    console.log('FCEUX WebAssembly downloaded successfully!');
  } catch (error) {
    console.error('Error downloading FCEUX:', error.message);
    process.exit(1);
  }
};

main();