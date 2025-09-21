# Retro Player Detailed Debug Logs Guide

This document explains the enhanced debug logging system for Retro Player and how to use it to identify loading issues.

## Console Log Sequence

The enhanced Retro Player now provides detailed console logs that trace the entire loading process from event fetching to emulator startup.

### 1. Event Tags Logging
```javascript
console.log("[Retro] Event tags:", evt.tags);
```
**Purpose**: Shows all tags from the Nostr event before any processing
**When**: Before decoding starts
**Use case**: Verify that required tags (encoding, compression, size, sha256) are present

### 2. Content Logging
```javascript
console.log("[Retro] Content (start):", evt.content.slice(0, 100));
console.log("[Retro] Content (end):", evt.content.slice(-100));
```
**Purpose**: Shows the first and last 100 characters of the event content
**When**: Before decoding starts
**Use case**: 
- If content is empty → "Content (start):" and "Content (end):" will be empty
- If content looks invalid Base64 → will show malformed data
- If content is truncated → will show partial data

### 3. Decoding Process Logging
```javascript
console.log("[Retro] Decoded length:", bytes.length);
console.log("[Retro] Decoded preview (start):", bytes.slice(0, 16));
console.log("[Retro] Decoded preview (end):", bytes.slice(-16));
```
**Purpose**: Shows decoded byte count and first/last 16 bytes
**When**: Immediately after Base64 decoding
**Use case**:
- **Length check**: Verifies decoding produced expected number of bytes
- **Content preview**: Shows if decoded data looks like NES ROM (should start with "NES^Z" bytes: 0x4E 0x45 0x53 0x1A)
- **End check**: Verifies ROM integrity by looking at end bytes

### 4. Emulator Initialization Logging
```javascript
console.log("[Retro] Initializing emulator…");
console.log("[Retro] Emulator initialized successfully");
console.log("[Retro] Loading ROM into emulator…");
console.log("[Retro] Emulator started");
console.error("[Retro] Emulator error:", e);
```
**Purpose**: Tracks emulator initialization and ROM loading
**When**: During emulator setup and ROM loading
**Use case**: Isolate emulator-specific issues from data issues

## Expected Console Output Examples

### Successful Load Scenario
```javascript
[Retro] Fetching event... (t+0ms)
[Retro] Event tags: [["d", "test-game"], ["name", "Test Game"], ["encoding", "base64"], ...]
[Retro] Content (start): TkVTRwEBAAAAAAAAAAAA...
[Retro] Content (end): ...AAAAAAAAAAAAAA==
[Retro] Event fetched: abc123def456... (t+150ms)
[Retro] Decoding with encoding=base64 (t+151ms)
[Retro] Parsed tags: {encoding: "base64", compression: "none", sizeBytes: "24592", sha256: "7c6b6e7c..."}
[Retro] Decode successful, bytes: 24592
[Retro] Decoded length: 24592
[Retro] Decoded preview (start): Uint8Array(16) [78, 69, 83, 26, 2, 0, 96, 0, 0, 0, 0, 0, 0, 0, 0, 0]
[Retro] Decoded preview (end): Uint8Array(16) [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
[Retro] Validating size {expected: "24592", actual: 24592} (t+201ms)
[Retro] Size validation OK: 24592 bytes (t+201ms)
[Retro] Initializing emulator…
[Retro] Loading ROM into emulator... (t+251ms)
[Retro] Emulator started (t+300ms)
```

### Empty Content Scenario
```javascript
[Retro] Fetching event... (t+0ms)
[Retro] Event tags: [["d", "test-game"], ["name", "Test Game"]]
[Retro] Content (start): 
[Retro] Content (end): 
[Retro] Event fetched: abc123def456... (t+150ms)
[Retro] Decoding with encoding=base64 (t+151ms)
[Retro] Parsed tags: {encoding: "base64", compression: "none", sizeBytes: undefined, sha256: undefined}
[Retro] ERROR in decoding: Invalid Base64 data
```

### Invalid Base64 Scenario
```javascript
[Retro] Fetching event... (t+0ms)
[Retro] Event tags: [["d", "test-game"], ["name", "Test Game"]]
[Retro] Content (start): This is not valid base64!!!...
[Retro] Content (end): ...invalid data here==
[Retro] Event fetched: abc123def456... (t+150ms)
[Retro] Decoding with encoding=base64 (t+151ms)
[Retro] Parsed tags: {encoding: "base64", compression: "none", sizeBytes: undefined, sha256: undefined}
[Retro] ERROR in decoding: Invalid Base64 data
```

