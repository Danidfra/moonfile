# Retro Game Player - Phase 2 Implementation

## Overview

This document describes the Phase 2 implementation of the NES Retro Game Player for the MoonFile platform. This implementation allows users to play NES games directly in their browser with a polished, responsive interface, with ROMs loaded from Nostr kind:31996 events.

## Features Implemented

### 🎮 Core Functionality (Phase 1)
- **NES Emulation**: Uses jsnes library for accurate NES emulation
- **ROM Loading**: Supports loading ROMs from static URLs with validation
- **Game Controls**: Full keyboard support with customizable controls
- **Audio Support**: Web Audio API integration with browser autoplay compliance
- **Fullscreen Mode**: Native browser fullscreen support
- **Responsive Design**: Desktop-first design with mobile optimization

### 🎮 Core Functionality (Phase 2)
- **Nostr Integration**: Load ROMs from kind:31996 events
- **Multiple Encodings**: Support for Base64, Base64URL, and Hex decoding
- **ROM Validation**: Size and SHA256 hash validation with detailed reporting
- **Error Handling**: Comprehensive error states for decoding and validation failures
- **Security**: Treat content as binary data with proper input validation
- **Fallback Support**: Graceful fallback to URL loading if Nostr fails
- **NES Emulation**: Uses jsnes library for accurate NES emulation
- **ROM Loading**: Supports loading ROMs from static URLs with validation
- **Game Controls**: Full keyboard support with customizable controls
- **Audio Support**: Web Audio API integration with browser autoplay compliance
- **Fullscreen Mode**: Native browser fullscreen support
- **Responsive Design**: Desktop-first design with mobile optimization

### 🎯 User Interface
- **Game Header**: Shows title, version, platform, and mapper info
- **Main Canvas**: 16:9 or 4:3 aspect ratio with pixel-perfect scaling
- **Control Bar**: Play/Pause, Reset, and status indicators
- **Side Panel**: Game metadata, ROM info, and screenshots
- **Keyboard Hints**: On-screen control reference
- **Error States**: Comprehensive error handling for various failure scenarios

### 🔧 Technical Implementation

#### Route Structure
```
/retro/:d/play
```
- `:d` - The game's d-tag identifier (e.g., `game:mummy-egyptian-puzzle:v1.1`)

#### Nostr Event Loading
- **Event Fetch**: Query kind:31996 events by d-tag
- **Content Decoding**: Support Base64, Base64URL, and Hex encodings
- **Validation**: Size and SHA256 hash validation with detailed error reporting
- **Fallback**: Graceful fallback to URL loading if Nostr fails

#### Core Components

1. **NESEmulator** (`src/lib/emulator/nesEmulator.ts`)
   - Wrapper around jsnes library
   - Canvas rendering with pixel-perfect scaling
   - Audio context management
   - Control state management
   - Proper cleanup and resource management

2. **ROMLoader** (`src/lib/rom/romLoader.ts`)
   - URL-based ROM loading
   - Size validation (4MB max)
   - NES header validation
   - SHA256 hash verification (ready for Phase 2)
   - ROM metadata extraction

3. **RetroPlayer** (`src/components/retro/RetroPlayer.tsx`)
   - Main game interface component
   - Responsive layout (desktop grid, mobile stack)
   - Game controls and state management
   - Error handling and loading states
   - Fullscreen and audio toggle

4. **Play Page** (`src/pages/retro/[d]/play.tsx`)
   - Route handler for individual games
   - Game metadata lookup from Nostr events
   - ROM source configuration
   - Navigation and error handling

## Usage

### For Users

1. **Navigate to Games**: Go to `/games` to browse available games
2. **Click Play**: Click the "Play" button on any game card
3. **Game Loads**: The system will:
   - Navigate to `/retro/:d/play`
   - Fetch kind:31996 event from Nostr by d-tag
   - Decode ROM from event content using specified encoding
   - Validate ROM size and SHA256 hash
   - Initialize emulator with decoded ROM
   - Display the game interface with validation details

### Keyboard Controls

| Action | Key |
|--------|-----|
| Direction | Arrow Keys (↑↓←→) |
| A Button | Z |
| B Button | X |
| Start | Enter |
| Select | Shift |

### Game Interface

1. **Header** - Shows game info and controls
   - Back button to return to games list
   - Game title, version, platform
   - Audio toggle and fullscreen buttons

2. **Main Area** - Game canvas and controls
   - Emulator canvas with pixel-perfect scaling
   - Play/Pause and Reset buttons
   - Status indicator (Running/Paused/Loading)
   - Keyboard control reference

3. **Side Panel** - Game information
   - Cover image and metadata
   - ROM technical details
   - Screenshots gallery
   - "Vibed with MKStack" attribution

## Configuration

### ROM Sources (Phase 2 - Primary)

ROMs are loaded from Nostr kind:31996 events with full validation:

```typescript
// Nostr event structure
{
  id: string,
  pubkey: string,
  created_at: number,
  kind: 31996,
  tags: [
    ['d', 'game-identifier'],
    ['name', 'Game Title'],
    ['encoding', 'base64'],        // base64, base64url, hex
    ['compression', 'none'],     // only 'none' supported
    ['size', '24592'],          // bytes
    ['sha256', '7c6b6e7c...'], // lowercase hex
    ['mime', 'application/x-nes-rom'],
    // ... other metadata tags
  ],
  content: 'Base64-encoded ROM data...'
}
```

### ROM Sources (Phase 1 - Fallback)

If Nostr loading fails, ROMs are loaded from static URLs based on the game's d-tag:

```typescript
const testRomUrl = `/roms/${d}.nes`;
```

