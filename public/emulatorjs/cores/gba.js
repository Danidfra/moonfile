// GBA Core for EmulatorJS
// This will be loaded dynamically by EmulatorJS
console.log('Loading GBA core...');

// Core configuration for GBA
window.EJS_coreConfig = window.EJS_coreConfig || {};
window.EJS_coreConfig.gba = {
    name: 'Game Boy Advance',
    extensions: ['gba'],
    biosFiles: ['gba_bios.bin'],
    coreUrl: 'https://cdn.emulatorjs.org/stable/data/cores/gba.js'
};

// Load core from CDN as fallback
if (typeof window.EJS_loadCore === 'function') {
    window.EJS_loadCore('gba');
}