### Emulator Failure Scenario
```javascript
[Retro] Fetching event... (t+0ms)
[Retro] Event tags: [["d", "test-game"], ["name", "Test Game"], ["encoding", "base64"], ...]
[Retro] Content (start): TkVTRwEBAAAAAAAAAAAA...
[Retro] Content (end): ...AAAAAAAAAAAAAA==
[Retro] Event fetched: abc123def456... (t+150ms)
[Retro] Decoding with encoding=base64 (t+151ms)
[Retro] Parsed tags: {encoding: "base64", compression: "none", sizeBytes: "24592", sha256: "7c6b6e7c..."}
[Retro] Decode successful, bytes: 24592
[Retro] Decoded length: 24592
[Retro] Decoded preview (start): Uint8Array(16) [78, 69, 83, 26, 2, 0, 96, 0, 0, 0, 0, 0, 0, 0, 0, 0]
[Retro] Decoded preview (end): Uint8Array(16) [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
[Retro] Validating size {expected: "24592", actual: 24592} (t+201ms)
[Retro] Size validation OK: 24592 bytes (t+201ms)
[Retro] Initializing emulator…
[Retro] Emulator initialized successfully
[Retro] Loading ROM into emulator... (t+251ms)
[Retro] Emulator error: Error: Failed to load ROM into emulator
```

## Issue Identification Guide

### Problem: Event Not Found
**Symptoms**: No logs after "[Retro] Fetching event..."
**Cause**: Nostr event doesn't exist or can't be fetched
**Solution**: Check event ID and relay connectivity

### Problem: Empty Content
**Symptoms**: 
```
[Retro] Content (start): 
[Retro] Content (end): 
```
**Cause**: Event content field is empty
**Solution**: Check event creation and content encoding

### Problem: Invalid Base64
**Symptoms**: Content looks like text/garbage, fails at decode step
**Cause**: Content is not properly Base64 encoded
**Solution**: Fix event content encoding

### Problem: Corrupted ROM Data
**Symptoms**: Decoded bytes don't start with NES header [78, 69, 83, 26]
**Cause**: ROM data is corrupted or not a NES ROM
**Solution**: Verify ROM file and encoding process

### Problem: Emulator Issues
**Symptoms**: All data processing works, fails at emulator load
**Cause**: Emulator initialization or ROM loading issues
**Solution**: Use Test ROM to verify emulator works independently

## Test ROM Debugging

### Test ROM Button Usage
1. **When to use**: When normal ROM loading fails
2. **What it does**: Loads known-good ROM from `/roms/test-rom.nes`
3. **How it helps**: Isolates emulator issues from data issues

### Test ROM Success Example
```javascript
[Retro] Loading Test ROM...
[Retro] Test ROM URL: /roms/test-rom.nes
[Retro] Test ROM fetched: 24592 bytes
[Retro] Test ROM length: 24592
[Retro] Test ROM preview (start): Uint8Array(16) [78, 69, 83, 26, 2, 0, 96, 0, 0, 0, 0, 0, 0, 0, 0, 0]
[Retro] Test ROM preview (end): Uint8Array(16) [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
[Retro] Test ROM loaded successfully
```

### Test ROM Failure Example
```javascript
[Retro] Loading Test ROM...
[Retro] Test ROM URL: /roms/test-rom.nes
[Retro] Test ROM emulator error: Error: Failed to load Test ROM into emulator
```

## Debug Panel Usage

### Enabling Debug Panel
Add `?debug=1` to URL or run in development mode

### Debug Panel Information
- **Current Phase**: Shows current loading state
- **Last Error**: Most recent error message
- **Event ID**: Nostr event identifier
- **D-Tag**: Game identifier from event
- **Parsed Tags**: Encoding, compression, size, sha256
- **Decoded Size**: Actual size of decoded ROM data
- **Phase Timings**: Time taken for each phase

## Troubleshooting Checklist

### Step 1: Check Console Logs
1. Open browser developer tools
2. Navigate to Console tab
3. Click "Play" on a retro game
4. Observe the log sequence

### Step 2: Identify Failure Point
- **No logs**: Event fetching issue
- **Logs stop at content**: Empty/invalid content
- **Logs stop at decode**: Base64 encoding issue
- **Logs stop at validation**: Data validation issue
- **Logs stop at emulator**: Emulator issue

### Step 3: Use Test ROM
1. If normal load fails, click "Run Test ROM"
2. **Test ROM succeeds**: Issue is with event/fetch/decode/validate
3. **Test ROM fails**: Issue is with emulator

### Step 4: Check Debug Panel
1. Add `?debug=1` to URL
2. Review debug information
3. Check phase timings for performance issues

## Common Issues and Solutions

### Issue: Empty Content
**Logs**: Content (start/end) are empty
**Fix**: Check event content field is populated

### Issue: Invalid Base64
**Logs**: Content looks like text, fails decode
**Fix**: Properly encode ROM data as Base64

### Issue: Wrong Size
**Logs**: Size validation fails
**Fix**: Update size tag to match actual ROM size

### Issue: Wrong Hash
**Logs**: SHA256 validation fails
**Fix**: Update sha256 tag to match actual ROM hash

### Issue: Emulator Not Working
**Logs**: Test ROM fails
**Fix**: Check emulator implementation and dependencies

This detailed logging system provides complete visibility into the ROM loading process, making it easy to identify exactly where issues occur.