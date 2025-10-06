# CSP and Vite Fixes

This document explains the fixes applied to resolve Content Security Policy (CSP) and Vite compatibility issues.

## Issues Fixed

### 1. ❌ CSP Meta Tag Conflicts with Vite Dev Server
**Problem**: CSP meta tag in `index.html` was conflicting with Vite's Hot Module Replacement (HMR)
**Solution**: Removed CSP meta tag and moved CSP handling to Vite middleware

### 2. ❌ Inline Scripts Violating CSP
**Problem**: Inline scripts were violating `script-src 'self'` directive
**Solution**: Moved all inline scripts to external files with proper event listeners

### 3. ❌ Frame-Ancestors in Meta Tag
**Problem**: `frame-ancestors` directive is ignored when delivered via meta tag
**Solution**: Moved to HTTP headers via Vite middleware and production headers file

### 4. ❌ Vite React Refresh Detection Issues
**Problem**: CSP was blocking Vite's development features
**Solution**: Relaxed CSP in development mode to allow `'unsafe-eval'` and `'unsafe-inline'`

### 5. ❌ Manifest Icon Path Issues
**Problem**: Manifest icons were not loading correctly
**Solution**: Added proper icon links in HTML head and verified paths

## Files Modified

### `index.html`
- ✅ Removed CSP meta tag
- ✅ Removed inline scripts
- ✅ Added proper icon links
- ✅ Clean, CSP-compliant HTML

### `vite.config.ts`
- ✅ Added development CSP middleware
- ✅ Proper WASM and asset handling
- ✅ Different CSP policies for dev vs production

### `public/_headers` (New)
- ✅ Production CSP headers for deployment
- ✅ WASM content-type headers
- ✅ Security headers (X-Frame-Options, etc.)

### `public/emulatorjs/init.js` (New)
- ✅ External EmulatorJS initialization script
- ✅ No inline scripts, CSP-compliant

### `src/components/EmulatorJSPlayer.tsx`
- ✅ Proper event listeners instead of inline handlers
- ✅ External script loading with timeout
- ✅ CSP-compliant EmulatorJS initialization

## CSP Policies

### Development Mode (Relaxed)
```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' ws: wss: https:;
worker-src 'self' blob:;
media-src 'self' blob: data:;
object-src 'none';
base-uri 'self';
```

### Production Mode (Secure)
```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' wss: ws: https:;
worker-src 'self' blob:;
media-src 'self' blob: data:;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
```

## How It Works

### Development
1. **Vite Dev Server**: Applies relaxed CSP via middleware
2. **HMR Support**: `'unsafe-eval'` and `'unsafe-inline'` allow Vite features
3. **EmulatorJS**: Loads via external scripts, no CSP violations
4. **React Refresh**: Works normally with relaxed CSP

### Production
1. **Static Headers**: `_headers` file provides secure CSP
2. **No Inline Scripts**: All scripts are external and CSP-compliant
3. **WASM Support**: Proper content-type headers for WASM files
4. **Security**: Strict CSP with minimal required permissions

## Benefits

### ✅ Security
- Prevents XSS attacks via strict CSP
- No `'unsafe-eval'` in production
- Proper frame-ancestors protection

### ✅ Development Experience
- Vite HMR works correctly
- React Refresh functions normally
- No CSP violations in console

### ✅ EmulatorJS Compatibility
- Loads without CSP violations
- Proper WASM execution
- External script initialization

### ✅ Performance
- Proper caching headers for assets
- Optimized WASM loading
- Clean HTML without inline scripts

## Deployment

### Netlify/Vercel
The `_headers` file will be automatically deployed and applied.

### Custom Server
Apply the production CSP headers from `_headers` file to your server configuration.

### Testing
1. **Development**: `npm run dev` - should show no CSP violations
2. **Production**: `npm run build` - generates optimized build with secure headers
3. **Validation**: Check browser console for CSP violations (should be none)

## Troubleshooting

### If CSP violations still occur:
1. Check browser console for specific violations
2. Verify `_headers` file is deployed correctly
3. Ensure no inline scripts in components
4. Check that all EmulatorJS assets are served from same origin

### If Vite HMR doesn't work:
1. Verify development CSP includes `'unsafe-eval'`
2. Check that WebSocket connections are allowed
3. Ensure no CSP meta tags in HTML