Current test ROM: `/roms/test-rom.nes`

### Game Metadata

Games are loaded from Nostr kind:31996 events with the following structure:

```typescript
interface Game31996 {
  id: string;           // from tag d
  title: string;        // game title
  summary?: string;     // short description
  genres: string[];     // game genres
  modes: string[];      // game modes
  status?: string;      // alpha/beta/released
  version?: string;     // version number
  credits?: string;     // developer credits
  platforms: string[];  // supported platforms
  mime?: string;       // MIME type
  sizeBytes?: number;  // file size
  sha256?: string;     // file hash
  assets: GameAsset;   // cover, screenshots, etc.
}
```

## Error Handling

The system handles various error states:

### Phase 2 - Nostr Loading Errors
1. **Decoding State** - Shows spinner while decoding ROM from Nostr event
2. **Validation State** - Shows spinner while validating ROM integrity
3. **Decoding Error** - Failed to decode Base64/Base64URL/Hex data
4. **Validation Error** - Size or SHA256 hash mismatch
5. **Unsupported Encoding** - Encoding format not supported
6. **Unsupported Compression** - Compression format not supported (only 'none')

### Phase 1 - Fallback Errors
7. **Loading State** - Shows spinner while ROM is downloading
8. **ROM Not Found** - 404 errors when ROM URL is invalid
9. **Invalid ROM** - Non-NES files or corrupted headers
10. **Emulator Error** - jsnes initialization failures
11. **Network Error** - Failed to download ROM
12. **ROM Too Large** - Files larger than 4MB

Each error state provides clear messaging, validation details, retry options, and a path back to the games list.

## Browser Compatibility

### Desktop
- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

### Mobile
- ✅ iOS Safari 13+
- ✅ Android Chrome 80+
- ✅ Mobile Firefox 79+

**Note**: Mobile devices require user interaction to enable audio due to browser autoplay restrictions.

## Performance Considerations

1. **ROM Size**: Limited to 4MB maximum for performance
2. **Canvas Rendering**: Uses `image-rendering: pixelated` for crisp graphics
3. **Audio Context**: Properly managed to prevent memory leaks
4. **Cleanup**: All resources are disposed when navigating away
5. **Lazy Loading**: ROMs are only loaded when needed

## Phase 2 Preview

The next phase will enhance the system with:

1. **Base64 ROM Loading**: Load ROMs directly from Nostr event content
2. **Hash Verification**: Validate ROM integrity against SHA256 hashes
3. **Save States**: Persistent game state management
4. **Mobile Controls**: On-screen touch controls for mobile devices
5. **Performance Optimization**: WASM-based emulation for better performance

## Development Notes

### Adding New Games

1. Create ROM file in `public/roms/` with d-tag filename
2. Ensure ROM is valid NES format (proper header)
3. ROM should be under 4MB in size
4. Create corresponding Nostr kind:31996 event

### Testing

Test ROMs can be created using the provided script:

```bash
node scripts/create-test-rom.js
```

This creates a minimal valid NES ROM at `public/roms/test-rom.nes`.

### Phase 2 Testing

Test Nostr events can be created using the provided script:

```bash
node scripts/create-test-nostr-event.js
```

This creates a test Nostr kind:31996 event at `public/test-event.json` with a properly encoded ROM.

## Phase 2 Acceptance Criteria ✅

✅ **Fetch kind:31996 event by d-tag when navigating to Retro page**
✅ **Decode ROM from event.content according to encoding tag (Base64, Base64URL, Hex)**
✅ **Validate ROM size and SHA256 hash against event tags**
✅ **Show user-friendly errors for invalid encoding, size mismatch, hash mismatch**
✅ **Pass decoded Uint8Array to emulator and run after user gesture**
✅ **Comprehensive error handling with retry and copy event ID options**
✅ **Proper cleanup on navigation (emulator/audio disposed)**
✅ **Security: treat content as binary, validate inputs, fail closed on malformed data**
✅ **Works on desktop and mobile with audio gesture compliance**

### Code Structure

```
src/
├── components/
│   └── retro/
│       └── RetroPlayer.tsx          # Main game interface
├── lib/
│   ├── emulator/
│   │   └── nesEmulator.ts          # NES emulator wrapper
│   └── rom/
│       └── romLoader.ts            # ROM loading utilities
└── pages/
    └── retro/
        └── [d]/
            └── play.tsx              # Game page route
```

## Troubleshooting

### Common Issues

#### Nostr Loading Issues
1. **Event Not Found**
   - Verify kind:31996 event exists with correct d-tag
   - Check relay connectivity and event availability
   - Try different relays if event is missing

2. **Decoding Failed**
   - Check encoding tag matches actual content format
   - Ensure Base64 data is properly padded and formatted
   - Verify no whitespace corruption in event content

3. **Validation Failed**
   - Check size tag matches actual ROM size
   - Verify SHA256 tag matches computed hash
   - Ensure ROM data wasn't corrupted during transmission

#### Emulator Issues
4. **Audio Not Working**
   - Click the game canvas to enable audio (browser requirement)
   - Check if audio is toggled on in the header
   - Ensure browser supports Web Audio API

5. **ROM Won't Load**
   - Verify fallback ROM file exists at expected URL
   - Check ROM size is under 4MB
   - Ensure ROM has valid NES header

6. **Controls Not Responsive**
   - Check if game window has focus
   - Verify correct key mappings
   - Try refreshing the page

7. **Performance Issues**
   - Close other browser tabs
   - Disable browser extensions
   - Check device meets minimum requirements

## License

This implementation is part of the MoonFile project and follows the same license terms.