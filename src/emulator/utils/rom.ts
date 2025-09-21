export interface INesHeader {
  magic: number[];      // [0x4E, 0x45, 0x53, 0x1A]
  prgBanks: number;     // Number of PRG-ROM banks
  chrBanks: number;     // Number of CHR-ROM banks
  mapper: number;        // Mapper number
  hasBattery: boolean;   // Battery-backed PRG RAM
  hasTrainer: boolean;  // 512-byte trainer at 0x7000-0x71FF
  isVSUnisystem: boolean; // VS Unisystem
  isPlayChoice10: boolean; // PlayChoice-10
  isNES2_0: boolean;    // NES 2.0 format
}

export function decodeBase64ToBytes(str: string): Uint8Array {
  if (localStorage.getItem('debug')?.includes('retro:*')) {
    console.log('[ROM] decodeBase64ToBytes input length:', str.length);
  }

  // Clean Base64 string
  const clean = str.replace(/\s+/g, "");

  if (localStorage.getItem('debug')?.includes('retro:*')) {
    console.log('[ROM] clean length:', clean.length);
  }

  // Add padding if needed
  const pad = clean + "=".repeat((4 - (clean.length % 4)) % 4);

  if (localStorage.getItem('debug')?.includes('retro:*')) {
    console.log('[ROM] padded length:', pad.length);
  }

  try {
    const bin = atob(pad);

    if (localStorage.getItem('debug')?.includes('retro:*')) {
      console.log('[ROM] atob success, binary length:', bin.length);
    }

    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }

    if (localStorage.getItem('debug')?.includes('retro:*')) {
      console.log('[ROM] bytes array length:', bytes.length);
    }

    return bytes;
  } catch (error) {
    console.error("[ROM] atob failed:", error);
    throw new Error(`Base64 decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function parseINesHeader(bytes: Uint8Array): INesHeader {
  if (bytes.length < 16) {
    throw new Error('ROM too small for iNES header');
  }

  const magic = Array.from(bytes.slice(0, 4));

  // Validate magic bytes
  if (magic[0] !== 0x4E || magic[1] !== 0x45 || magic[2] !== 0x53 || magic[3] !== 0x1A) {
    throw new Error(`Invalid iNES header: ${magic.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  }

  const prgBanks = bytes[4];
  const chrBanks = bytes[5];

  // Extract mapper from flags 6 and 7
  const flags6 = bytes[6];
  const flags7 = bytes[7];
  const mapper = (flags6 >> 4) | (flags7 & 0xF0);

  const hasBattery = (flags6 & 0x02) !== 0;
  const hasTrainer = (flags6 & 0x04) !== 0;
  const isVSUnisystem = (flags6 & 0x01) !== 0;
  const isPlayChoice10 = (flags7 & 0x02) !== 0;

  // Check for NES 2.0 format
  const isNES2_0 = (flags7 & 0x0C) === 0x08;

  if (localStorage.getItem('debug')?.includes('retro:*')) {
    console.log('[ROM] Parsed iNES header:', {
      magic: magic.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '),
      prgBanks,
      chrBanks,
      mapper,
      hasBattery,
      hasTrainer,
      isVSUnisystem,
      isPlayChoice10,
      isNES2_0
    });
  }

  return {
    magic,
    prgBanks,
    chrBanks,
    mapper,
    hasBattery,
    hasTrainer,
    isVSUnisystem,
    isPlayChoice10,
    isNES2_0
  };
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  if (localStorage.getItem('debug')?.includes('retro:*')) {
    console.log('[ROM] Computing SHA256 for', bytes.length, 'bytes');
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (localStorage.getItem('debug')?.includes('retro:*')) {
    console.log('[ROM] SHA256 computed:', hash.substring(0, 8) + '...');
  }

  return hash;
}

export function validateNESRom(bytes: Uint8Array): void {
  if (localStorage.getItem('debug')?.includes('retro:*')) {
    console.log('[ROM] Validating NES ROM:', {
      size: bytes.length,
      header: Array.from(bytes.slice(0, 16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
    });
  }

  // Basic size check
  if (bytes.length < 16) {
    throw new Error('ROM too small: must be at least 16 bytes');
  }

  // Parse and validate header
  const header = parseINesHeader(bytes);

  // Additional validation based on ROM size
  let minSize = 16 + (header.prgBanks * 16384) + (header.chrBanks * 8192);
  if (header.hasTrainer) {
    minSize += 512;
  }

  if (bytes.length < minSize) {
    throw new Error(`ROM too small for declared banks: expected at least ${minSize} bytes, got ${bytes.length}`);
  }

  if (localStorage.getItem('debug')?.includes('retro:*')) {
    console.log('[ROM] ROM validation passed:', {
      mapper: header.mapper,
      prgBanks: header.prgBanks,
      chrBanks: header.chrBanks,
      totalSize: bytes.length,
      minExpected: minSize
    });
  }
}