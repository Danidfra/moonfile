// Simple logger
const logContainer = document.getElementById('logs');
function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    console.log(message);
}

// Test ROM data (simple test pattern)
const testROM = new Uint8Array([
    0x4E, 0x45, 0x53, 0x1A, // NES header
    0x01,                   // 1 PRG ROM bank
    0x01,                   // 1 CHR ROM bank
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Flags
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Remaining header
    // Simple PRG data (just to have something)
    0x4C, 0x00, 0x00, 0x60, // JMP $6000 (infinite loop)
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, // NOPs
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
]);

let emulator = null;
let frameCount = 0;

// Wait for FCEUX core to load
function waitForCore() {
    if (typeof window.FCEUX !== 'undefined') {
        log('FCEUX core loaded', 'success');
        setupEmulator();
    } else {
        log('Waiting for FCEUX core...', 'warn');
        setTimeout(waitForCore, 100);
    }
}

function setupEmulator() {
    // Import our emulator class (simulate the import)
    // In real scenario, this would be imported from the built JS
    log('Setting up emulator...', 'info');

    // Mock the FCEUXEmulator class for testing
    class FCEUXEmulator {
        constructor() {
            this.core = null;
            this.ready = false;
            this.canvas = null;
            this.ctx = null;
            this.imageData = null;
            this.rafId = 0;
            this.running = false;
            this.frameCount = 0;
            this.warnedNoPalette = false;
            log('FCEUXEmulator constructed', 'info');
        }

        async init(canvas, opts) {
            log('Initializing emulator...', 'info');

            this.canvas = canvas;
            this.ensureCanvas();

            // Initialize core
            this.core = window.FCEUX;
            if (!this.core) {
                throw new Error('FCEUX core not found');
            }

            await this.core.init();
            this.ready = true;
            log('Emulator initialized successfully', 'success');
        }

        ensureCanvas() {
            if (!this.canvas) return;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.canvas.width = 256 * 2 * dpr;
            this.canvas.height = 240 * 2 * dpr;
            this.canvas.style.width = `${256 * 2}px`;
            this.canvas.style.height = `${240 * 2}px`;

            this.ctx = this.canvas.getContext('2d', { alpha: false })!;
            this.ctx.imageSmoothingEnabled = false;
            this.imageData = this.ctx.createImageData(256, 240); // RGBA target

            log(`Canvas setup: ${this.canvas.width}x${this.canvas.height}, CSS: ${this.canvas.style.width}x${this.canvas.style.height}, DPR: ${dpr}`, 'success');
        }

        loadROM(bytes) {
            log('Loading ROM...', 'info');

            if (!this.ready) {
                throw new Error('Emulator not ready');
            }

            // Validate NES header
            if (bytes[0] !== 0x4E || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1A) {
                throw new Error('Invalid NES header');
            }

            const success = this.core.loadRom(bytes, bytes.length);
            if (success) {
                log('ROM loaded successfully', 'success');
                return true;
            } else {
                log('Failed to load ROM', 'error');
                return false;
            }
        }

        play() {
            log('Play called', 'info');

            if (!this.ready) {
                log('Emulator not ready', 'error');
                return;
            }

            if (!this.running) {
                this.running = true;
                this.core.setRunning(true);

                log('Starting game loop...', 'info');

                const loop = () => {
                    if (!this.running) {
                        log('Game loop stopped', 'warn');
                        return;
                    }

                    this.core.frame();
                    this.blitFrame();
                    this.rafId = requestAnimationFrame(loop);
                };

                if (!this.rafId) {
                    this.rafId = requestAnimationFrame(loop);
                }

                log('Emulator started', 'success');
            }
        }

        pause() {
            log('Pause called', 'info');

            this.running = false;
            this.warnedNoPalette = false; // Reset palette warning on pause
            this.core.setRunning(false);

            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = 0;
            }

            log('Emulator paused', 'success');
        }

        reset() {
            log('Reset called', 'info');

            this.warnedNoPalette = false; // Reset palette warning on reset
            if (this.core.reset) {
                this.core.reset();
            }
            log('Emulator reset', 'success');
        }

        blitFrame() {
            if (!this.ctx || !this.imageData) {
                return;
            }

            try {
                const src = this.core.getFrameBuffer();
                const dst = this.imageData.data;

                if (!src) {
                    log('No frame buffer available', 'warn');
                    return;
                }

                // Handle different framebuffer formats
                const N_PIX = 256 * 240;
                if (src.length === N_PIX * 4) {
                    // RGBA32 - direct copy
                    dst.set(src);
                } else if (src.length === N_PIX * 3) {
                    // RGB24 -> RGBA conversion
                    let si = 0, di = 0;
                    for (let i = 0; i < N_PIX; i++) {
                        dst[di++] = src[si++]; // R
                        dst[di++] = src[si++]; // G
                        dst[di++] = src[si++]; // B
                        dst[di++] = 255;       // A
                    }
                } else if (src.length === N_PIX) {
                    // Indexed8 -> RGBA via palette
                    const pal = this.core.getPalette?.();
                    if (!pal) {
                        if (!this.warnedNoPalette) {
                            log('Indexed frame but no palette', 'warn');
                            this.warnedNoPalette = true;
                        }
                        return;
                    }

                    const hasA = pal.length === 256 * 4;
                    let di = 0;
                    for (let i = 0; i < N_PIX; i++) {
                        const idx = src[i] & 0xff;
                        const pi = hasA ? idx * 4 : idx * 3;
                        dst[di++] = pal[pi + 0];     // R
                        dst[di++] = pal[pi + 1];     // G
                        dst[di++] = pal[pi + 2];     // B
                        dst[di++] = hasA ? pal[pi + 3] : 255; // A
                    }
                } else {
                    log(`Unexpected framebuffer size: ${src.length} (expected ${N_PIX}, ${N_PIX * 3}, or ${N_PIX * 4})`, 'warn');
                    return;
                }

                // Always draw at native resolution (0,0)
                this.ctx.putImageData(this.imageData, 0, 0);

                this.frameCount++;
                if (this.frameCount % 60 === 0) {
                    const format = src.length === N_PIX * 4 ? 'RGBA32' :
                                 src.length === N_PIX * 3 ? 'RGB24' :
                                 src.length === N_PIX ? 'Indexed8' : 'Unknown';
                    log(`Blit ok #${this.frameCount} (format: ${format})`, 'success');
                    document.getElementById('frameCount').textContent = this.frameCount;
                }
            } catch (error) {
                log(`Blit frame error: ${error.message}`, 'error');
            }
        }

        dispose() {
            log('Disposing emulator...', 'info');

            this.running = false;
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = 0;
            }

            this.canvas = null;
            this.ctx = null;
            this.imageData = null;
            this.core = null;
            this.ready = false;
            this.running = false;

            log('Emulator disposed', 'success');
        }

        getIsRunning() {
            return this.running;
        }

        getIsPaused() {
            return !this.running;
        }

        getIsReady() {
            return this.ready;
        }
    }

    emulator = new FCEUXEmulator();
    const canvas = document.getElementById('gameCanvas');

    emulator.init(canvas, { audio: false }).then(() => {
        document.getElementById('loadRom').disabled = false;
        updateStatus('Ready - ROM can be loaded');
    }).catch(error => {
        log(`Init failed: ${error.message}`, 'error');
    });
}

