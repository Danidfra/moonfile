# Retro Page Loading Fix & Debug Logs Guide

This document outlines the comprehensive fix for Retro Page loading issues and the detailed debug logging system that's been implemented.

## Problems Fixed

### ✅ 1. Manifest Error Fixed
**Issue**: Syntax error in manifest.webmanifest causing console warnings
**Solution**: Created properly formatted manifest.webmanifest with:
- Double quotes for keys/values
- No trailing commas  
- Valid JSON structure
- Minimal required fields

**File**: `public/manifest.webmanifest`
```json
{
  "name": "MoonFile",
  "short_name": "MoonFile", 
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512", 
      "type": "image/png"
    }
  ]
}
```

### ✅ 2. Retro Page Mount Confirmation
**Issue**: Unclear if Retro page was even mounting
**Solution**: Added mount/unmount logging to RetroPlayPage component
```typescript
useEffect(() => {
  console.log("[Retro] MOUNT: component mounted");
  return () => console.log("[Retro] UNMOUNT: component unmounted");
}, []);
```

### ✅ 3. Detailed Loading Flow Logs
**Issue**: No visibility into where loading process was failing
**Solution**: Added comprehensive logging throughout the loading flow

#### Loading Flow Logs
```typescript
console.log("[Retro] start loading flow");
console.log("[Retro] fetching kind=31996 …");

// After fetch:
console.log("[Retro] event ok:", evt.id);
console.log("[Retro] tags:", evt.tags);

// Content preview:
console.log("[Retro] content.start:", evt.content?.slice(0, 100));
console.log("[Retro] content.end:", evt.content?.slice(-100));

// After decode:
console.log("[Retro] decoded len:", bytes.length);
console.log("[Retro] bytes start:", Array.from(bytes.slice(0, 16)));
console.log("[Retro] bytes end:", Array.from(bytes.slice(-16)));

// Emulator:
console.log("[Retro] loadROM…");
console.log("[Retro] emulator started");
```

### ✅ 4. Global Error Capture
**Issue**: Silent errors not being logged
**Solution**: Added global error listeners in main.tsx
```typescript
window.addEventListener("error", (e) => {
  console.error("[GlobalError]", e.error || e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[UnhandledRejection]", e.reason);
});
```

### ✅ 5. Test ROM Sanity Check
**Issue**: No way to isolate emulator vs data issues
**Solution**: Added "Run Test ROM" button in multiple UI states

#### Test ROM Button Locations
- **Loading state**: "Run Test ROM Instead" button
- **Error state**: "Run Test ROM" button  
- **Not found state**: "Run Test ROM" button

#### Test ROM Functionality
```typescript
const handleRunTestROM = () => {
  console.log("[Retro] Running Test ROM from error state");
  setRomSource({
    source: 'url',
    url: '/roms/test-rom.nes'
  });
  setError(null); // Clear error so RetroPlayer can try to load
};
```

## Expected Console Output

### Successful Loading Sequence
```javascript
[Retro] MOUNT: component mounted
[Retro] start loading flow
[Retro] fetching kind=31996 …
[Retro] event ok: abc123def456...
[Retro] tags: [["d", "test-game"], ["name", "Test Game"], ...]
[Retro] content.start: TkVTRwEBAAAAAAAAAAAA...
[Retro] content.end: ...AAAAAAAAAAAAAA==
[Retro] romSource set, loading should start in RetroPlayer
[Retro] Event tags: [["d", "test-game"], ["name", "Test Game"], ...]
[Retro] Content (start): TkVTRwEBAAAAAAAAAAAA...
[Retro] Content (end): ...AAAAAAAAAAAAAA==
[Retro] Fetching event... (t+0ms)
[Retro] Event fetched: abc123def456... (t+150ms)
[Retro] Decoding with encoding=base64 (t+151ms)
[Retro] Parsed tags: {encoding: "base64", compression: "none", sizeBytes: "24592", sha256: "7c6b6e7c..."}
[Retro] Decode successful, bytes: 24592
[Retro] decoded len: 24592
[Retro] bytes start: [78, 69, 83, 26, 2, 0, 96, 0, 0, 0, 0, 0, 0, 0, 0]
[Retro] bytes end: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
[Retro] Validating size {expected: "24592", actual: 24592} (t+201ms)
[Retro] Size validation OK: 24592 bytes (t+201ms)
[Retro] Initializing emulator…
[Retro] loadROM…
[Retro] Loading ROM into emulator... (t+251ms)
[Retro] Emulator started (t+300ms)
```

### Error Detection Examples

#### Empty Content Error
```javascript
[Retro] MOUNT: component mounted
[Retro] start loading flow
[Retro] fetching kind=31996 …
[Retro] event ok: abc123def456...
[Retro] tags: [["d", "test-game"]]
[Retro] content.start: 
[Retro] content.end: 
[Retro] romSource set, loading should start in RetroPlayer
[Retro] Content (start): 
[Retro] Content (end): 
[Retro] ERROR in decoding: Invalid Base64 data
```

