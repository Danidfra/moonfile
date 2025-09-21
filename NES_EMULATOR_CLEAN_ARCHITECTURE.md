# NES Emulator - Clean Architecture Implementation

## Overview

This document describes the clean, minimal architecture implemented for the NES emulator, replacing the previous complex and error-prone implementation.

## Architecture Goals

1. **Separation of Concerns**: Clear boundaries between core emulation, rendering, and UI
2. **Single Source of Truth**: One core implementation, no duplicate code paths
3. **Type Safety**: Strong TypeScript interfaces and proper error handling
4. **Performance**: Efficient game loop and pixel-perfect rendering
5. **Maintainability**: Clean file structure and minimal dependencies

## File Structure

```
src/emulator/
├── NesCore.ts              # Core interface definition
├── NesPlayer.ts            # Game loop and rendering logic
├── cores/
│   └── fceuxWebAdapter.ts # FCEUX core implementation
├── utils/
│   └── rom.ts             # ROM utilities and validation
└── state/
    └── retroStore.ts       # Optional state management (zustand)

src/pages/
├── GamesPage.tsx          # Game listing with Play buttons
└── GamePage.tsx          # Individual game player page
```

## Core Components

### 1. NesCore Interface (`src/emulator/NesCore.ts`)

Defines the contract for all NES core implementations:

```typescript
export interface NesCore {
  init(): Promise<boolean>;
  loadRom(rom: Uint8Array): Promise<boolean>;
  frame(): void;
  reset(): void;
  setButton(index: number, pressed: boolean): void;
  setRunning(running: boolean): void;
  getFrameBuffer(): Uint8Array;
  getFrameSpec(): FrameSpec;
  getAudioBuffer?(): Int16Array;
}
```

**Key Features:**
- Pixel format abstraction (RGB24/RGBA32)
- Frame specification for dimensions and format
- Optional audio buffer support
- Clear initialization and loading lifecycle

### 2. FCEUX Web Adapter (`src/emulator/cores/fceuxWebAdapter.ts`)

Single implementation of the NesCore interface using FCEUX:

```typescript
export class FCEUXWebAdapter implements NesCore {
  private core: any = null;
  private frameSpec: FrameSpec = {
    width: 256,
    height: 240,
    format: 'RGB24' // Detected at runtime
  };
}
```

**Key Features:**
- Dynamic core loading from window object
- Automatic pixel format detection
- Proper error handling and validation
- NES header validation
- Debug logging support

### 3. NesPlayer (`src/emulator/NesPlayer.ts`)

Manages the game loop and canvas rendering:

```typescript
export class NesPlayer {
  private blit() {
    const spec = this.core.getFrameSpec();
    const fb = this.core.getFrameBuffer();
    // Handle RGB24 -> RGBA conversion
    // Use ImageData for efficient rendering
  }
}
```

**Key Features:**
- Single requestAnimationFrame loop
- Proper pixel format conversion (RGB24 to RGBA)
- Visibility handling (pause when tab hidden)
- Clean resource disposal
- Efficient blit with ImageData reuse

### 4. ROM Utilities (`src/emulator/utils/rom.ts`)

Handles ROM decoding and validation:

```typescript
export function decodeBase64ToBytes(str: string): Uint8Array
export function parseINesHeader(bytes: Uint8Array): INesHeader
export async function sha256(bytes: Uint8Array): Promise<string>
export function validateNESRom(bytes: Uint8Array): void
```

**Key Features:**
- Base64 decoding with proper padding
- iNES header parsing and validation
- SHA-256 hash computation
- ROM size validation
- Comprehensive error messages

## User Flow

### 1. Game Discovery
- User visits `/games` → GamesPage component
- Each game shows metadata and a "Play" button
- Clicking Play navigates to `/game/:id`

### 2. Game Loading
- GamePage fetches Nostr event by ID
- Decodes Base64 content to Uint8Array
- Validates ROM header and computes hash
- Shows "Ready to Play" state with Start button

### 3. Emulator Start
- User clicks Start (user gesture for audio)
- Lazy-loads FCEUX core dynamically
- Initializes core and loads ROM
- Creates NesPlayer and starts game loop

## Key Improvements