function updateStatus(status) {
    document.getElementById('status').textContent = status;
    log(`Status: ${status}`, 'info');
}

function updateRunningState() {
    const running = emulator ? emulator.getIsRunning() : false;
    document.getElementById('isRunning').textContent = running;

    document.getElementById('playBtn').disabled = running || !emulator?.getIsReady();
    document.getElementById('pauseBtn').disabled = !running;
    document.getElementById('resetBtn').disabled = !emulator?.getIsReady();
}

// Event listeners
document.getElementById('loadRom').addEventListener('click', async () => {
    if (!emulator) return;

    try {
        const success = emulator.loadROM(testROM);
        if (success) {
            updateStatus('ROM loaded - ready to play');
            updateRunningState();
            log('Test ROM loaded successfully', 'success');
        } else {
            updateStatus('Failed to load ROM');
            log('ROM load failed', 'error');
        }
    } catch (error) {
        updateStatus(`ROM load error: ${error.message}`);
        log(`ROM load error: ${error.message}`, 'error');
    }
});

document.getElementById('playBtn').addEventListener('click', () => {
    if (!emulator) return;

    emulator.play();
    updateStatus('Running');
    updateRunningState();
    log('Play button clicked', 'info');
});

document.getElementById('pauseBtn').addEventListener('click', () => {
    if (!emulator) return;

    emulator.pause();
    updateStatus('Paused');
    updateRunningState();
    log('Pause button clicked', 'info');
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (!emulator) return;

    emulator.reset();
    log('Reset button clicked', 'info');
});

document.getElementById('disposeBtn').addEventListener('click', () => {
    if (!emulator) return;

    emulator.dispose();
    emulator = null;
    updateStatus('Disposed');
    updateRunningState();
    log('Dispose button clicked', 'info');

    // Reset buttons
    document.getElementById('loadRom').disabled = true;
    document.getElementById('playBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('resetBtn').disabled = true;
    document.getElementById('frameCount').textContent = '0';
});

// Start waiting for core
waitForCore();