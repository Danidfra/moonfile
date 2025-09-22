/**
 * ROM Utilities
 *
 * Helpers for base64 decoding, NES ROM header validation, and SHA256 hash checking.
 */

export interface INesHeader {
  magic: number[];      // [0x4E, 0x45, 0x53, 0x1A]
  prgBanks: number;     // Number of PRG-ROM banks (16KB each)
  chrBanks: number;     // Number of CHR-ROM banks (8KB each)
  mapper: number;       // Mapper number
  hasBattery: boolean;  // Battery-backed PRG RAM
  hasTrainer: boolean;  // 512-byte trainer at 0x7000-0x71FF
  isVSUnisystem: boolean; // VS Unisystem
  isPlayChoice10: boolean; // PlayChoice-10
  isNES2_0: boolean;    // NES 2.0 format
}

/**
 * Decode base64 string to bytes
 * @param str Base64 encoded string
 * @returns Decoded bytes as Uint8Array
 */
export function decodeBase64ToBytes(str: string): Uint8Array {
  console.log('[ROM] Decoding base64 ROM, input length:', str.length);

  // Clean Base64 string (remove whitespace)
  const clean = str.replace(/\s+/g, "");
  console.log('[ROM] Cleaned base64 length:', clean.length);

  // Add padding if needed
  const pad = clean + "=".repeat((4 - (clean.length % 4)) % 4);

  try {
    const bin = atob(pad);
    console.log('[ROM] Base64 decoded to binary, length:', bin.length);

    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }

    // Log first and last 16 bytes in hex
    const firstBytes = Array.from(bytes.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    const lastBytes = Array.from(bytes.slice(-16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');

    console.log('[ROM] First 16 bytes:', firstBytes);
    console.log('[ROM] Last 16 bytes:', lastBytes);
    console.log('[ROM] Total ROM size:', bytes.length, 'bytes');

    return bytes;
  } catch (error) {
    console.error("[ROM] Base64 decoding failed:", error);
    throw new Error(`Base64 decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse iNES header from ROM bytes
 * @param bytes ROM data
 * @returns Parsed header information
 */
export function parseINesHeader(bytes: Uint8Array): INesHeader {
  console.log('[ROM] Parsing iNES header');

  if (bytes.length < 16) {
    throw new Error('ROM too small for iNES header (minimum 16 bytes required)');
  }

  const magic = Array.from(bytes.slice(0, 4));

  // Validate magic bytes (NES\x1A)
  if (magic[0] !== 0x4E || magic[1] !== 0x45 || magic[2] !== 0x53 || magic[3] !== 0x1A) {
    const magicHex = magic.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
    throw new Error(`Invalid NES header magic bytes: ${magicHex} (expected: 0x4E 0x45 0x53 0x1A)`);
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

  const header = {
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

  return header;
}

/**
 * Compute SHA256 hash of ROM data
 * @param bytes ROM data
 * @returns Promise that resolves to hex-encoded SHA256 hash
 */
export async function sha256(bytes: Uint8Array): Promise<string> {
  console.log('[ROM] Computing SHA256 hash for', bytes.length, 'bytes');

  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  console.log('[ROM] SHA256 hash computed:', hash.substring(0, 16) + '...');

  return hash;
}

/**
 * Validate NES ROM format and structure
 * @param bytes ROM data to validate
 * @throws Error if ROM is invalid
 */
export function validateNESRom(bytes: Uint8Array): void {
  console.log('[ROM] Validating NES ROM, size:', bytes.length, 'bytes');

  // Basic size check
  if (bytes.length < 16) {
    throw new Error('ROM too small: must be at least 16 bytes for iNES header');
  }

  // Parse and validate header
  const header = parseINesHeader(bytes);

  // Calculate expected minimum ROM size
  let minSize = 16; // iNES header
  minSize += header.prgBanks * 16384; // PRG-ROM banks (16KB each)
  minSize += header.chrBanks * 8192;  // CHR-ROM banks (8KB each)

  if (header.hasTrainer) {
    minSize += 512; // Trainer data
  }

  if (bytes.length < minSize) {
    throw new Error(
      `ROM too small for declared banks: expected at least ${minSize} bytes, got ${bytes.length} bytes`
    );
  }

  // Validate bank counts
  if (header.prgBanks === 0) {
    throw new Error('Invalid ROM: PRG-ROM bank count cannot be zero');
  }

  // Additional validation for specific cases
  const warnings: string[] = [];
  const info: string[] = [];

  // Check mapper support
  if (header.mapper > 255) {
    warnings.push(`Unusual mapper number: ${header.mapper}`);
  }

  // Common mapper info
  const mapperNames: Record<number, string> = {
    0: 'NROM',
    1: 'MMC1',
    2: 'UNROM',
    3: 'CNROM',
    4: 'MMC3',
    7: 'AxROM',
    9: 'MMC2',
    10: 'MMC4',
    11: 'Color Dreams',
    66: 'GxROM'
  };

  const mapperName = mapperNames[header.mapper] || `Unknown (${header.mapper})`;
  info.push(`Mapper: ${header.mapper} (${mapperName})`);

  // CHR RAM vs CHR ROM
  if (header.chrBanks === 0) {
    info.push('Uses CHR RAM (no CHR-ROM banks)');
  } else {
    info.push(`CHR-ROM: ${header.chrBanks} banks (${header.chrBanks * 8}KB)`);
  }

  // Mirroring info
  if (header.isVSUnisystem) {
    info.push('VS Unisystem cartridge');
  } else if (header.isPlayChoice10) {
    info.push('PlayChoice-10 cartridge');
  }

  // Size analysis
  const actualSize = bytes.length;
  const expectedSize = minSize;
  if (actualSize !== expectedSize) {
    const diff = actualSize - expectedSize;
    if (diff > 0) {
      info.push(`Extra data: +${diff} bytes (possibly padding or additional data)`);
    }
  }

  // NES 2.0 format
  if (header.isNES2_0) {
    info.push('NES 2.0 format detected');
  }

  // Log all findings
  console.log('[ROM] ROM validation passed:', {
    mapper: header.mapper,
    mapperName,
    prgBanks: header.prgBanks,
    chrBanks: header.chrBanks,
    totalSize: bytes.length,
    expectedSize: minSize,
    hasTrainer: header.hasTrainer,
    hasBattery: header.hasBattery,
    isNES2_0: header.isNES2_0,
    mirroring: header.isVSUnisystem ? 'VS' : header.isPlayChoice10 ? 'PC10' : (bytes[6] & 0x01 ? 'vertical' : 'horizontal')
  });

  if (info.length > 0) {
    console.log('[ROM] Additional info:', info);
  }

  if (warnings.length > 0) {
    console.warn('[ROM] Warnings:', warnings);
  }

  // Check for potential emulator compatibility issues
  const compatibilityIssues: string[] = [];

  if (header.mapper === 2 && header.chrBanks === 0) {
    compatibilityIssues.push('UNROM with CHR RAM - ensure emulator supports CHR RAM allocation');
  }

  if (header.mapper > 4 && header.mapper !== 7) {
    compatibilityIssues.push(`Advanced mapper ${header.mapper} - may require specialized emulator support`);
  }

  if (header.hasTrainer) {
    compatibilityIssues.push('ROM has trainer data - ensure emulator handles 512-byte trainer offset');
  }

  if (actualSize > 1024 * 1024) { // > 1MB
    compatibilityIssues.push('Large ROM size - may hit WASM memory constraints');
  }

  if (compatibilityIssues.length > 0) {
    console.warn('[ROM] Potential emulator compatibility issues:', compatibilityIssues);
  }
}