// SNES Core for EmulatorJS
// This will be loaded dynamically by EmulatorJS
console.log('Loading SNES core...');

// Core configuration for SNES
window.EJS_coreConfig = window.EJS_coreConfig || {};
window.EJS_coreConfig.snes = {
    name: 'Super Nintendo Entertainment System',
    extensions: ['snes', 'smc', 'sfc'],
    biosFiles: [],
    coreUrl: 'https://cdn.emulatorjs.org/stable/data/cores/snes.js'
};

// Load core from CDN as fallback
if (typeof window.EJS_loadCore === 'function') {
    window.EJS_loadCore('snes');
}