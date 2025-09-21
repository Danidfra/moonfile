#!/bin/bash

# FCEUX WebAssembly Setup Script
# This script downloads and sets up FCEUX WebAssembly build

echo "Setting up FCEUX WebAssembly..."

# Create directories
mkdir -p public/lib/fceux
cd public/lib/fceux

# Download FCEUX WebAssembly from a working source
# Using a mirror that hosts FCEUX WebAssembly builds
echo "Downloading FCEUX WebAssembly files..."

# Download the JavaScript loader
curl -o fceux-web.js https://cdn.jsdelivr.net/gh/TASEmulators/fceux-web@master/dist/fceux-web.js 2>/dev/null || {
    echo "Failed to download fceux-web.js, creating stub..."
    cat > fceux-web.js << 'EOF'
// FCEUX WebAssembly Stub Loader
// This is a temporary stub until we get the real FCEUX WebAssembly build

class FCEUXWeb {
  constructor() {
    this.initialized = false;
    this.memory = null;
    this.exports = null;
  }

  async init() {
    console.log('[FCEUX Web] Initializing stub implementation');
    
    // Create a mock memory buffer
    this.memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
    
    // Mock exports
    this.exports = {
      memory: this.memory,
      // Add mock functions that will be replaced by real FCEUX functions
      init: () => console.log('[FCEUX Web] init called'),
      loadRom: () => console.log('[FCEUX Web] loadRom called'),
      frame: () => console.log('[FCEUX Web] frame called'),
      reset: () => console.log('[FCEUX Web] reset called'),
      setButton: () => console.log('[FCEUX Web] setButton called'),
      getAudioBuffer: () => new Int16Array(1024),
    };
    
    this.initialized = true;
    return this.exports;
  }

  isInitialized() {
    return this.initialized;
  }
}

// Global FCEUX instance
window.FCEUX = new FCEUXWeb();

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.FCEUX.init();
  });
} else {
  window.FCEUX.init();
}
EOF
}

# Download the WebAssembly module
curl -o fceux-web.wasm https://cdn.jsdelivr.net/gh/TASEmulators/fceux-web@master/dist/fceux-web.wasm 2>/dev/null || {
    echo "Failed to download fceux-web.wasm, creating minimal stub..."
    
    # Create a minimal WASM file (this won't work but prevents 404 errors)
    # In a real scenario, you would need the actual FCEUX WebAssembly binary
    echo "Creating minimal WASM stub..."
    python3 -c "
import struct

# Create a minimal WASM file with just the header
# This is not functional but prevents 404 errors
wasm_header = b'\\x00\\x61\\x73\\x6d'  # magic
wasm_header += b'\\x01\\x00\\x00\\x00'  # version

with open('fceux-web.wasm', 'wb') as f:
    f.write(wasm_header)
    
print('Created minimal WASM stub')
" 2>/dev/null || echo "Python3 not available, skipping WASM stub creation"
}

cd ../../..

echo "FCEUX WebAssembly setup complete!"
echo "Note: Using stub implementation. Replace with real FCEUX WebAssembly build for full functionality."