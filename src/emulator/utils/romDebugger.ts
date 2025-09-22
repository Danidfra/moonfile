/**
 * ROM Debugging Utilities
 * 
 * Tools for analyzing ROM loading failures and compatibility issues.
 */

import { parseINesHeader, type INesHeader } from './rom';

export interface RomAnalysis {
  header: INesHeader;
  size: number;
  expectedSize: number;
  mapperInfo: {
    number: number;
    name: string;
    complexity: 'simple' | 'moderate' | 'complex';
    commonIssues: string[];
  };
  memoryLayout: {
    headerSize: number;
    trainerSize: number;
    prgRomSize: number;
    chrRomSize: number;
    totalExpected: number;
    actualSize: number;
    extraBytes: number;
  };
  compatibility: {
    likelySupported: boolean;
    warnings: string[];
    requirements: string[];
  };
}

/**
 * Perform comprehensive ROM analysis
 */
export function analyzeRom(rom: Uint8Array): RomAnalysis {
  console.log('[RomDebugger] Starting comprehensive ROM analysis...');
  
  const header = parseINesHeader(rom);
  
  // Calculate memory layout
  const headerSize = 16;
  const trainerSize = header.hasTrainer ? 512 : 0;
  const prgRomSize = header.prgBanks * 16384;
  const chrRomSize = header.chrBanks * 8192;
  const totalExpected = headerSize + trainerSize + prgRomSize + chrRomSize;
  const extraBytes = rom.length - totalExpected;

  // Mapper information
  const mapperInfo = getMapperInfo(header.mapper);
  
  // Compatibility analysis
  const compatibility = analyzeCompatibility(header, rom.length);

  const analysis: RomAnalysis = {
    header,
    size: rom.length,
    expectedSize: totalExpected,
    mapperInfo,
    memoryLayout: {
      headerSize,
      trainerSize,
      prgRomSize,
      chrRomSize,
      totalExpected,
      actualSize: rom.length,
      extraBytes
    },
    compatibility
  };

  logAnalysis(analysis);
  return analysis;
}

/**
 * Get detailed mapper information
 */
function getMapperInfo(mapperNumber: number) {
  const mappers: Record<number, { name: string; complexity: 'simple' | 'moderate' | 'complex'; issues: string[] }> = {
    0: { 
      name: 'NROM', 
      complexity: 'simple', 
      issues: ['Very basic - should work in any emulator'] 
    },
    1: { 
      name: 'MMC1', 
      complexity: 'moderate', 
      issues: ['Requires bank switching support', 'Sequential write register handling'] 
    },
    2: { 
      name: 'UNROM', 
      complexity: 'simple', 
      issues: ['Often uses CHR RAM', 'Bank switching for PRG-ROM', 'Simple register at $8000-$FFFF'] 
    },
    3: { 
      name: 'CNROM', 
      complexity: 'simple', 
      issues: ['CHR-ROM bank switching', 'Register at $8000-$FFFF'] 
    },
    4: { 
      name: 'MMC3', 
      complexity: 'complex', 
      issues: ['Complex bank switching', 'IRQ timer', 'Multiple registers', 'PRG/CHR switching'] 
    },
    7: { 
      name: 'AxROM', 
      complexity: 'moderate', 
      issues: ['32KB PRG switching', 'Single screen mirroring control'] 
    },
    9: { 
      name: 'MMC2', 
      complexity: 'complex', 
      issues: ['Latch-based CHR switching', 'Complex state tracking'] 
    },
    11: { 
      name: 'Color Dreams', 
      complexity: 'simple', 
      issues: ['Simple bank switching', 'Non-standard register location'] 
    }
  };

  const info = mappers[mapperNumber];
  if (info) {
    return {
      number: mapperNumber,
      name: info.name,
      complexity: info.complexity,
      commonIssues: info.issues
    };
  }

  // Unknown mapper
  return {
    number: mapperNumber,
    name: `Unknown Mapper ${mapperNumber}`,
    complexity: 'complex' as const,
    commonIssues: [
      'Unknown mapper - likely not supported',
      'May require specialized emulator',
      'Could be homebrew or rare commercial game'
    ]
  };
}

/**
 * Analyze emulator compatibility
 */
