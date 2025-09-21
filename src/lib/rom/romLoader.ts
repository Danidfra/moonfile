export interface ROMSourceURL {
  source: 'url';
  url: string;
}

export interface ROMSourceBytes {
  source: 'bytes';
  bytes: Uint8Array;
}

export type ROMSource = ROMSourceURL | ROMSourceBytes;

export interface ROMLoadOptions {
  maxSize?: number; // Maximum file size in bytes (default: 4MB)
  validateHash?: {
    algorithm: 'sha256';
    expected: string;
  };
}

export class ROMLoader {
  static async loadROM(source: ROMSource, options: ROMLoadOptions = {}): Promise<Uint8Array> {
    const { maxSize = 4 * 1024 * 1024, validateHash } = options;

    let romData: Uint8Array;

    if (source.source === 'url') {
      romData = await this.loadFromURL(source.url);
    } else if (source.source === 'bytes') {
      romData = source.bytes;
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
      if (!isValid) {
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
}