#!/bin/bash

# FCEUX WebAssembly Build Script
# Compiles FCEUX to WebAssembly with all required exports

set -e

echo "🚀 Building FCEUX WebAssembly Core..."

# Setup environment
source /tmp/emsdk/emsdk_env.sh

# Build directory
BUILD_DIR="/tmp/fceux-wasm-build"
FCEUX_DIR="/tmp/fceux-wasm"
OUTPUT_DIR="$(pwd)/public/wasm"

mkdir -p "$BUILD_DIR"
mkdir -p "$OUTPUT_DIR"

echo "📁 Build directory: $BUILD_DIR"
echo "📁 Output directory: $OUTPUT_DIR"

# Check if we need to install scons
if ! command -v scons &> /dev/null; then
    echo "📦 Installing SCons..."
    pip3 install --user scons
    export PATH="$HOME/.local/bin:$PATH"
fi

cd "$FCEUX_DIR"

echo "🔧 Configuring FCEUX for Emscripten..."

# Set up environment variables for build
export CPPPATH="/tmp/zlib-1.3.1:$FCEUX_DIR/src/lua/src"
export LIBPATH="/tmp/zlib-1.3.1:$FCEUX_DIR/src/lua"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
git clean -xfd || true

echo "🔨 Building FCEUX with Emscripten..."

# Build command with all necessary flags
EMCC_FAST_COMPILER=1 emconfigure scons \
    RELEASE=1 \
    GTK=0 \
    LUA=0 \
    SYSTEM_LUA=0 \
    CREATE_AVI=0 \
    OPENGL=0 \
    EMSCRIPTEN=1 \
    -j4

echo "📦 Generating WebAssembly files..."

# Find the generated object file
FCEUX_OBJ=$(find . -name "fceux" -type f | head -1)

if [ ! -f "$FCEUX_OBJ" ]; then
    echo "❌ FCEUX object file not found"
    exit 1
fi

echo "📄 Found FCEUX object: $FCEUX_OBJ"

# Generate WASM and JS files with required exports
emcc "$FCEUX_OBJ" \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=64MB \
    -s MAXIMUM_MEMORY=128MB \
    -s EXPORTED_FUNCTIONS='["_main","_init","_loadRom","_frame","_reset","_getFrameBuffer","_getFrameBufferSize","_setButton","_setRunning","_getPalette"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue","writeArrayToMemory"]' \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="FCEUXModule" \
    -s USE_SDL=2 \
    -s ASYNCIFY=1 \
    -O3 \
    -o "$BUILD_DIR/fceux.js"

echo "✅ FCEUX WebAssembly build completed!"

# Copy files to output directory
cp "$BUILD_DIR/fceux.wasm" "$OUTPUT_DIR/fceux.wasm"
cp "$BUILD_DIR/fceux.js" "$OUTPUT_DIR/fceux.js"

echo "📊 Build results:"
echo "   WASM size: $(wc -c < "$OUTPUT_DIR/fceux.wasm") bytes"
echo "   JS size: $(wc -c < "$OUTPUT_DIR/fceux.js") bytes"

echo "✅ Files ready:"
echo "   $OUTPUT_DIR/fceux.wasm"
echo "   $OUTPUT_DIR/fceux.js"

echo "🎉 FCEUX WebAssembly build complete!"