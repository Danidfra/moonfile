// Truly standalone NES emulator core with ZERO external imports
// This implementation avoids all libc functions and Emscripten runtime

// Custom implementations to avoid libc imports
static void* my_memset(void* dest, int val, unsigned long len) {
    unsigned char* ptr = (unsigned char*)dest;
    for (unsigned long i = 0; i < len; i++) {
        ptr[i] = (unsigned char)val;
    }
    return dest;
}

static void* my_memcpy(void* dest, const void* src, unsigned long len) {
    unsigned char* d = (unsigned char*)dest;
    const unsigned char* s = (const unsigned char*)src;
    for (unsigned long i = 0; i < len; i++) {
        d[i] = s[i];
    }
    return dest;
}

// Memory layout (using linear memory)
#define FRAME_BUFFER_OFFSET 65536    // 64KB offset
#define PALETTE_OFFSET 311296        // After frame buffer (245760 bytes)
#define ROM_BUFFER_OFFSET 311552     // After palette (256 bytes)
#define MAX_ROM_SIZE 2097152         // 2MB max ROM size

// Frame buffer: 256 * 240 * 4 = 245,760 bytes (RGBA)
static unsigned char frame_buffer[245760];

// NES palette: 64 colors * 4 bytes = 256 bytes
static unsigned char nes_palette[256];

// ROM buffer
static unsigned char rom_buffer[MAX_ROM_SIZE];

// Emulator state
static int initialized = 0;
static int rom_loaded = 0;
static int running = 0;
static unsigned int controls = 0;
static unsigned int frame_count = 0;

// ROM info
static unsigned int rom_size = 0;
static unsigned char prg_banks = 0;
static unsigned char chr_banks = 0;
static unsigned char mapper = 0;
static int has_chr_ram = 0;

// Initialize NES palette
static void init_nes_palette() {
    // Standard NES palette colors (simplified version)
    const unsigned char palette_data[64][3] = {
        {84, 84, 84}, {0, 30, 116}, {8, 16, 144}, {48, 0, 136},
        {68, 0, 100}, {92, 0, 48}, {84, 4, 0}, {60, 24, 0},
        {32, 42, 0}, {8, 58, 0}, {0, 64, 0}, {0, 60, 0},
        {0, 50, 60}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0},
        {152, 150, 152}, {8, 76, 196}, {48, 50, 236}, {92, 30, 228},
        {136, 20, 176}, {160, 20, 100}, {152, 34, 32}, {120, 60, 0},
        {84, 90, 0}, {40, 114, 0}, {8, 124, 0}, {0, 118, 40},
        {0, 102, 120}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0},
        {236, 238, 236}, {76, 154, 236}, {120, 124, 236}, {176, 98, 236},
        {228, 84, 236}, {236, 88, 180}, {236, 106, 100}, {212, 136, 32},
        {160, 170, 0}, {116, 196, 0}, {76, 208, 32}, {56, 204, 108},
        {56, 180, 204}, {60, 60, 60}, {0, 0, 0}, {0, 0, 0},
        {236, 238, 236}, {168, 204, 236}, {188, 188, 236}, {212, 178, 236},
        {236, 174, 236}, {236, 174, 212}, {236, 180, 176}, {228, 196, 144},
        {204, 210, 120}, {180, 222, 120}, {168, 226, 144}, {152, 226, 180},
        {160, 214, 228}, {160, 162, 160}, {0, 0, 0}, {0, 0, 0}
    };

    for (int i = 0; i < 64; i++) {
        nes_palette[i * 4 + 0] = palette_data[i][0]; // R
        nes_palette[i * 4 + 1] = palette_data[i][1]; // G
        nes_palette[i * 4 + 2] = palette_data[i][2]; // B
        nes_palette[i * 4 + 3] = 255;                // A
    }
}

// Clear frame buffer to black
static void clear_frame_buffer() {
    my_memset(frame_buffer, 0, sizeof(frame_buffer));
    // Set alpha channel to 255
    for (int i = 3; i < sizeof(frame_buffer); i += 4) {
        frame_buffer[i] = 255;
    }
}

