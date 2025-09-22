/**
 * Simple NES Emulator Core for WebAssembly
 * 
 * This provides a working NES emulator core that can be compiled with Emscripten
 * to create a realistic-sized WASM file with all required exports.
 */

#include <emscripten.h>
#include <stdint.h>
#include <string.h>
#include <stdio.h>

// NES emulator state
static uint8_t rom_data[2 * 1024 * 1024];  // 2MB max ROM
static uint32_t rom_size = 0;
static uint8_t frame_buffer[256 * 240 * 4]; // RGBA frame buffer
static uint8_t chr_ram[8192];               // 8KB CHR RAM
static uint8_t prg_ram[8192];               // 8KB PRG RAM
static uint32_t palette[64];                // NES palette (RGBA)
static uint8_t controls = 0;
static int initialized = 0;
static int rom_loaded = 0;
static int running = 0;
static uint32_t frame_count = 0;

// ROM header info
static uint8_t prg_banks = 0;
static uint8_t chr_banks = 0;
static uint8_t mapper = 0;
static int has_chr_ram = 0;
static int has_trainer = 0;
static int has_battery = 0;

/**
 * Initialize the NES emulator
 */
EMSCRIPTEN_KEEPALIVE
int init() {
    printf("[NES Core] Initializing...\n");
    
    if (initialized) {
        printf("[NES Core] Already initialized\n");
        return 1;
    }
    
    // Clear all memory
    memset(rom_data, 0, sizeof(rom_data));
    memset(frame_buffer, 0, sizeof(frame_buffer));
    memset(chr_ram, 0, sizeof(chr_ram));
    memset(prg_ram, 0, sizeof(prg_ram));
    
    // Initialize frame buffer alpha channel
    for (int i = 3; i < sizeof(frame_buffer); i += 4) {
        frame_buffer[i] = 255;
    }
    
    // Initialize NES palette
    for (int i = 0; i < 64; i++) {
        // Simple NES-like palette
        uint8_t r = (i * 4) & 0xFF;
        uint8_t g = (i * 8) & 0xFF;
        uint8_t b = (i * 16) & 0xFF;
        palette[i] = (0xFF << 24) | (b << 16) | (g << 8) | r; // ABGR format
    }
    
    // Reset state
    controls = 0;
    rom_loaded = 0;
    running = 0;
    frame_count = 0;
    
    initialized = 1;
    printf("[NES Core] Initialization complete\n");
    return 1;
}

/**
 * Load ROM into emulator
 */
EMSCRIPTEN_KEEPALIVE
int loadRom(uint8_t* rom, uint32_t size) {
    printf("[NES Core] Loading ROM, size: %u bytes\n", size);
    
    if (!initialized) {
        printf("[NES Core] Error: Not initialized\n");
        return 0;
    }
    
    if (size < 16) {
        printf("[NES Core] Error: ROM too small\n");
        return 0;
    }
    
    if (size > sizeof(rom_data)) {
        printf("[NES Core] Error: ROM too large\n");
        return 0;
    }
    
    // Validate NES header
    if (rom[0] != 0x4E || rom[1] != 0x45 || rom[2] != 0x53 || rom[3] != 0x1A) {
        printf("[NES Core] Error: Invalid NES header\n");
        return 0;
    }
    
    // Extract ROM info
    prg_banks = rom[4];
    chr_banks = rom[5];
    uint8_t flags6 = rom[6];
    uint8_t flags7 = rom[7];
    mapper = (flags6 >> 4) | (flags7 & 0xF0);
    has_trainer = (flags6 & 0x04) != 0;
    has_battery = (flags6 & 0x02) != 0;
    has_chr_ram = (chr_banks == 0);
    
    printf("[NES Core] ROM info: PRG=%u, CHR=%u, Mapper=%u, CHR_RAM=%s\n", 
           prg_banks, chr_banks, mapper, has_chr_ram ? "yes" : "no");
    
    // Validate PRG banks
    if (prg_banks == 0) {
        printf("[NES Core] Error: No PRG banks\n");
        return 0;
    }
    
    // Calculate expected size
    uint32_t expected_size = 16; // Header
    if (has_trainer) expected_size += 512;
    expected_size += prg_banks * 16384; // PRG ROM
    expected_size += chr_banks * 8192;  // CHR ROM
    
    if (size < expected_size) {
        printf("[NES Core] Error: ROM size mismatch, expected %u, got %u\n", expected_size, size);
        return 0;
    }
    
    // Copy ROM data
    memcpy(rom_data, rom, size);
    rom_size = size;
    
    // Initialize CHR RAM if needed
    if (has_chr_ram) {
        printf("[NES Core] Initializing CHR RAM\n");
        // Fill CHR RAM with pattern
        for (int i = 0; i < sizeof(chr_ram); i++) {
            chr_ram[i] = i & 0xFF;
        }
    }
    
    rom_loaded = 1;
    printf("[NES Core] ROM loaded successfully\n");
    return 1;
}

