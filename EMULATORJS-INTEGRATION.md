# EmulatorJS Integration

This project has been successfully integrated with EmulatorJS to replace the original NES-only emulator with a multi-system retro gaming emulator.

## What Changed

### 1. New EmulatorJS Player Component
- **File**: `src/components/EmulatorJSPlayer.tsx`
- **Purpose**: Multi-system emulator that supports various retro gaming platforms
- **Fallback**: Automatically falls back to the original NES player for NES ROMs if EmulatorJS fails to load

### 2. Updated Game Page
- **File**: `src/pages/GamePage.tsx`
- **Changes**: 
  - Replaced `NesPlayer` with `EmulatorJSPlayer`
  - Added MIME type detection for core selection
  - Updated ROM data handling to use base64 directly

### 3. Local EmulatorJS Assets
- **Location**: `public/emulatorjs/`
- **Contents**: EmulatorJS core files, CSS, and loader script
- **Benefit**: Avoids CSP (Content Security Policy) issues with external CDNs

### 4. Enhanced Vite Configuration
- **File**: `vite.config.ts`
- **Improvements**:
  - Added CSP headers that allow local scripts and WASM
  - Proper MIME type handling for WASM and JavaScript files
  - Better asset serving for EmulatorJS files

## Supported Systems

The EmulatorJS integration supports the following gaming systems based on MIME type detection:

### Nintendo Systems
- **NES/Famicom**: `application/x-nes-rom` → `nes` core
- **SNES**: `application/x-snes-rom` → `snes` core
- **Game Boy**: `application/x-gameboy-rom` → `gb` core
- **Game Boy Advance**: `application/x-gameboy-advance-rom` → `gba` core
- **Nintendo 64**: `application/x-nintendo-64-rom` → `n64` core
- **Nintendo DS**: `application/x-nintendo-ds-rom` → `nds` core
- **Virtual Boy**: `application/x-virtual-boy-rom` → `vb` core

### Sega Systems
- **Genesis/Mega Drive**: `application/x-sega-genesis-rom` → `segaMD` core
- **Master System**: `application/x-sega-master-system-rom` → `segaMS` core
- **Game Gear**: `application/x-sega-game-gear-rom` → `segaGG` core
- **32X**: `application/x-sega-32x-rom` → `sega32x` core
- **Sega CD**: `application/x-sega-cd-rom` → `segaCD` core
- **Saturn**: `application/x-sega-saturn-rom` → `segaSaturn` core

### Atari Systems
- **2600**: `application/x-atari-2600-rom` → `atari2600` core
- **5200**: `application/x-atari-5200-rom` → `atari5200` core
- **7800**: `application/x-atari-7800-rom` → `atari7800` core
- **Lynx**: `application/x-atari-lynx-rom` → `lynx` core
- **Jaguar**: `application/x-atari-jaguar-rom` → `jaguar` core

### Other Systems
- **PlayStation**: `application/x-playstation-rom` → `psx` core
- **PSP**: `application/x-psp-rom` → `psp` core
- **Arcade**: `application/x-arcade-rom` → `arcade` core
- **3DO**: `application/x-3do-rom` → `3do` core
- **ColecoVision**: `application/x-colecovision-rom` → `coleco` core
- **PC Engine**: `application/x-pc-engine-rom` → `pce` core
- **Neo Geo Pocket**: `application/x-neo-geo-pocket-rom` → `ngp` core
- **WonderSwan**: `application/x-wonderswan-rom` → `ws` core

### Commodore Systems
- **C64**: `application/x-commodore-64-rom` → `vice_x64sc` core
- **C128**: `application/x-commodore-128-rom` → `vice_x128` core
- **VIC-20**: `application/x-commodore-vic20-rom` → `vice_xvic` core
- **Plus/4**: `application/x-commodore-plus4-rom` → `vice_xplus4` core
- **PET**: `application/x-commodore-pet-rom` → `vice_xpet` core

## How It Works

### 1. MIME Type Detection
When a game is loaded, the `EmulatorJSPlayer` component:
1. Reads the `mime` tag from the Nostr event
2. Maps it to the appropriate EmulatorJS core
3. Configures the emulator with the correct core

### 2. ROM Loading Process
1. **Base64 Decoding**: ROM data is decoded from base64
2. **Blob Creation**: Creates a blob URL for EmulatorJS to consume
3. **Core Selection**: Determines the appropriate emulator core
4. **Emulator Initialization**: Loads EmulatorJS with the ROM and core

### 3. Fallback System
- **NES ROMs**: If EmulatorJS fails to load, automatically falls back to the original `NesPlayer`
- **Other Systems**: Shows an error message if EmulatorJS cannot load
- **User Experience**: Seamless fallback with a notification banner

### 4. Error Handling
- **CSP Issues**: Resolved by hosting EmulatorJS locally
- **Script Load Failures**: Graceful fallback for NES ROMs
- **Core Availability**: Clear error messages for unsupported systems
- **Timeout Protection**: 10-second timeout for script loading

## File Structure

```
public/emulatorjs/
├── emulator.css          # EmulatorJS styles
├── loader.js             # EmulatorJS main loader
├── src/                  # EmulatorJS source files
├── localization/         # Language files
├── compression/          # Archive extraction support
└── cores/                # Emulator cores (to be populated)
```

## Development Notes

### CSP (Content Security Policy)
The Vite configuration includes CSP headers that:
- Allow local scripts (`'self'`)
- Enable WASM execution (`'wasm-unsafe-eval'`)
- Permit inline styles for EmulatorJS UI
- Allow blob URLs for ROM loading

### Performance Considerations
- **Local Hosting**: Eliminates external CDN dependencies
- **Lazy Loading**: EmulatorJS is only loaded when needed
- **Resource Cleanup**: Proper cleanup of blob URLs and resources
- **Caching**: Static assets are served with appropriate cache headers

### Future Improvements
1. **Core Pre-loading**: Download and host specific cores locally
2. **System Detection**: Auto-detect system from ROM headers
3. **Save States**: Implement save state functionality
4. **Controller Support**: Enhanced gamepad support
5. **Network Play**: Multiplayer gaming over Nostr

## Troubleshooting

### Common Issues

1. **EmulatorJS Script Not Loading**
   - Check that `/emulatorjs/loader.js` is accessible
   - Verify CSP headers allow local scripts
   - For NES ROMs, the system will automatically fall back

2. **WASM Execution Errors**
   - Ensure `'wasm-unsafe-eval'` is in CSP headers
   - Check browser WASM support

3. **Core Not Found**
   - Verify the MIME type is correctly set in the Nostr event
   - Check that the core mapping exists in `MIME_TO_CORE`

4. **ROM Loading Issues**
   - Ensure ROM data is valid base64
   - Check that the ROM format matches the MIME type

### Testing
Run the test suite to verify everything works:
```bash
npm run test
```

Build the project to check for compilation errors:
```bash
npm run build
```