# EmulatorJS Troubleshooting Guide

This guide addresses common EmulatorJS integration issues and their solutions.

## Fixed Issues

### ❌ "Unexpected token '<'" Error
**Problem**: EmulatorJS scripts returning HTML instead of JavaScript
**Root Cause**: Missing or incorrectly served script files
**Solution**: 
- ✅ Built `emulator.min.js` locally using EmulatorJS minify script
- ✅ Verified all required files exist in `/public/emulatorjs/`
- ✅ Added proper MIME type headers in Vite config

### ❌ "EmulatorJS is not defined" Error  
**Problem**: Scripts loading in wrong order or EmulatorJS not available
**Root Cause**: Missing main EmulatorJS script or load order issues
**Solution**:
- ✅ Load `emulator.min.js` before `loader.js`
- ✅ Added proper script loading sequence with error handling
- ✅ Check for `window.EmulatorJS` before proceeding

### ❌ Missing Cores Issue
**Problem**: Emulator cores not available locally
**Root Cause**: EmulatorJS cores not included in npm package
**Solution**:
- ✅ Use CDN for cores: `https://cdn.emulatorjs.org/stable/data/`
- ✅ Updated CSP to allow EmulatorJS CDN for cores
- ✅ Keep main EmulatorJS files local for CSP compliance

## Current File Structure

```
public/emulatorjs/
├── emulator.min.js       # ✅ Main EmulatorJS script (built locally)
├── emulator.min.css      # ✅ Minified styles
├── emulator.css          # ✅ Original styles
├── loader.js             # ✅ EmulatorJS loader
├── version.json          # ✅ Version info
├── src/                  # ✅ Source files
├── localization/         # ✅ Language files
├── compression/          # ✅ Archive support
└── cores/                # ❌ Empty (using CDN)
```

## Script Loading Order

The EmulatorJS player now loads scripts in this order:

1. **CSS**: `emulator.min.css` (for styling)
2. **Main Script**: `emulator.min.js` (core EmulatorJS functionality)
3. **Configuration**: Set global EJS_* variables
4. **Loader**: `loader.js` (initializes emulator with ROM)

## Configuration

### Local Files + CDN Cores Approach
```javascript
// Main EmulatorJS files served locally
script.src = '/emulatorjs/emulator.min.js';

// Cores served from CDN
window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
```

### CSP Configuration
```
script-src 'self' 'wasm-unsafe-eval' https://cdn.emulatorjs.org
```

## Error Handling

### File Existence Check
```javascript
const requiredFiles = [
  '/emulatorjs/emulator.min.js',
  '/emulatorjs/loader.js'
];

for (const file of requiredFiles) {
  const response = await fetch(file, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`Required EmulatorJS file not found: ${file}`);
  }
}
```

### Script Loading with Timeout
```javascript
await new Promise<void>((resolve, reject) => {
  const script = document.createElement('script');
  script.src = '/emulatorjs/emulator.min.js';
  
  script.addEventListener('load', () => resolve());
  script.addEventListener('error', () => reject(new Error('Script failed to load')));
  
  document.head.appendChild(script);
  
  // 10 second timeout
  setTimeout(() => reject(new Error('Script load timeout')), 10000);
});
```

### Fallback System
- **NES ROMs**: Automatically fall back to original `NesPlayer` if EmulatorJS fails
- **Other Systems**: Show clear error message
- **Debug Mode**: Enable `EJS_DEBUG_XX` for troubleshooting

## Common Issues & Solutions

### 1. White Screen / No Loading
**Check**: Browser console for script errors
**Fix**: Verify all files exist and CSP allows script loading

### 2. "Failed to load EmulatorJS script"
**Check**: Network tab for 404 errors
**Fix**: Ensure files are in `/public/emulatorjs/` and properly built

### 3. Core Loading Failures
**Check**: Console for core-specific errors
**Fix**: Verify CDN access and MIME type support

### 4. CSP Violations
**Check**: Console for CSP errors
**Fix**: Update CSP to allow EmulatorJS CDN for cores

## Development vs Production

### Development (Vite Dev Server)
- Relaxed CSP allows debugging
- Local EmulatorJS files with CDN cores
- Debug mode enabled for troubleshooting

### Production (Built App)
- Strict CSP via `_headers` file
- Same local + CDN approach
- Debug mode disabled

## Building EmulatorJS Files

If you need to rebuild the EmulatorJS files:

```bash
cd ../EmulatorJS
npm install
npm run minify
cp data/emulator.min.js ../moonfile/public/emulatorjs/
cp data/emulator.min.css ../moonfile/public/emulatorjs/
```

## Testing

### Verify File Availability
```bash
# Check if files exist and are served correctly
curl -I http://localhost:8080/emulatorjs/emulator.min.js
curl -I http://localhost:8080/emulatorjs/loader.js
```

### Browser Console Checks
1. No CSP violations
2. Scripts load successfully  
3. `window.EmulatorJS` is defined after main script loads
4. Emulator initializes without errors

## Fallback Behavior

For NES ROMs specifically:
- If EmulatorJS fails to load → Use original `NesPlayer`
- Shows warning banner about fallback usage
- Maintains full functionality for NES games

For other systems:
- Shows clear error message
- Suggests checking console for details
- No fallback available (EmulatorJS required)

## Future Improvements

1. **Local Cores**: Download and host cores locally
2. **Core Detection**: Auto-detect available cores
3. **Progressive Loading**: Load cores on demand
4. **Better Fallbacks**: Add more system-specific fallbacks