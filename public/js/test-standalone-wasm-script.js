const logDiv = document.getElementById('log');
const statusDiv = document.getElementById('status');
const canvas = document.getElementById('wasmCanvas');
const ctx = canvas.getContext('2d');

let wasmModule = null;
let wasmInstance = null;
let isInitialized = false;

function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(message);
}

function updateStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status status-${type}`;
    log(message, type);
}

async function loadWasm() {
    try {
        updateStatus('Loading WASM module...', 'info');
        
        // Fetch WASM file
        const response = await fetch('/wasm/fceux.wasm');
        if (!response.ok) {
            throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
        }
        
        const wasmBytes = await response.arrayBuffer();
        log(`WASM file loaded: ${wasmBytes.byteLength} bytes`, 'success');
        
        // Create WebAssembly imports
        const imports = {
            env: {
                memory: new WebAssembly.Memory({ initial: 256, maximum: 256 }),
                abort: (msg, file, line, column) => {
                    console.error('WASM abort:', { msg, file, line, column });
                },
                emscripten_resize_heap: () => false,
                __handle_stack_overflow: () => {
                    console.error('WASM stack overflow');
                }
            }
        };
        
        // Compile and instantiate WASM
        const wasmModule = await WebAssembly.compile(wasmBytes);
        wasmInstance = await WebAssembly.instantiate(wasmModule, imports);
        
        log('WASM module compiled and instantiated', 'success');
        
        // Get exports
        const exports = wasmInstance.exports;
        const exportNames = Object.keys(exports);
        const functionExports = exportNames.filter(name => typeof exports[name] === 'function');
        
        log(`Available exports: ${exportNames.join(', ')}`, 'info');
        log(`Function exports: ${functionExports.join(', ')}`, 'info');
        
        // Check for required functions
        const requiredFunctions = ['init', 'loadRom', 'frame', 'getFrameBuffer'];
        const missingFunctions = requiredFunctions.filter(func => !exports[func]);
        
        if (missingFunctions.length > 0) {
            throw new Error(`Missing required functions: ${missingFunctions.join(', ')}`);
        }
        
        log('All required functions are available', 'success');
        isInitialized = true;
        
        // Enable UI
        document.getElementById('initBtn').disabled = true;
        document.getElementById('loadRomBtn').disabled = false;
        
        updateStatus('WASM initialized successfully', 'success');
        
    } catch (error) {
        log(`WASM loading failed: ${error.message}`, 'error');
        updateStatus('Failed to initialize WASM', 'error');
    }
}

async function loadTestRom() {
    if (!wasmInstance) return;
    
    try {
        updateStatus('Loading test ROM...', 'info');
        document.getElementById('loadRomBtn').disabled = true;
        
        // Create a simple test ROM with valid NES header
        const testRom = new Uint8Array([
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
        
        log(`Test ROM created: ${testRom.length} bytes`, 'info');
        log(`Header: ${Array.from(testRom.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`, 'info');
        
        // Copy ROM to WASM memory
        const memory = wasmInstance.exports.memory;
        const romOffset = 100 * 1024; // Place ROM at 100KB offset
        
        if (romOffset + testRom.length > memory.buffer.byteLength) {
            throw new Error('ROM too large for WASM memory');
        }
        
        const memoryArray = new Uint8Array(memory.buffer);
        memoryArray.set(testRom, romOffset);
        
        log(`ROM copied to WASM memory at offset ${romOffset}`, 'success');
        
        // Call loadRom function
        const exports = wasmInstance.exports;
        const result = exports.loadRom(romOffset, testRom.length);
        
        log(`loadRom returned: ${result}`, 'info');
        
        if (result) {
            updateStatus('ROM loaded successfully', 'success');
            document.getElementById('runBtn').disabled = false;
            document.getElementById('resetBtn').disabled = false;
        } else {
            updateStatus('Failed to load ROM', 'error');
        }
        
    } catch (error) {
        log(`ROM loading error: ${error.message}`, 'error');
        updateStatus(`ROM loading failed: ${error.message}`, 'error');
        document.getElementById('loadRomBtn').disabled = false;
    }
}

function runEmulator() {
    if (!wasmInstance) return;
    
    try {
        updateStatus('Running emulator...', 'info');
        
        const exports = wasmInstance.exports;
        let frameCount = 0;
        
        function render() {
            // Run a frame
            exports.frame();
            
            // Get frame buffer
            const buffer = exports.getFrameBuffer();
            
            if (buffer) {
                // Convert to ImageData and render
                const imageData = ctx.createImageData(256, 240);
                const data = imageData.data;
                
                // Simple conversion (assuming RGB format)
                for (let i = 0, j = 0; i < buffer.length && j < data.length; i += 3, j += 4) {
                    data[j] = buffer[i];     // R
                    data[j + 1] = buffer[i + 1]; // G
                    data[j + 2] = buffer[i + 2]; // B
                    data[j + 3] = 255;           // A
                }
                
                ctx.putImageData(imageData, 0, 0);
                
                frameCount++;
                if (frameCount % 60 === 0) {
                    log(`Rendered frame ${frameCount}`, 'success');
                    document.getElementById('frameCount').textContent = frameCount;
                }
            }
            
            requestAnimationFrame(render);
        }
        
        updateStatus('Emulator running', 'success');
        render();
        
    } catch (error) {
        log(`Emulator error: ${error.message}`, 'error');
        updateStatus(`Emulator error: ${error.message}`, 'error');
    }
}

function resetEmulator() {
    if (!wasmInstance) return;
    
    try {
        updateStatus('Resetting emulator...', 'info');
        
        // Reset frame counter
        document.getElementById('frameCount').textContent = '0';
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        log('Emulator reset', 'success');
        updateStatus('Emulator reset', 'success');
        
    } catch (error) {
        log(`Reset error: ${error.message}`, 'error');
    }
}

// Event listeners
document.getElementById('initBtn').addEventListener('click', loadWasm);
document.getElementById('loadRomBtn').addEventListener('click', loadTestRom);
document.getElementById('runBtn').addEventListener('click', runEmulator);
document.getElementById('resetBtn').addEventListener('click', resetEmulator);

// Initialize
log('Standalone WASM test page loaded', 'info');