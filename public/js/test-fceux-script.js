const initBtn = document.getElementById('initBtn');
const loadRomBtn = document.getElementById('loadRomBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const canvas = document.getElementById('nesCanvas');
const statusDiv = document.getElementById('status');
const logDiv = document.getElementById('log');

let core = null;
let player = null;
let animationId = null;
let isRunning = false;

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

// Initialize core
async function initCore() {
    try {
        updateStatus('Initializing NES core...', 'info');
        initBtn.disabled = true;

        if (typeof window.NESInterface === 'undefined') {
            throw new Error('NES Interface not loaded');
        }

        core = new window.NESInterface();
        const result = await core.init();

        if (!result) {
            throw new Error('Core initialization failed');
        }

        updateStatus('Core initialized successfully', 'success');
        loadRomBtn.disabled = false;

        // Log frame spec
        const spec = core.getFrameSpec();
        log(`Frame spec: ${spec.width}x${spec.height}, format: ${spec.format}`);

        const buffer = core.getFrameBuffer();
        log(`Initial buffer length: ${buffer.length}`);

    } catch (error) {
        updateStatus(`Initialization failed: ${error.message}`, 'error');
        initBtn.disabled = false;
    }
}

// Load test ROM
async function loadTestRom() {
    try {
        updateStatus('Creating test ROM...', 'info');
        loadRomBtn.disabled = true;

        // Create a minimal test ROM (just header)
        const testRom = new Uint8Array([
            0x4E, 0x45, 0x53, 0x1A, // "NES" + EOF
            0x01,                   // 1 PRG bank
            0x01,                   // 1 CHR bank
            0x00,                   // Control flags
            0x00,                   // Control flags
            0x00,                   // Mapper flags
            0x00,                   // Mapper flags
            0x00, 0x00, 0x00, 0x00  // Padding
        ]);

        const result = core.loadROM(testRom);

        if (!result) {
            throw new Error('ROM loading failed');
        }

        updateStatus('Test ROM loaded successfully', 'success');
        playBtn.disabled = false;
        resetBtn.disabled = false;

        // Log frame spec after ROM load
        const spec = core.getFrameSpec();
        log(`Frame spec after ROM load: ${spec.width}x${spec.height}, format: ${spec.format}`);

        const buffer = core.getFrameBuffer();
        log(`Buffer length after ROM load: ${buffer.length}`);

        if (spec.format === 'INDEXED8') {
            const palette = core.getPalette();
            log(`Palette length: ${palette.length}, type: ${palette.constructor.name}`);
        }

    } catch (error) {
        updateStatus(`ROM loading failed: ${error.message}`, 'error');
        loadRomBtn.disabled = false;
    }
}

// Start emulator
function startEmulator() {
    if (!core) return;

    updateStatus('Starting emulator...', 'info');
    core.setRunning(true);
    isRunning = true;

    playBtn.disabled = true;
    pauseBtn.disabled = false;

    gameLoop();
    updateStatus('Emulator running', 'success');
}

// Pause emulator
function pauseEmulator() {
    if (!core) return;

    updateStatus('Pausing emulator...', 'info');
    core.setRunning(false);
    isRunning = false;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    playBtn.disabled = false;
    pauseBtn.disabled = true;

    updateStatus('Emulator paused', 'info');
}

// Reset emulator
function resetEmulator() {
    if (!core) return;

    updateStatus('Resetting emulator...', 'info');
    core.reset();
    updateStatus('Emulator reset', 'success');
}

// Game loop
function gameLoop() {
    if (!isRunning || !core) return;

    core.frame();
    blitFrame();

    animationId = requestAnimationFrame(gameLoop);
}

// Blit frame to canvas
function blitFrame() {
    const spec = core.getFrameSpec();
    const src = core.getFrameBuffer();

    // Guard against wrong lengths
    const expected =
        spec.format === 'RGBA32' ? spec.width * spec.height * 4 :
        spec.format === 'RGB24'  ? spec.width * spec.height * 3 :
        spec.format === 'INDEXED8' ? spec.width * spec.height :
        -1;

    if (src.length !== expected) {
        log(`Unexpected frame length: got ${src.length}, expected ${expected}`, 'error');
        return;
    }

    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(spec.width, spec.height);
    const dst = imageData.data;

    if (spec.format === 'RGBA32') {
        dst.set(src);
    } else if (spec.format === 'RGB24') {
        let si = 0, di = 0;
        while (si < src.length) {
            dst[di++] = src[si++]; // R
            dst[di++] = src[si++]; // G
            dst[di++] = src[si++]; // B
            dst[di++] = 255;       // A
        }
    } else if (spec.format === 'INDEXED8') {
        const pal = core.getPalette();
        if (!pal) {
            log('INDEXED8 format without palette', 'error');
            return;
        }

        const useU32 = pal instanceof Uint32Array;
        let di = 0;
        for (let i = 0; i < src.length; i++) {
            const idx = src[i] & 0xff;
            if (useU32) {
                const rgba = pal[idx];
                dst[di++] =  rgba        & 0xff;       // R
                dst[di++] = (rgba >>> 8) & 0xff;       // G
                dst[di++] = (rgba >>>16) & 0xff;       // B
                dst[di++] = (rgba >>>24) & 0xff;       // A
            } else {
                const base = idx * 4;
                dst[di++] = pal[base + 0];  // R
                dst[di++] = pal[base + 1];  // G
                dst[di++] = pal[base + 2];  // B
                dst[di++] = pal[base + 3] ?? 255; // A
            }
        }
    } else {
        log(`Unsupported frame format: ${spec.format}`, 'error');
        return;
    }

    ctx.putImageData(imageData, 0, 0);
}

// Keyboard controls
const keyMap = {
    'ArrowRight': 0,
    'ArrowLeft': 1,
    'ArrowDown': 2,
    'ArrowUp': 3,
    'Enter': 4,
    'Shift': 5,
    'z': 6,
    'x': 7,
};

document.addEventListener('keydown', (e) => {
    const button = keyMap[e.key];
    if (button !== undefined && core) {
        core.setButton(button, true);
        log(`Key down: ${e.key} (button ${button})`);
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    const button = keyMap[e.key];
    if (button !== undefined && core) {
        core.setButton(button, false);
        log(`Key up: ${e.key} (button ${button})`);
        e.preventDefault();
    }
});

// Event listeners
initBtn.addEventListener('click', initCore);
loadRomBtn.addEventListener('click', loadTestRom);
playBtn.addEventListener('click', startEmulator);
pauseBtn.addEventListener('click', pauseEmulator);
resetBtn.addEventListener('click', resetEmulator);

// Initialize
log('Test page loaded. Click "Initialize Core" to begin.', 'info');