### 1. Single Canvas Architecture
```tsx
<div className="relative w-full aspect-[256/240]">
  <canvas
    ref={canvasRef}
    width={256}
    height={240}
    className="absolute inset-0 w-full h-full"
    style={{ imageRendering: 'pixelated' }}
  />
</div>
```

**Benefits:**
- No duplicate canvases or overlay issues
- Proper aspect ratio maintenance
- Pixel-perfect scaling
- Clean, minimal DOM structure

### 2. Pixel Format Handling
```typescript
if (format === 'RGB24') {
  // expand RGB -> RGBA
  for (let si = 0, di = 0; si < fb.length; ) {
    dst[di++] = fb[si++]; // R
    dst[di++] = fb[si++]; // G
    dst[di++] = fb[si++]; // B
    dst[di++] = 255;      // A
  }
} else {
  // RGBA32 -> copy as-is
  dst.set(fb);
}
```

**Benefits:**
- Handles both RGB24 and RGBA32 formats
- No more "Invalid frame buffer length" errors
- Efficient conversion with minimal overhead

### 3. Debug Logging
```typescript
// Enable with: localStorage.debug = 'retro:*'
if (localStorage.getItem('debug')?.includes('retro:*')) {
  console.log('[Component] Phase:', data);
}
```

**Benefits:**
- Toggleable debug output
- Namespaced logging
- No spam in production
- Detailed troubleshooting information

### 4. Error Handling
```typescript
try {
  const romBytes = decodeBase64ToBytes(content);
  validateNESRom(romBytes);
  // ... continue processing
} catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to load game');
  setStatus('error');
}
```

**Benefits:**
- Graceful error states
- User-friendly error messages
- Retry functionality
- Proper error boundaries

### 5. Resource Management
```typescript
dispose() {
  this.pause();
  document.removeEventListener('visibilitychange', this.visibilityHandler);
  // ... cleanup
}
```

**Benefits:**
- Proper cleanup on unmount
- Memory leak prevention
- Visibility handling
- Audio context management

## Acceptance Criteria Met

✅ **Clean File Layout**: All files created as specified
✅ **Routing Flow**: GamesPage → GamePage with proper navigation
✅ **Core Interface**: NesCore with proper type definitions
✅ **FCEUX Adapter**: Single implementation with format detection
✅ **Canvas Setup**: One canvas with proper scaling
✅ **NesPlayer**: Single loop with correct blit logic
✅ **ROM Utilities**: Decoding, validation, and hashing
✅ **GamePage Logic**: Clean states and proper lifecycle
✅ **Input + Audio**: Keyboard mapping and user gesture handling
✅ **Visibility + Cleanup**: Proper resource management
✅ **Debug Logging**: Toggleable namespaced logs
✅ **Error Handling**: Friendly messages and retry options

## Performance Characteristics

### Memory Usage
- Single ImageData object reused across frames
- No duplicate canvas contexts
- Proper cleanup prevents memory leaks

### Rendering Performance
- Efficient RGB24 → RGBA conversion
- Single requestAnimationFrame loop
- Hardware-accelerated canvas rendering

### Loading Performance
- Lazy core loading only when needed
- Parallel ROM decoding and validation
- Optimized Base64 decoding

## Future Extensibility

### Adding New Cores
1. Implement NesCore interface
2. Update core selection logic
3. No changes to rendering or UI

### Adding New Features
- State management already in place
- Debug logging system ready
- Error handling framework established
- Clean component boundaries

## Testing Strategy

### Unit Tests
- Core interface compliance
- ROM utility functions
- State management

### Integration Tests
- Full game loading flow
- Error scenarios
- Performance benchmarks

### Manual Testing
- Visual verification of rendering
- Audio functionality
- Keyboard input response
- Mobile compatibility

## Conclusion

This clean architecture provides a solid foundation for NES emulation in the browser with:

- **Maintainability**: Clear separation and minimal dependencies
- **Performance**: Efficient rendering and resource usage  
- **Reliability**: Comprehensive error handling and validation
- **Extensibility**: Easy to add new cores and features
- **User Experience**: Clean UI with proper feedback and controls

The implementation meets all acceptance criteria and provides a robust platform for future enhancements.