function analyzeCompatibility(header: INesHeader, romSize: number) {
  const warnings: string[] = [];
  const requirements: string[] = [];
  let likelySupported = true;

  // Mapper support
  if (header.mapper > 4 && header.mapper !== 7 && header.mapper !== 11) {
    warnings.push(`Advanced mapper ${header.mapper} may not be supported`);
    likelySupported = false;
  }

  // CHR RAM handling
  if (header.chrBanks === 0) {
    requirements.push('Emulator must support CHR RAM allocation (8KB)');
    if (header.mapper === 2) {
      requirements.push('UNROM with CHR RAM - common but requires proper implementation');
    }
  }

  // Trainer handling
  if (header.hasTrainer) {
    requirements.push('Emulator must handle 512-byte trainer offset');
    warnings.push('Trainer data present - not all emulators support this');
  }

  // Battery backing
  if (header.hasBattery) {
    requirements.push('Save RAM support needed for battery-backed games');
  }

  // Size constraints
  if (romSize > 512 * 1024) { // > 512KB
    warnings.push('Large ROM size may hit WASM memory constraints');
  }

  if (romSize > 1024 * 1024) { // > 1MB
    warnings.push('Very large ROM - likely to cause memory issues in browser');
    likelySupported = false;
  }

  // Special cartridge types
  if (header.isVSUnisystem) {
    warnings.push('VS Unisystem ROM - requires specialized emulator support');
    likelySupported = false;
  }

  if (header.isPlayChoice10) {
    warnings.push('PlayChoice-10 ROM - requires specialized emulator support');
    likelySupported = false;
  }

  // NES 2.0 format
  if (header.isNES2_0) {
    requirements.push('NES 2.0 format support needed');
  }

  return {
    likelySupported,
    warnings,
    requirements
  };
}

/**
 * Log comprehensive analysis results
 */
function logAnalysis(analysis: RomAnalysis) {
  console.group('[RomDebugger] ROM Analysis Results');
  
  // Basic info
  console.log('📋 Basic Information:', {
    size: `${analysis.size} bytes`,
    mapper: `${analysis.mapperInfo.number} (${analysis.mapperInfo.name})`,
    complexity: analysis.mapperInfo.complexity,
    prgBanks: analysis.header.prgBanks,
    chrBanks: analysis.header.chrBanks || 'CHR RAM'
  });

  // Memory layout
  console.log('🗂️ Memory Layout:', {
    header: `${analysis.memoryLayout.headerSize} bytes`,
    trainer: analysis.memoryLayout.trainerSize ? `${analysis.memoryLayout.trainerSize} bytes` : 'none',
    prgRom: `${analysis.memoryLayout.prgRomSize} bytes (${analysis.header.prgBanks} banks)`,
    chrRom: analysis.memoryLayout.chrRomSize ? `${analysis.memoryLayout.chrRomSize} bytes (${analysis.header.chrBanks} banks)` : 'CHR RAM',
    expected: `${analysis.memoryLayout.totalExpected} bytes`,
    actual: `${analysis.memoryLayout.actualSize} bytes`,
    extra: analysis.memoryLayout.extraBytes ? `+${analysis.memoryLayout.extraBytes} bytes` : 'exact match'
  });

  // Mapper details
  console.log('🎮 Mapper Information:', {
    name: analysis.mapperInfo.name,
    complexity: analysis.mapperInfo.complexity,
    issues: analysis.mapperInfo.commonIssues
  });

  // Compatibility
  const compatIcon = analysis.compatibility.likelySupported ? '✅' : '⚠️';
  console.log(`${compatIcon} Compatibility:`, {
    supported: analysis.compatibility.likelySupported ? 'Likely' : 'Uncertain',
    requirements: analysis.compatibility.requirements,
    warnings: analysis.compatibility.warnings
  });

  console.groupEnd();
}

/**
 * Generate ROM loading recommendations
 */
export function generateRecommendations(analysis: RomAnalysis): string[] {
  const recommendations: string[] = [];

  if (!analysis.compatibility.likelySupported) {
    recommendations.push('⚠️ This ROM may not work with simple emulator cores');
  }

  if (analysis.header.chrBanks === 0) {
    recommendations.push('💾 Ensure your emulator allocates 8KB CHR RAM for this ROM');
  }

  if (analysis.mapperInfo.complexity === 'complex') {
    recommendations.push('🔧 Complex mapper detected - use a full-featured emulator core');
  }

  if (analysis.memoryLayout.extraBytes > 0) {
    recommendations.push(`📦 ROM has ${analysis.memoryLayout.extraBytes} extra bytes - possibly padding`);
  }

  if (analysis.header.hasTrainer) {
    recommendations.push('🎯 ROM has trainer - ensure emulator handles 512-byte offset');
  }

  if (analysis.size > 512 * 1024) {
    recommendations.push('💾 Large ROM - check WASM memory limits');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ ROM looks compatible with most emulators');
  }

  return recommendations;
}

/**
 * Quick compatibility check
 */
export function quickCompatibilityCheck(rom: Uint8Array): { compatible: boolean; reason?: string } {
  try {
    const header = parseINesHeader(rom);
    
    // Check for obvious incompatibilities
    if (header.mapper > 11 && header.mapper !== 66) {
      return { compatible: false, reason: `Unsupported mapper: ${header.mapper}` };
    }
    
    if (header.isVSUnisystem || header.isPlayChoice10) {
      return { compatible: false, reason: 'Special cartridge type not supported' };
    }
    
    if (rom.length > 1024 * 1024) {
      return { compatible: false, reason: 'ROM too large for browser emulator' };
    }
    
    return { compatible: true };
    
  } catch (error) {
    return { compatible: false, reason: error instanceof Error ? error.message : 'Invalid ROM format' };
  }
}