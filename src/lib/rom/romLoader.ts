export interface ROMSourceURL {
  source: 'url';
  url: string;
}

export interface ROMSourceBytes {
  source: 'bytes';
  bytes: Uint8Array;
}

export interface ROMSourceNostr {
  source: 'nostr';
  event: {
    content: string;
    tags: string[][];
  };
}

export type ROMSource = ROMSourceURL | ROMSourceBytes | ROMSourceNostr;

export interface ROMLoadOptions {
  maxSize?: number; // Maximum file size in bytes (default: 4MB)
  validateHash?: {
    algorithm: 'sha256';
    expected: string;
  };
  enforceValidation?: boolean; // Whether to throw on validation errors (default: true)
}

export class ROMLoader {
  static async loadROM(source: ROMSource, options: ROMLoadOptions = {}): Promise<Uint8Array> {
    const { maxSize = 4 * 1024 * 1024, validateHash, enforceValidation = true } = options;

    let romData: Uint8Array;

    if (source.source === 'url') {
      romData = await this.loadFromURL(source.url);
    } else if (source.source === 'bytes') {
      romData = source.bytes;
    } else if (source.source === 'nostr') {
      romData = await this.decodeFromNostrEvent(source.event);
    } else {
      throw new Error('Invalid ROM source type');
    }

    // Validate size
    if (romData.length > maxSize) {
      throw new Error(`ROM too large: ${romData.length} bytes (max: ${maxSize} bytes)`);
    }

    // Validate hash if provided
    if (validateHash) {
      const isValid = await this.validateHash(romData, validateHash.algorithm, validateHash.expected);
      if (!isValid && enforceValidation) {
        throw new Error(`ROM hash validation failed for ${validateHash.algorithm}`);
      }
    }

    return romData;
  }

  private static async loadFromURL(url: string): Promise<Uint8Array> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load ROM from URL: ${error.message}`);
      }
      throw new Error('Failed to load ROM from URL');
    }
  }

  private static async decodeFromNostrEvent(event: { content: string; tags: string[][] }): Promise<Uint8Array> {
    // Extract tags
    const getTagValue = (tagName: string): string | undefined => {
      const tag = event.tags.find(t => t[0] === tagName);
      return tag?.[1];
    };

    const encoding = getTagValue('encoding') || 'base64';
    const compression = getTagValue('compression') || 'none';
    const sizeBytes = getTagValue('size') ? parseInt(getTagValue('size')!, 10) : undefined;
    const sha256 = getTagValue('sha256');
    const mime = getTagValue('mime');

    // Validate compression (only 'none' supported for now)
    if (compression !== 'none') {
      throw new Error(`Unsupported compression: ${compression}`);
    }

    // Enforce max size before decoding to guard memory
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (sizeBytes && sizeBytes > maxSize) {
      throw new Error(`ROM too large: ${sizeBytes} bytes (max: ${maxSize} bytes)`);
    }

    // Decode based on encoding
    let decodedBytes: Uint8Array;

    try {
      switch (encoding) {
        case 'base64':
          decodedBytes = this.decodeBase64(event.content);
          break;
        case 'base64url':
          decodedBytes = this.decodeBase64URL(event.content);
          break;
        case 'hex':
          decodedBytes = this.decodeHex(event.content);
          break;
        default:
          throw new Error(`Unsupported encoding: ${encoding}`);
      }
    } catch (error) {
      throw new Error(`Failed to decode ${encoding}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate size after decoding
    if (sizeBytes && decodedBytes.length !== sizeBytes) {
      throw new Error(`Size mismatch: expected ${sizeBytes} bytes, got ${decodedBytes.length} bytes`);
    }

    // Validate SHA256 if provided
    if (sha256) {
      const computedHash = await this.computeSHA256(decodedBytes);
      if (computedHash !== sha256.toLowerCase()) {
        throw new Error(`SHA256 mismatch: expected ${sha256}, got ${computedHash}`);
      }
    }

    // Optional: Warn about MIME type
    if (mime && mime !== 'application/x-nes-rom') {
      console.warn(`Unexpected MIME type: ${mime} (expected application/x-nes-rom)`);
    }