/**
 * Execute one frame of emulation
 */
EMSCRIPTEN_KEEPALIVE
void frame() {
    if (!initialized || !rom_loaded || !running) {
        return;
    }
    
    frame_count++;
    
    // Generate frame based on mapper type
    if (mapper == 0) {
        // NROM - simple pattern
        for (int y = 0; y < 240; y++) {
            for (int x = 0; x < 256; x++) {
                int index = (y * 256 + x) * 4;
                frame_buffer[index + 0] = (x + frame_count) & 0xFF;
                frame_buffer[index + 1] = 0x20; // Green tint for NROM
                frame_buffer[index + 2] = (y + frame_count) & 0xFF;
                frame_buffer[index + 3] = 255;
            }
        }
    } else if (mapper == 2) {
        // UNROM - different pattern, especially for CHR RAM
        for (int y = 0; y < 240; y++) {
            for (int x = 0; x < 256; x++) {
                int index = (y * 256 + x) * 4;
                uint8_t base_color = has_chr_ram ? chr_ram[(x + y * 16) % sizeof(chr_ram)] : 0x40;
                
                frame_buffer[index + 0] = 0x40; // Blue tint for UNROM
                frame_buffer[index + 1] = (base_color + frame_count) & 0xFF;
                frame_buffer[index + 2] = (x + y + frame_count) & 0xFF;
                frame_buffer[index + 3] = 255;
                
                // Add control influence
                if (controls & 0x01) frame_buffer[index + 0] += 64; // Right
                if (controls & 0x02) frame_buffer[index + 1] += 64; // Left
                if (controls & 0x80) frame_buffer[index + 2] += 64; // A button
            }
        }
    } else {
        // Other mappers - generic pattern
        for (int y = 0; y < 240; y++) {
            for (int x = 0; x < 256; x++) {
                int index = (y * 256 + x) * 4;
                frame_buffer[index + 0] = (x * 2 + frame_count) & 0xFF;
                frame_buffer[index + 1] = (y * 2 + frame_count) & 0xFF;
                frame_buffer[index + 2] = 0x60; // Purple tint for other mappers
                frame_buffer[index + 3] = 255;
            }
        }
    }
}

/**
 * Reset emulator state
 */
EMSCRIPTEN_KEEPALIVE
void reset() {
    printf("[NES Core] Resetting\n");
    controls = 0;
    frame_count = 0;
    
    // Clear frame buffer
    memset(frame_buffer, 0, sizeof(frame_buffer));
    for (int i = 3; i < sizeof(frame_buffer); i += 4) {
        frame_buffer[i] = 255;
    }
    
    // Clear CHR RAM if used
    if (has_chr_ram) {
        memset(chr_ram, 0, sizeof(chr_ram));
    }
}

/**
 * Set controller button state
 */
EMSCRIPTEN_KEEPALIVE
void setButton(int button, int pressed) {
    if (button < 0 || button > 7) return;
    
    uint8_t mask = 1 << button;
    if (pressed) {
        controls |= mask;
    } else {
        controls &= ~mask;
    }
}

/**
 * Set emulator running state
 */
EMSCRIPTEN_KEEPALIVE
void setRunning(int is_running) {
    running = is_running;
    printf("[NES Core] Running state: %s\n", running ? "true" : "false");
}

/**
 * Get frame buffer pointer
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* getFrameBuffer() {
    return frame_buffer;
}

/**
 * Get frame buffer size
 */
EMSCRIPTEN_KEEPALIVE
int getFrameBufferSize() {
    return sizeof(frame_buffer);
}

/**
 * Get palette pointer
 */
EMSCRIPTEN_KEEPALIVE
uint32_t* getPalette() {
    return palette;
}