# EmulatorJS Integration

This document describes the integration of EmulatorJS to replace the previous NES-only emulator with a multi-system emulator that supports various gaming platforms.

## Overview

The project now uses EmulatorJS instead of the custom jsnes-based emulator. This allows support for multiple gaming systems based on the game's MIME type tag in Nostr events.

## Supported Systems

The following gaming systems are supported through MIME type detection:

### Nintendo Systems
- **NES (Nintendo Entertainment System)**
  - MIME: `application/x-nes-rom`, `application/x-nintendo-nes-rom`
  - Core: `fceumm`

- **SNES (Super Nintendo Entertainment System)**
  - MIME: `application/x-snes-rom`, `application/x-nintendo-snes-rom`
  - Core: `snes9x`

- **Game Boy / Game Boy Color**
  - MIME: `application/x-gameboy-rom`, `application/x-gameboy-color-rom`, `application/x-nintendo-gameboy-rom`
  - Core: `gambatte`

- **Game Boy Advance**
  - MIME: `application/x-gba-rom`, `application/x-gameboy-advance-rom`, `application/x-nintendo-gba-rom`
  - Core: `mgba`

- **Nintendo 64**
  - MIME: `application/x-n64-rom`, `application/x-nintendo-64-rom`
  - Core: `mupen64plus_next`

- **Nintendo DS**
  - MIME: `application/x-nintendo-ds-rom`, `application/x-nds-rom`
  - Core: `desmume`

- **Virtual Boy**
  - MIME: `application/x-virtualboy-rom`, `application/x-nintendo-virtualboy-rom`
  - Core: `beetle_vb`

### Sega Systems
- **Genesis/Mega Drive**
  - MIME: `application/x-genesis-rom`, `application/x-megadrive-rom`, `application/x-sega-genesis-rom`
  - Core: `genesis_plus_gx`

- **Master System**
  - MIME: `application/x-sms-rom`, `application/x-master-system-rom`
  - Core: `genesis_plus_gx`

- **Game Gear**
  - MIME: `application/x-gamegear-rom`, `application/x-sega-gamegear-rom`
  - Core: `genesis_plus_gx`

### Other Systems
- **Atari 2600**
  - MIME: `application/x-atari-2600-rom`, `application/x-atari2600-rom`
  - Core: `stella2014`

- **Atari Lynx**
  - MIME: `application/x-lynx-rom`, `application/x-atari-lynx-rom`
  - Core: `handy`

- **Sony PlayStation**
  - MIME: `application/x-playstation-rom`, `application/x-psx-rom`
  - Core: `pcsx_rearmed`

- **Neo Geo Pocket**
  - MIME: `application/x-ngp-rom`, `application/x-neo-geo-pocket-rom`
  - Core: `mednafen_ngp`

- **WonderSwan**
  - MIME: `application/x-wonderswan-rom`
  - Core: `mednafen_wswan`

- **PC Engine / TurboGrafx-16**
  - MIME: `application/x-pce-rom`, `application/x-turbografx-rom`
  - Core: `mednafen_pce`

- **Arcade (MAME)**
  - MIME: `application/x-mame-rom`, `application/x-arcade-rom`
  - Core: `mame2003_plus`

- **MS-DOS**
  - MIME: `application/x-dos-executable`, `application/x-msdos-program`
  - Core: `dosbox_pure`

## Implementation Details

### Components

1. **EmulatorJSPlayer** (`src/components/EmulatorJSPlayer.tsx`)
   - Replaces the previous `NesPlayer` component
   - Automatically selects the appropriate emulator core based on MIME type
   - Provides the same interface for multiplayer streaming
   - Includes fullscreen support and game controls

2. **Game Utilities** (`src/lib/gameUtils.ts`)
   - `getGameMimeType()`: Extracts MIME type from Nostr game events
   - `getSystemNameFromMimeType()`: Converts MIME types to human-readable system names
   - `isSupportedMimeType()`: Checks if a MIME type is supported

### MIME Type Detection

Games are identified by their MIME type tag in Nostr events (kind 31996):

```json
{
  "kind": 31996,
  "tags": [
    ["d", "game-id"],
    ["name", "Game Title"],
    ["mime", "application/x-nes-rom"],
    ["encoding", "base64"]
  ],
  "content": "base64-encoded-rom-data"
}
```

### Backward Compatibility

- Games without a MIME type tag default to `application/x-nes-rom`
- NES-specific ROM validation and analysis is still performed for NES games
- The same multiplayer streaming interface is maintained

### Current Status

**Note**: The EmulatorJS integration is currently implemented as a placeholder that displays system information and prepares the infrastructure. The actual EmulatorJS library integration requires additional configuration and testing.

The placeholder currently:
- ✅ Detects MIME types correctly
- ✅ Shows appropriate system information
- ✅ Provides multiplayer streaming compatibility
- ✅ Maintains the same UI/UX as the previous emulator
- ⏳ **TODO**: Complete the actual EmulatorJS library integration

## Usage

### For Game Publishers

When publishing games to Nostr, include the appropriate MIME type tag:

```javascript
// Example for a SNES game
const gameEvent = {
  kind: 31996,
  tags: [
    ["d", "super-mario-world"],
    ["name", "Super Mario World"],
    ["mime", "application/x-snes-rom"],
    ["encoding", "base64"]
  ],
  content: "base64-encoded-snes-rom"
};
```

### For Developers

The `EmulatorJSPlayer` component can be used as a drop-in replacement for `NesPlayer`:

```tsx
import EmulatorJSPlayer from '@/components/EmulatorJSPlayer';

// Replace NesPlayer with EmulatorJSPlayer
<EmulatorJSPlayer
  romData={base64RomData}
  mimeType={mimeType}
  title={gameTitle}
  className="w-full"
  ref={playerRef}
/>
```

## Future Enhancements

1. **Complete EmulatorJS Integration**: Replace the placeholder with actual EmulatorJS functionality
2. **Save States**: Add save/load state functionality
3. **Controller Support**: Enhanced gamepad and controller support
4. **Performance Optimization**: Optimize for different system requirements
5. **Additional Systems**: Add support for more gaming platforms
6. **ROM Validation**: Add validation for different ROM formats beyond NES

## Dependencies

- `@emulatorjs/emulatorjs`: Main EmulatorJS library
- Various `@emulatorjs/core-*` packages for different system cores
- React 18+ for component architecture
- TypeScript for type safety