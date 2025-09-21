# Retro Game Player - Phase 1 Implementation

## Overview

This document describes the Phase 1 implementation of the NES Retro Game Player for the MoonFile platform. This implementation allows users to play NES games directly in their browser with a polished, responsive interface.

## Features Implemented

### 🎮 Core Functionality
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
   - Load game metadata from Nostr
   - Fetch ROM from configured URL
   - Initialize the emulator
   - Display the game interface

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

### ROM Sources (Phase 1)

ROMs are loaded from static URLs based on the game's d-tag:

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

1. **Loading State** - Shows spinner while ROM is downloading
2. **ROM Not Found** - 404 errors when ROM URL is invalid
3. **Invalid ROM** - Non-NES files or corrupted headers
4. **Emulator Error** - jsnes initialization failures
5. **Network Error** - Failed to download ROM
6. **ROM Too Large** - Files larger than 4MB

Each error state provides clear messaging and a path back to the games list.

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

1. **Audio Not Working**
   - Click the game canvas to enable audio (browser requirement)
   - Check if audio is toggled on in the header
   - Ensure browser supports Web Audio API

2. **ROM Won't Load**
   - Verify ROM file exists at expected URL
   - Check ROM size is under 4MB
   - Ensure ROM has valid NES header

3. **Controls Not Responsive**
   - Check if game window has focus
   - Verify correct key mappings
   - Try refreshing the page

4. **Performance Issues**
   - Close other browser tabs
   - Disable browser extensions
   - Check device meets minimum requirements

## License

This implementation is part of the MoonFile project and follows the same license terms.