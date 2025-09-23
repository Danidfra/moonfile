const checkCoreBtn = document.getElementById('checkCoreBtn');
const testInitBtn = document.getElementById('testInitBtn');
const testLoadRomBtn = document.getElementById('testLoadRomBtn');
const logDiv = document.getElementById('log');

function log(message, type = 'debug') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(message);
}

// Check if FCEUX core is available
checkCoreBtn.addEventListener('click', () => {
    log('=== Checking FCEUX Core Availability ===', 'info');
    
    if (typeof window.FCEUX === 'undefined') {
        log('❌ FCEUX core not found on window object', 'error');
        log('Make sure fceux-web.js is loaded before this script', 'debug');
        return;
    }
    
    const core = window.FCEUX;
    log('✅ FCEUX core found on window object', 'success');
    log(`Core type: ${typeof core}`, 'debug');
    log(`Core constructor: ${core.constructor.name}`, 'debug');
    
    // Check available methods
    const methods = Object.keys(core);
    log(`Available methods: ${methods.join(', ')}`, 'debug');
    
    // Check for required methods
    const requiredMethods = ['init', 'loadRom', 'frame', 'reset', 'setButton', 'getFrameBuffer', 'setRunning'];
    const missingMethods = requiredMethods.filter(method => typeof core[method] !== 'function');
    
    if (missingMethods.length > 0) {
        log(`❌ Missing required methods: ${missingMethods.join(', ')}`, 'error');
        return;
    }
    
    log('✅ All required methods are available', 'success');
    requiredMethods.forEach(method => {
        log(`✓ ${method} is a function`, 'debug');
    });
    
    testInitBtn.disabled = false;
    log('=== Core availability check passed ===', 'success');
});

// Test core initialization
testInitBtn.addEventListener('click', async () => {
    try {
        log('=== Testing Core Initialization ===', 'info');
        
        const core = window.FCEUX;
        if (!core) {
            throw new Error('FCEUX core not available');
        }
        
        log('Calling core.init()...', 'debug');
        const result = await core.init();
        log(`core.init() returned: ${result}`, 'debug');
        
        if (result) {
            log('✅ Core initialization successful', 'success');
            testLoadRomBtn.disabled = false;
        } else {
            log('❌ Core initialization failed', 'error');
        }
        
        log('=== Core initialization test completed ===', 'info');
        
    } catch (error) {
        log(`❌ Core initialization error: ${error.message}`, 'error');
    }
});

// Test ROM loading
testLoadRomBtn.addEventListener('click', () => {
    try {
        log('=== Testing ROM Loading ===', 'info');
        
        const core = window.FCEUX;
        if (!core) {
            throw new Error('FCEUX core not available');
        }
        
        // Create a simple test ROM with valid NES header
        const testROM = new Uint8Array([
            0x4E, 0x45, 0x53, 0x1A, // NES header
            0x01,                   // PRG ROM size (1 bank = 16KB)
            0x01,                   // CHR ROM size (1 bank = 8KB)
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Flags
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00  // Remaining header
        ]);
        
        log(`Test ROM created, size: ${testROM.length} bytes`, 'debug');
        log(`Header: ${Array.from(testROM.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`, 'debug');
        
        log('Calling core.loadRom()...', 'debug');
        const success = core.loadRom(testROM, testROM.length);
        log(`core.loadRom() returned: ${success}`, 'debug');
        
        if (success) {
            log('✅ ROM loading successful', 'success');
        } else {
            log('❌ ROM loading failed', 'error');
        }
        
        log('=== ROM loading test completed ===', 'info');
        
    } catch (error) {
        log(`❌ ROM loading error: ${error.message}`, 'error');
    }
});

// Initial check
window.addEventListener('load', () => {
    log('Page loaded, checking FCEUX core...', 'info');
    setTimeout(() => {
        if (typeof window.FCEUX === 'undefined') {
            log('⚠️ FCEUX core still not available after page load', 'error');
        } else {
            log('✅ FCEUX core available after page load', 'success');
        }
    }, 100);
});

// Log initial state
log('FCEUX Core Loading Test initialized', 'info');
log('Waiting for manual core check...', 'debug');