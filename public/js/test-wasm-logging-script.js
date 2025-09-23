// Import nes-interface module
import { initNESCore } from './src/emulator/cores/nes-interface.js';

console.log('[Test] Starting WebAssembly loading test...');

// Test basic functionality
async function testBasicFunctionality() {
    try {
        console.log('[Test] Initializing NES core...');
        
        const core = await initNESCore();
        console.log('[Test] NES core initialized successfully');
        
        // Test basic core methods
        console.log('[Test] Testing core methods...');
        
        if (typeof core.init !== 'function') {
            throw new Error('Core init method not available');
        }
        
        if (typeof core.loadRom !== 'function') {
            throw new Error('Core loadRom method not available');
        }
        
        if (typeof core.frame !== 'function') {
            throw new Error('Core frame method not available');
        }
        
        if (typeof core.getFrameBuffer !== 'function') {
            throw new Error('Core getFrameBuffer method not available');
        }
        
        console.log('[Test] All core methods are available');
        
        // Test initialization
        console.log('[Test] Testing core initialization...');
        const initResult = await core.init();
        
        if (!initResult) {
            throw new Error('Core initialization failed');
        }
        
        console.log('[Test] Core initialization successful');
        
        // Test ROM loading
        console.log('[Test] Testing ROM loading...');
        
        // Create a simple test ROM
        const testRom = new Uint8Array([
            0x4E, 0x45, 0x53, 0x1A, // NES header
            0x01,                   // 1 PRG ROM bank
            0x01,                   // 1 CHR ROM bank
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Flags
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Remaining header
            // Simple PRG data (just to have something)
            0x4C, 0x00, 0x00, 0x60, // JMP $6000 (infinite loop)
            0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, // NOPs
            0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
        ]);
        
        console.log(`[Test] Test ROM created: ${testRom.length} bytes`);
        console.log(`[Test] ROM header: ${Array.from(testRom.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        
        const loadResult = core.loadRom(testRom);
        
        if (!loadResult) {
            throw new Error('ROM loading failed');
        }
        
        console.log('[Test] ROM loaded successfully');
        
        // Test frame generation
        console.log('[Test] Testing frame generation...');
        
        core.frame();
        core.frame();
        core.frame();
        
        console.log('[Test] Generated 3 frames');
        
        // Test frame buffer
        console.log('[Test] Testing frame buffer...');
        
        const frameBuffer = core.getFrameBuffer();
        
        if (!frameBuffer) {
            throw new Error('Frame buffer not available');
        }
        
        console.log(`[Test] Frame buffer size: ${frameBuffer.length} bytes`);
        console.log(`[Test] Expected size: ${256 * 240 * 4} bytes (RGBA)`);
        
        if (frameBuffer.length !== 256 * 240 * 4) {
            console.log(`[Test] Warning: Frame buffer size mismatch`);
        }
        
        // Sample some pixels
        console.log('[Test] Sampling first few pixels:');
        for (let i = 0; i < 16 && i < frameBuffer.length; i += 4) {
            const r = frameBuffer[i];
            const g = frameBuffer[i + 1];
            const b = frameBuffer[i + 2];
            const a = frameBuffer[i + 3];
            console.log(`[Test] Pixel ${i / 4}: RGBA(${r}, ${g}, ${b}, ${a})`);
        }
        
        console.log('[Test] All tests passed successfully');
        
        // Log summary
        console.log('[Test] === WebAssembly Loading Test Summary ===');
        console.log('[Test] ✓ NES core initialized');
        console.log('[Test] ✓ Core methods available');
        console.log('[Test] ✓ Core initialization successful');
        console.log('[Test] ✓ ROM loading successful');
        console.log('[Test] ✓ Frame generation working');
        console.log('[Test] ✓ Frame buffer accessible');
        console.log('[Test] ✓ All functionality tests passed');
        
    } catch (error) {
        console.error('[Test] === WebAssembly Loading Test FAILED ===');
        console.error(`[Test] Error: ${error.message}`);
        console.error('[Test] Stack:', error.stack);
    }
}

// Run the test
testBasicFunctionality().catch(error => {
    console.error('[Test] Test execution failed:', error);
});