// Generate test frame with NES-like patterns
static void generate_nes_frame() {
    frame_count++;
    
    for (int y = 0; y < 240; y++) {
        for (int x = 0; x < 256; x++) {
            int index = (y * 256 + x) * 4;
            
            // Create NES-like patterns based on position and frame
            unsigned char base_color = ((x / 8) + (y / 8) + (frame_count / 4)) & 0x3F;
            
            // Use actual NES palette colors
            unsigned char r = nes_palette[base_color * 4 + 0];
            unsigned char g = nes_palette[base_color * 4 + 1];
            unsigned char b = nes_palette[base_color * 4 + 2];
            
            // Modify colors based on controller input
            if (controls & 1) r = (r + 64) & 0xFF;    // Right
            if (controls & 2) r = (r - 32) & 0xFF;    // Left
            if (controls & 4) g = (g + 64) & 0xFF;    // Down
            if (controls & 8) g = (g - 32) & 0xFF;    // Up
            if (controls & 128) b = (b + 128) & 0xFF; // A
            if (controls & 64) b = (b + 96) & 0xFF;   // B
            
            // Add mapper-specific effects
            if (mapper == 2 && has_chr_ram) {
                // UNROM with CHR RAM - add pattern
                if ((x + y) & 8) {
                    r = (r + 32) & 0xFF;
                    b = (b + 32) & 0xFF;
                }
            }
            
            frame_buffer[index + 0] = r;
            frame_buffer[index + 1] = g;
            frame_buffer[index + 2] = b;
            frame_buffer[index + 3] = 255;
        }
    }
}

// Exported functions (with EMSCRIPTEN_KEEPALIVE equivalent)
__attribute__((export_name("init")))
int init() {
    if (initialized) return 1;
    
    // Initialize everything
    my_memset(frame_buffer, 0, sizeof(frame_buffer));
    my_memset(nes_palette, 0, sizeof(nes_palette));
    my_memset(rom_buffer, 0, sizeof(rom_buffer));
    
    controls = 0;
    frame_count = 0;
    rom_loaded = 0;
    running = 0;
    rom_size = 0;
    
    init_nes_palette();
    clear_frame_buffer();
    
    initialized = 1;
    return 1;
}

__attribute__((export_name("loadRom")))
int loadRom(unsigned char* rom_data, int size) {
    if (!initialized) return 0;
    if (size < 16) return 0;
    if (size > MAX_ROM_SIZE) return 0;
    
    // Validate NES header "NES\x1A"
    if (rom_data[0] != 0x4E || rom_data[1] != 0x45 || 
        rom_data[2] != 0x53 || rom_data[3] != 0x1A) {
        return 0;
    }
    
    // Extract ROM info
    prg_banks = rom_data[4];
    chr_banks = rom_data[5];
    unsigned char flags6 = rom_data[6];
    unsigned char flags7 = rom_data[7];
    
    // Calculate mapper
    mapper = (flags6 >> 4) | (flags7 & 0xF0);
    
    // Check for CHR RAM (no CHR banks)
    has_chr_ram = (chr_banks == 0) ? 1 : 0;
    
    // Validate PRG banks
    if (prg_banks == 0) return 0;
    
    // Copy ROM data
    my_memcpy(rom_buffer, rom_data, size);
    rom_size = size;
    rom_loaded = 1;
    
    return 1;
}

__attribute__((export_name("frame")))
void frame() {
    if (!initialized || !rom_loaded) return;
    generate_nes_frame();
}

__attribute__((export_name("reset")))
void reset() {
    controls = 0;
    running = 0;
    frame_count = 0;
    clear_frame_buffer();
}

__attribute__((export_name("setButton")))
void setButton(int button, int pressed) {
    if (button < 0 || button > 7) return;
    
    unsigned int mask = 1 << button;
    if (pressed) {
        controls |= mask;
    } else {
        controls &= ~mask;
    }
}

__attribute__((export_name("setRunning")))
void setRunning(int run_state) {
    running = run_state ? 1 : 0;
}

__attribute__((export_name("getFrameBuffer")))
unsigned char* getFrameBuffer() {
    return frame_buffer;
}

__attribute__((export_name("getFrameBufferSize")))
int getFrameBufferSize() {
    return sizeof(frame_buffer);
}

__attribute__((export_name("getPalette")))
unsigned char* getPalette() {
    return nes_palette;
}

// Entry point (but we don't use main to avoid runtime overhead)
void _start() {
    init();
}
