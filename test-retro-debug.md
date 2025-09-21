# Retro Player Debugging Test

This document outlines the testing steps for the enhanced Retro Player with debugging capabilities.

## Features Added

### 1. Comprehensive Console Logging
The Retro Player now logs each phase of the ROM loading process:
- `[Retro] Fetching event...` - When starting to fetch the Nostr event
- `[Retro] Event fetched: [event-id]` - When event is successfully fetched
- `[Retro] Decoding with encoding=base64` - When starting the decoding process
- `[Retro] Decoded bytes: [length]` - When decoding is complete
- `[Retro] Validating size: [expected] actual: [actual]` - During size validation
- `[Retro] SHA256 OK: [hash]` or `[Retro] SHA256 mismatch` - Hash validation results
- `[Retro] Loading ROM into emulator...` - When loading into the emulator
- `[Retro] Emulator started` - When the emulator is ready
- `[Retro] ERROR in [phase]: [error]` - When any phase fails

### 2. Finite State Machine
New state machine with clear transitions:
- `idle` - Initial state
- `fetching` - Fetching ROM from URL or Nostr event
- `decoding` - Decoding ROM data
- `validating` - Validating ROM integrity
- `loading-emulator` - Loading ROM into emulator
- `ready` - Ready to play
- `running` - Game is running
- `paused` - Game is paused
- `error` - Error state

### 3. Error States
Clear error messages for each failure type:
- "Event not found" - Nostr event doesn't exist
- "Invalid Base64" - Base64 decoding failed
- "Size mismatch" - ROM size doesn't match expected size
- "SHA256 mismatch" - ROM hash doesn't match expected hash
- "Emulator init failed" - Emulator failed to initialize
- "Test ROM failed" - Test ROM loading failed

### 4. Debug Panel
Collapsible debug panel available in development mode or with `?debug=1` query parameter showing:
- Current state/phase
- Last error encountered
- Event ID and d-tag
- Parsed tags (encoding, compression, size, sha256)
- Decoded size in bytes
- Phase timing information

### 5. Test ROM Button
"Run Test ROM" button that loads a known-good NES ROM from `/roms/test-rom.nes` to isolate issues.

## Testing Steps

### 1. Basic Loading Test
1. Navigate to a retro game page
2. Open browser console
3. Click "Play" button
4. Observe console logs for each phase
5. Verify that loading resolves to either "Ready" or "Error" state

### 2. Error Scenario Tests

#### Test ROM Not Found
1. Try to load a non-existent game
2. Verify error message: "Event not found"
3. Check console for error logs

#### Test Invalid Base64
1. Create a Nostr event with invalid base64 content
2. Attempt to load the game
3. Verify error message: "Invalid Base64"
4. Check console for decode error logs

#### Test Size Mismatch
1. Create a Nostr event with incorrect size tag
2. Attempt to load the game
3. Verify error message: "Size mismatch"
4. Check console for size validation logs

#### Test SHA256 Mismatch
1. Create a Nostr event with incorrect sha256 tag
2. Attempt to load the game
3. Verify error message: "SHA256 mismatch"
4. Check console for hash validation logs

### 3. Test ROM Functionality
1. Load any retro game
2. If it fails, click "Run Test ROM" button
3. If Test ROM loads successfully → issue is in fetch/decode/validate
4. If Test ROM also fails → issue is in emulator integration

### 4. Debug Panel Test
1. Load any retro game
2. Add `?debug=1` to the URL
3. Verify debug panel appears in the error state
4. Check that all debug information is displayed correctly
5. Verify phase timing information is accurate

### 5. Retry Functionality
1. Load a game that will fail
2. Click "Retry" button
3. Verify loading restarts from the beginning
4. Check console for new log entries

## Acceptance Criteria Verification

### ✅ No Indefinite Loading
- [ ] Spinner always resolves to Ready or Error state
- [ ] No infinite loading states
- [ ] Error states are clearly displayed

### ✅ Console Logs
- [ ] Each phase logs start + success + failure
- [ ] Error logs clearly indicate which phase failed
- [ ] Log messages include relevant details (sizes, hashes, etc.)

### ✅ Retry Functionality
- [ ] Retry button re-runs from first failing phase
- [ ] Retry clears previous error states
- [ ] Retry generates new log entries

### ✅ Test ROM
- [ ] Test ROM button loads `/roms/test-rom.nes`
- [ ] Test ROM success indicates emulator works
- [ ] Test ROM failure indicates fetch/decode/validate issues

## Expected Console Output Example

### Successful Load
```
[Retro] Fetching event... (t+0ms)
[Retro] Event fetched: abc123def456... (t+150ms)
[Retro] Decoding with encoding=base64 (t+151ms)
[Retro] Decoded bytes: 24592 (t+200ms)
[Retro] Validating size {expected: "24592", actual: 24592} (t+201ms)
[Retro] Size validation OK: 24592 bytes (t+201ms)
[Retro] Validating SHA256... (t+201ms)
[Retro] SHA256 computed: 7c6b6e7c...
[Retro] SHA256 expected: 7c6b6e7c...
[Retro] SHA256 validation OK (t+250ms)
[Retro] Loading ROM into emulator... (t+251ms)
[Retro] Emulator started (t+300ms)
```

### Error Example
```
[Retro] Fetching event... (t+0ms)
[Retro] Event fetched: abc123def456... (t+150ms)
[Retro] Decoding with encoding=base64 (t+151ms)
[Retro] ERROR in decoding: Invalid Base64 data
```

This debugging implementation will help identify exactly where the ROM loading process fails and provide clear feedback for troubleshooting.