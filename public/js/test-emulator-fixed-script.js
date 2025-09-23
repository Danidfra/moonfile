let core = null;
let player = null;
let animationId = null;
let isRunning = false;

const canvas = document.getElementById('nesCanvas');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const logDiv = document.getElementById('log');

function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-${type}`;
    entry.textContent = `[${timestamp}] ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(message);
}

function updateStatus(message) {
    statusDiv.textContent = message;
    log(`Status: ${message}`, 'info');
}

// Load NES interface
async function loadCore() {
    try {
        log('Loading NES interface...');
        
        // Import the nes-interface module
        const nesInterface = await import('/public/lib/fceux/nes-interface.js');
        
        log('NES interface loaded successfully', 'success');
        
        // Initialize core
        core = new nesInterface.NESCore();
        player = new nesInterface.NESPlayer(core, canvas);
        
        log('Core and player initialized', 'success');
        
        // Enable UI
        document.getElementById('loadRomBtn').disabled = false;
        updateStatus('Ready - Load a ROM to start');
        
    } catch (error) {
        log(`Failed to load core: ${error.message}`, 'error');
        updateStatus('Failed to load core');
    }
}

// Load ROM function
async function loadROM() {
    try {
        log('Loading test ROM...');
        
        // Create a simple test ROM
        const testROM = new Uint8Array([
            0x4E, 0x45, 0x53, 0x1A, // NES header
            0x01,                   // 1 PRG ROM bank
            0x01,                   // 1 CHR ROM bank
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Flags
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Remaining header
            // Simple PRG data (just to have something)
            0x4C, 0x00, 0x00, 0x60, // JMP $6000 (infinite loop)
            0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, // NOPs
            0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
        ]);
        
        const success = await core.loadROM(testROM);
        
        if (success) {
            log('ROM loaded successfully', 'success');
            document.getElementById('playBtn').disabled = false;
            document.getElementById('resetBtn').disabled = false;
            updateStatus('ROM loaded - Press Play to start');
        } else {
            log('Failed to load ROM', 'error');
            updateStatus('Failed to load ROM');
        }
        
    } catch (error) {
        log(`ROM loading error: ${error.message}`, 'error');
        updateStatus('ROM loading failed');
    }
}

// Play function
function play() {
    if (!core || isRunning) return;
    
    try {
        log('Starting emulation...');
        isRunning = true;
        
        // Start the core
        core.start();
        
        // Start rendering
        function render() {
            if (!isRunning) return;
            
            // Run a frame
            core.frame();
            
            // Get frame buffer and render
            const buffer = core.getFrameBuffer();
            if (buffer && buffer.length > 0) {
                // Convert to ImageData and render
                const imageData = ctx.createImageData(256, 240);
                
                // Handle different buffer formats
                if (buffer.length === 256 * 240 * 4) {
                    // RGBA format - direct copy
                    imageData.data.set(buffer);
                } else if (buffer.length === 256 * 240 * 3) {
                    // RGB format - convert to RGBA
                    for (let i = 0, j = 0; i < buffer.length; i += 3, j += 4) {
                        imageData.data[j] = buffer[i];     // R
                        imageData.data[j + 1] = buffer[i + 1]; // G
                        imageData.data[j + 2] = buffer[i + 2]; // B
                        imageData.data[j + 3] = 255;           // A
                    }
                } else {
                    log(`Unexpected buffer format: ${buffer.length} bytes`, 'warn');
                    return;
                }
                
                ctx.putImageData(imageData, 0, 0);
            }
            
            animationId = requestAnimationFrame(render);
        }
        
        render();
        
        document.getElementById('playBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        updateStatus('Running');
        log('Emulation started', 'success');
        
    } catch (error) {
        log(`Play error: ${error.message}`, 'error');
        isRunning = false;
    }
}

// Pause function
function pause() {
    if (!core || !isRunning) return;
    
    try {
        log('Pausing emulation...');
        isRunning = false;
        
        // Stop the core
        core.stop();
        
        // Stop rendering
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        document.getElementById('playBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        updateStatus('Paused');
        log('Emulation paused', 'success');
        
    } catch (error) {
        log(`Pause error: ${error.message}`, 'error');
    }
}

// Reset function
function reset() {
    if (!core) return;
    
    try {
        log('Resetting emulation...');
        
        // Reset the core
        core.reset();
        
        updateStatus('Reset');
        log('Emulation reset', 'success');
        
    } catch (error) {
        log(`Reset error: ${error.message}`, 'error');
    }
}

// Event listeners
document.getElementById('loadRomBtn').addEventListener('click', loadROM);
document.getElementById('playBtn').addEventListener('click', play);
document.getElementById('pauseBtn').addEventListener('click', pause);
document.getElementById('resetBtn').addEventListener('click', reset);

// Initialize on load
window.addEventListener('load', () => {
    log('Page loaded, initializing...');
    loadCore();
});