#### Emulator Error
```javascript
[Retro] MOUNT: component mounted
[Retro] start loading flow
[Retro] fetching kind=31996 …
// ... all data processing logs work ...
[Retro] Initializing emulator…
[Retro] loadROM…
[Retro] Loading ROM into emulator... (t+251ms)
[GlobalError] Error: Failed to load ROM into emulator
```

#### Network/Query Error
```javascript
[Retro] MOUNT: component mounted
[Retro] start loading flow
[Retro] fetching kind=31996 …
[UnhandledRejection] Error: Failed to fetch from relay
```

## Debugging Workflow

### Step 1: Open Console
1. Open browser developer tools (F12)
2. Navigate to Console tab
3. Click "Play" on a retro game

### Step 2: Check Mount Logs
Look for:
```javascript
[Retro] MOUNT: component mounted
```
If missing → Retro page isn't routing/loading

### Step 3: Follow Loading Flow
Check for sequence:
- `[Retro] start loading flow`
- `[Retro] fetching kind=31996 …`
- `[Retro] event ok:` or error
- `[Retro] tags:`
- `[Retro] content.start:` and `[Retro] content.end:`
- `[Retro] decoded len:`, `[Retro] bytes start:`, `[Retro] bytes end:`
- `[Retro] loadROM…` and `[Retro] emulator started`

### Step 4: Identify Failure Point

#### No Logs After Mount
**Issue**: Page not mounting
**Check**: React Router, navigation, component import

#### Logs Stop at Content
**Issue**: Empty or invalid content
**Check**: Event content field, Base64 encoding

#### Logs Stop at Decoding
**Issue**: Base64 decoding failure
**Check**: Content format, encoding process

#### Logs Stop at Emulator
**Issue**: Emulator initialization/loading
**Check**: Emulator setup, ROM format

#### Global Errors Appear
**Issue**: Uncaught exceptions
**Check**: Error details in `[GlobalError]` or `[UnhandledRejection]`

### Step 5: Use Test ROM
If normal loading fails:
1. Click "Run Test ROM" button
2. **Test ROM succeeds** → Issue is with event/fetch/decode
3. **Test ROM fails** → Issue is with emulator

## Test ROM Analysis

### Test ROM Success Indicates
- ✅ Emulator integration works
- ✅ ROM loading mechanism works
- ✅ UI state management works
- ❌ Issue is in Nostr event processing

### Test ROM Failure Indicates
- ❌ Emulator integration broken
- ❌ ROM loading mechanism broken
- ❌ Core functionality broken
- ❌ Need to fix emulator setup

## Acceptance Criteria Verification

### ✅ Manifest Loads Without Syntax Errors
- [x] Valid JSON structure
- [x] Double quotes for keys/values
- [x] No trailing commas
- [x] All required fields present

### ✅ [Retro] MOUNT and Other Logs Appear
- [x] `[Retro] MOUNT: component mounted` appears
- [x] `[Retro] start loading flow` appears
- [x] All phase logs appear sequentially
- [x] No more silent infinite loading

### ✅ Logs Show Complete Debug Information
- [x] Event ID: `[Retro] event ok: abc123...`
- [x] Tags: `[Retro] tags: [[...]]`
- [x] Content preview: `[Retro] content.start/end:`
- [x] Decoded length: `[Retro] decoded len: 24592`
- [x] Byte arrays: `[Retro] bytes start/end:`
- [x] Emulator: `[Retro] loadROM…` and `[Retro] emulator started`

### ✅ Errors Are Clearly Logged
- [x] No more silent failures
- [x] Global errors captured: `[GlobalError]`
- [x] Unhandled rejections: `[UnhandledRejection]`
- [x] Phase-specific errors: `[Retro] ERROR in <phase>`

### ✅ "Run Test ROM" Proves Emulator Independence
- [x] Test ROM button available in all states
- [x] Loads known-good ROM from `/roms/test-rom.nes`
- [x] Success isolates data vs emulator issues
- [x] Failure indicates emulator problems

## Files Modified

### Core Files
- `public/manifest.webmanifest` - Fixed manifest syntax
- `src/main.tsx` - Added global error capture
- `src/pages/retro/[d]/play.tsx` - Added mount logs and Test ROM button
- `src/components/retro/RetroPlayer.tsx` - Enhanced logging throughout

### Documentation
- `retro-loading-fix-guide.md` - This comprehensive guide

## Usage Instructions

### For Debugging Loading Issues
1. Open browser console
2. Navigate to retro game page
3. Click "Play" and observe log sequence
4. Use "Run Test ROM" to isolate issues
5. Check global errors if no logs appear

### For Testing
1. Verify `[Retro] MOUNT` appears
2. Check complete loading flow logs
3. Test error scenarios (empty content, invalid Base64)
4. Verify Test ROM functionality
5. Confirm global error capture works

This implementation provides complete visibility into the Retro Player loading process, eliminating silent failures and enabling precise debugging of any loading issues.