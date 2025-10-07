// Game Boy Core for EmulatorJS
// This will be loaded dynamically by EmulatorJS
console.log('Loading Game Boy core...');

// Core configuration for Game Boy
window.EJS_coreConfig = window.EJS_coreConfig || {};
window.EJS_coreConfig.gb = {
    name: 'Game Boy',
    extensions: ['gb', 'gbc'],
    biosFiles: [],
    coreUrl: 'https://cdn.emulatorjs.org/stable/data/cores/gb.js'
};

// Load core from CDN as fallback
if (typeof window.EJS_loadCore === 'function') {
    window.EJS_loadCore('gb');
}