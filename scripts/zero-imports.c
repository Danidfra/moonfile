#include <stdint.h>

// Static memory allocation
static uint8_t frame_buffer[245760];  // 256*240*4
static uint8_t nes_palette[256];      // 64*4
static uint8_t rom_buffer[2097152];   // 2MB

// State
static int initialized = 0;
static int rom_loaded = 0;
static uint32_t controls = 0;
static uint32_t frame_count = 0;
static uint32_t rom_size = 0;

// Manual memory operations
static void zero_mem(void* ptr, uint32_t size) {
    uint8_t* p = (uint8_t*)ptr;
    for (uint32_t i = 0; i < size; i++) p[i] = 0;
}

static void copy_mem(void* dst, const void* src, uint32_t size) {
    uint8_t* d = (uint8_t*)dst;
    const uint8_t* s = (const uint8_t*)src;
    for (uint32_t i = 0; i < size; i++) d[i] = s[i];
}

// Initialize palette
static void init_palette() {
    for (int i = 0; i < 64; i++) {
        nes_palette[i*4+0] = (i * 4) & 255;   // R
        nes_palette[i*4+1] = (i * 8) & 255;   // G
        nes_palette[i*4+2] = (i * 16) & 255;  // B
        nes_palette[i*4+3] = 255;             // A
    }
}

static void clear_frame() {
    zero_mem(frame_buffer, sizeof(frame_buffer));
    for (int i = 3; i < sizeof(frame_buffer); i += 4) {
        frame_buffer[i] = 255;
    }
}

static void render_frame() {
    frame_count++;
    
    for (int y = 0; y < 240; y++) {
        for (int x = 0; x < 256; x++) {
            int idx = (y * 256 + x) * 4;
            
            uint8_t r = ((x + frame_count) & 255);
            uint8_t g = ((y + frame_count) & 255);
            uint8_t b = (((x + y) + frame_count) & 255);
            
            if (controls & 1) r = (r + 64) & 255;
            if (controls & 2) r = (r - 32) & 255;
            if (controls & 4) g = (g + 64) & 255;
            if (controls & 8) g = (g - 32) & 255;
            if (controls & 128) b = (b + 128) & 255;
            if (controls & 64) b = (b + 96) & 255;
            
            frame_buffer[idx+0] = r;
            frame_buffer[idx+1] = g;
            frame_buffer[idx+2] = b;
            frame_buffer[idx+3] = 255;
        }
    }
}

// Exported functions
__attribute__((export_name("init")))
int init() {
    if (initialized) return 1;
    
    zero_mem(frame_buffer, sizeof(frame_buffer));
    zero_mem(nes_palette, sizeof(nes_palette));
    zero_mem(rom_buffer, sizeof(rom_buffer));
    
    controls = 0;
    frame_count = 0;
    rom_loaded = 0;
    rom_size = 0;
    
    init_palette();
    clear_frame();
    
    initialized = 1;
    return 1;
}

__attribute__((export_name("loadRom")))
int loadRom(uint8_t* rom_data, int size) {
    if (!initialized || size < 16 || size > sizeof(rom_buffer)) return 0;
    
    if (rom_data[0] != 0x4E || rom_data[1] != 0x45 || 
        rom_data[2] != 0x53 || rom_data[3] != 0x1A) {
        return 0;
    }
    
    copy_mem(rom_buffer, rom_data, size);
    rom_size = size;
    rom_loaded = 1;
    
    return 1;
}

__attribute__((export_name("frame")))
void frame() {
    if (!initialized) return;
    render_frame();
}

__attribute__((export_name("getFrameBuffer")))
uint8_t* getFrameBuffer() {
    return frame_buffer;
}

__attribute__((export_name("getFrameBufferSize")))
int getFrameBufferSize() {
    return sizeof(frame_buffer);
}

__attribute__((export_name("reset")))
void reset() {
    controls = 0;
    frame_count = 0;
    clear_frame();
}

__attribute__((export_name("setButton")))
void setButton(int button, int pressed) {
    if (button < 0 || button > 7) return;
    
    uint32_t mask = 1 << button;
    if (pressed) {
        controls |= mask;
    } else {
        controls &= ~mask;
    }
}

__attribute__((export_name("setRunning")))
void setRunning(int running) {
}

__attribute__((export_name("getPalette")))
uint8_t* getPalette() {
    return nes_palette;
}

// NO main() function to avoid proc_exit import