    return decodedBytes;
  }

  private static async validateHash(data: Uint8Array, algorithm: string, expected: string): Promise<boolean> {
    if (algorithm !== 'sha256') {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }

    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return hashHex === expected.toLowerCase();
    } catch (error) {
      console.error('Hash validation error:', error);
      return false;
    }
  }

  private static async computeSHA256(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private static decodeBase64(base64: string): Uint8Array {
    // Normalize/pad Base64; strip whitespace/newlines
    const normalized = base64.trim().replace(/\s+/g, '');

    // Add padding if needed
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const padded = normalized + padding;

    try {
      const binaryString = atob(padded);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      throw new Error('Invalid Base64 data');
    }
  }

  private static decodeBase64URL(base64url: string): Uint8Array {
    // Convert Base64URL to Base64
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    base64 += padding;

    return this.decodeBase64(base64);
  }

  private static decodeHex(hex: string): Uint8Array {
    // Strip whitespace and validate
    const normalized = hex.trim().replace(/\s+/g, '');

    if (!/^[0-9a-fA-F]*$/.test(normalized)) {
      throw new Error('Invalid hexadecimal data');
    }

    if (normalized.length % 2 !== 0) {
      throw new Error('Hexadecimal string must have even length');
    }

    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
      bytes[i / 2] = parseInt(normalized.substr(i, 2), 16);
    }

    return bytes;
  }

  static async validateNESROM(romData: Uint8Array): Promise<boolean> {
    // Basic NES ROM validation
    // Check if the ROM has a valid header
    if (romData.length < 16) {
      return false;
    }

    // Check for NES header "NES^Z" (0x4E 0x45 0x53 0x1A)
    const header = new Uint8Array(romData.buffer, romData.byteOffset, 4);
    const expectedHeader = new Uint8Array([0x4E, 0x45, 0x53, 0x1A]);

    return header.every((byte, index) => byte === expectedHeader[index]);
  }

  static getROMInfo(romData: Uint8Array): {
    isValid: boolean;
    mapper: number;
    prgBanks: number;
    chrBanks: number;
    hasBattery: boolean;
    hasTrainer: boolean;
    isVSUnisystem: boolean;
    isPlayChoice10: boolean;
    isNES2_0: boolean;
  } {
    const result = {
      isValid: false,
      mapper: 0,
      prgBanks: 0,
      chrBanks: 0,
      hasBattery: false,
      hasTrainer: false,
      isVSUnisystem: false,
      isPlayChoice10: false,
      isNES2_0: false,
    };

    if (romData.length < 16) {
      return result;
    }

    // Check NES header
    const header = new Uint8Array(romData.buffer, romData.byteOffset, 16);
    const expectedHeader = new Uint8Array([0x4E, 0x45, 0x53, 0x1A]);

    if (!header.every((byte, index) => byte === expectedHeader[index])) {
      return result;
    }

    result.isValid = true;
    result.prgBanks = header[4];
    result.chrBanks = header[5];

    // Flags 6
    const flags6 = header[6];
    result.mapper = (flags6 >> 4) | (header[7] & 0xF0);
    result.hasBattery = (flags6 & 0x02) !== 0;
    result.hasTrainer = (flags6 & 0x04) !== 0;
    result.isVSUnisystem = (flags6 & 0x01) !== 0;

    // Flags 7
    const flags7 = header[7];
    result.isPlayChoice10 = (flags7 & 0x02) !== 0;
    result.isVSUnisystem = result.isVSUnisystem || ((flags7 & 0x01) !== 0);

    // Check for NES 2.0 format
    if ((flags7 & 0x0C) === 0x08) {
      result.isNES2_0 = true;
    }

    return result;
  }

  static async validateROMFromNostrEvent(event: { content: string; tags: string[][] }): Promise<{
    isValid: boolean;
    decodedBytes?: Uint8Array;
    error?: string;
    actualSize?: number;
    expectedSize?: number;
    actualHash?: string;
    expectedHash?: string;
    encoding?: string;
    compression?: string;
    shortHash?: string;
  }> {
    try {
      const decodedBytes = await this.decodeFromNostrEvent(event);
      const computedHash = await this.computeSHA256(decodedBytes);

      // Get tag values
      const getTagValue = (tagName: string): string | undefined => {
        const tag = event.tags.find(t => t[0] === tagName);
        return tag?.[1];
      };

      const expectedSize = getTagValue('size') ? parseInt(getTagValue('size')!, 10) : undefined;
      const expectedHash = getTagValue('sha256');
      const encoding = getTagValue('encoding') || 'base64';
      const compression = getTagValue('compression') || 'none';

      // Check size validation
      const sizeMatches = !expectedSize || decodedBytes.length === expectedSize;

      // Check hash validation
      const hashMatches = !expectedHash || computedHash === expectedHash.toLowerCase();

      return {
        isValid: sizeMatches && hashMatches,
        decodedBytes,
        actualSize: decodedBytes.length,
        expectedSize,
        actualHash: computedHash,
        expectedHash,
        encoding,
        compression,
        shortHash: computedHash.substring(0, 8),
        error: !sizeMatches ? 'Size mismatch' : !hashMatches ? 'SHA256 mismatch' : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static autoDetectEncoding(content: string): 'base64' | 'base64url' | 'hex' | 'unknown' {
    // Try to detect encoding based on content patterns
    const trimmed = content.trim();

    // Check for hex (only hex characters, even length)
    if (/^[0-9a-fA-F]*$/.test(trimmed) && trimmed.length % 2 === 0 && trimmed.length >= 32) {
      return 'hex';
    }

    // Check for base64url (contains - or _, no + or /, no = padding)
    if (trimmed.includes('-') || trimmed.includes('_')) {
      if (!trimmed.includes('+') && !trimmed.includes('/')) {
        return 'base64url';
      }
    }

    // Check for base64 (contains + or /, standard characters)
    if (/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed) && trimmed.length > 10) {
      return 'base64';
    }

    return 'unknown';
  }
}