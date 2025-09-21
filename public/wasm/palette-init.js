
// Palette initialization script
// This will be loaded to initialize the NES palette in WASM memory

window.initNESPalette = function(memory) {
  const paletteData = new Uint8Array([
84, 84, 84, 0, 28, 60, 16, 56, 100, 0, 16, 100, 8, 24, 32, 48, 24, 8, 0, 0, 0, 0, 0, 0, 136, 136, 136, 0, 56, 108, 0, 88, 148, 0, 68, 136, 68, 88, 100, 92, 120, 68, 0, 0, 0, 0, 0, 0, 188, 188, 188, 112, 148, 176, 64, 140, 172, 0, 136, 184, 108, 136, 152, 132, 168, 120, 0, 0, 0, 0, 0, 0, 252, 252, 252, 180, 204, 224, 120, 200, 232, 104, 176, 220, 152, 184, 200, 160, 204, 160, 0, 0, 0, 0, 0, 0, 252, 252, 252, 248, 152, 248, 160, 188, 252, 144, 192, 252, 176, 204, 252, 192, 220, 252, 0, 0, 0, 0, 0, 0, 252, 252, 252, 252, 144, 176, 252, 112, 160, 252, 80, 144, 252, 48, 128, 252, 16, 112, 0, 0, 0, 0, 0, 0, 252, 252, 252, 252, 0, 96, 252, 0, 64, 252, 0, 32, 192, 0, 32, 128, 0, 32, 0, 0, 0, 0, 0, 0, 64, 64, 64, 96, 96, 96, 128, 128, 128, 160, 160, 160, 192, 192, 192, 224, 224, 224, 255, 255, 255, 255, 255, 255
  ]);
  
  // Write palette to WASM memory at palette location (98304)
  const paletteView = new Uint8Array(memory, 98304, paletteData.length);
  paletteView.set(paletteData);
  
  console.log('[NES Palette] Initialized with', paletteData.length / 3, 'colors');
  return true;
};
