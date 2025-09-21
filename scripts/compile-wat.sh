#!/bin/bash

# Compile WebAssembly Text format to binary
# Requires wat2wasm (part of binaryen)

echo "Compiling WebAssembly..."

# Check if binaryen is available
if ! command -v wat2wasm &> /dev/null; then
    echo "Installing binaryen..."
    
    # Try to install binaryen via npm if available
    if command -v npm &> /dev/null; then
        echo "Installing binaryen via npm..."
        npm install -g binaryen
    else
        echo "npm not available. Please install binaryen manually:"
        echo "  npm install -g binaryen"
        echo "  or visit https://github.com/WebAssembly/binaryen"
        exit 1
    fi
fi

# Compile the WASM file
if command -v wat2wasm &> /dev/null; then
    wat2wasm public/lib/fceux/nes-core.wat -o public/lib/fceux/nes-core.wasm
    
    if [ $? -eq 0 ]; then
        echo "✅ WebAssembly compiled successfully!"
        ls -la public/lib/fceux/nes-core.wasm
    else
        echo "❌ Compilation failed"
        exit 1
    fi
else
    echo "❌ wat2wasm not found even after installation"
    echo "Please ensure binaryen is properly installed and in PATH"
    exit 1
fi