// NES Core for EmulatorJS
// This will be loaded dynamically by EmulatorJS
console.log('Loading NES core...');

// Core configuration for NES
window.EJS_coreConfig = window.EJS_coreConfig || {};
window.EJS_coreConfig.nes = {
    name: 'Nintendo Entertainment System',
    extensions: ['nes'],
    biosFiles: [],
    coreUrl: 'https://cdn.emulatorjs.org/stable/data/cores/nes.js'
};

// Load core from CDN as fallback
if (typeof window.EJS_loadCore === 'function') {
    window.EJS_loadCore('nes');
}