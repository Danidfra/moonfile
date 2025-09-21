// FCEUX WebAssembly Enhanced Stub Implementation
// This provides a functional interface that simulates FCEUX behavior
// until real FCEUX WebAssembly is available

class FCEUXWeb {
  constructor() {
    this.initialized = false;
    this.memory = null;
    this.exports = null;
    this.romLoaded = false;
    this.frameBuffer = new Uint8Array(256 * 240 * 3);
    this.audioBuffer = new Int16Array(1024);
    this.controls = new Array(8).fill(0);
    this.isRunning = false;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.audioSampleRate = 44100;
    this.audioPhase = 0;
  }

  async init() {
    console.log('[FCEUX Web] Initializing enhanced FCEUX WebAssembly stub');
    
    // Create a mock memory buffer
    this.memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
    
    // Mock exports that simulate FCEUX functionality
    this.exports = {
      memory: this.memory,
      init: () => {
        console.log('[FCEUX Web] init called');
        return true;
      },
      loadRom: (romData) => {
        console.log('[FCEUX Web] loadRom called with', romData.length, 'bytes');
        
        // Basic ROM validation
        if (romData.length < 16) {
          console.error('[FCEUX Web] ROM too small');
          return false;
        }
        
        // Check for NES header
        if (romData[0] !== 0x4E || romData[1] !== 0x45 || 
            romData[2] !== 0x53 || romData[3] !== 0x1A) {
          console.error('[FCEUX Web] Invalid NES header');
          return false;
        }
        
        this.romLoaded = true;
        console.log('[FCEUX Web] ROM validation passed, loaded successfully');
        return true;
      },
      frame: () => {
        if (this.romLoaded && this.isRunning) {
          this.generateFrame();
        }
      },
      reset: () => {
        console.log('[FCEUX Web] reset called');
        this.controls.fill(0);
        this.frameCount = 0;
        this.audioPhase = 0;
      },
      setButton: (buttonIndex, pressed) => {
        if (buttonIndex >= 0 && buttonIndex < this.controls.length) {
          this.controls[buttonIndex] = pressed ? 1 : 0;
        }
      },
      getFrameBuffer: () => this.frameBuffer,
      getAudioBuffer: () => this.audioBuffer,
      setRunning: (running) => {
        this.isRunning = running;
        if (running) {
          this.lastFrameTime = performance.now();
        }
      }
    };
    
    this.initialized = true;
    return this.exports;
  }

  generateFrame() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    this.frameCount++;
    
    // Generate a more sophisticated test pattern that responds to controls
    const time = currentTime * 0.001;
    
    for (let y = 0; y < 240; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 3;
        
        // Base pattern
        let r = 64, g = 64, b = 128;
        
        // Create animated background
        const wave1 = Math.sin(x * 0.05 + time) * 0.5 + 0.5;
        const wave2 = Math.sin(y * 0.05 + time * 1.3) * 0.5 + 0.5;
        
        // Apply controls to modify the pattern
        if (this.controls[3]) { // Up
          r = Math.max(0, r - 50);
        }
        if (this.controls[2]) { // Down
          r = Math.min(255, r + 50);
        }
        if (this.controls[1]) { // Left
          g = Math.max(0, g - 50);
        }
        if (this.controls[0]) { // Right
          g = Math.min(255, g + 50);
        }
        if (this.controls[7]) { // A button
          b = Math.min(255, b + 50);
        }
        if (this.controls[6]) { // B button
          b = Math.max(0, b - 50);
        }
        
        // Combine waves with control modifications
        r = Math.floor((wave1 * 128 + r * 0.5) % 256);
        g = Math.floor((wave2 * 128 + g * 0.5) % 256);
        b = Math.floor((128 + Math.sin(time * 2) * 64 + b * 0.3) % 256);
        
        this.frameBuffer[i] = r;
        this.frameBuffer[i + 1] = g;
        this.frameBuffer[i + 2] = b;
      }
    }
    
    // Generate audio buffer with NES-like sounds
    this.generateAudio(time);
  }

  generateAudio(time) {
    const sampleRate = this.audioSampleRate;
    const samplesPerFrame = this.audioBuffer.length / 2; // Stereo
    
    // Base frequencies for different channels
    const pulse1Freq = this.controls[7] ? 440 : 0; // A button
    const pulse2Freq = this.controls[6] ? 330 : 0; // B button
    const triangleFreq = this.controls[3] ? 220 : 0; // Up
    const noiseFreq = this.controls[2] ? 110 : 0;   // Down
    
    for (let i = 0; i < samplesPerFrame; i++) {
      const t = this.audioPhase / sampleRate;
      
      // Generate different waveforms for different channels
      let sample = 0;
      
      // Pulse waves (square waves)
      if (pulse1Freq > 0) {
        sample += Math.sin(t * pulse1Freq * Math.PI * 2) > 0 ? 0.1 : -0.1;
      }
      
      if (pulse2Freq > 0) {
        sample += Math.sin(t * pulse2Freq * Math.PI * 2 + Math.PI * 0.5) > 0 ? 0.1 : -0.1;
      }
      
      // Triangle wave
      if (triangleFreq > 0) {
        const trianglePhase = (t * triangleFreq) % 1;
        const triangleValue = trianglePhase < 0.5 ? trianglePhase * 4 - 1 : 3 - trianglePhase * 4;
        sample += triangleValue * 0.05;
      }
      
      // Noise (simple white noise)
      if (noiseFreq > 0) {
        sample += (Math.random() - 0.5) * 0.02;
      }
      
      // Apply envelope
      const envelope = Math.max(0, 1 - this.audioPhase / (sampleRate * 0.1));
      sample *= envelope;
      
      // Convert to 16-bit and write to buffer (stereo)
      const sample16 = Math.floor(sample * 32767 * 0.3); // Reduce volume
      this.audioBuffer[i * 2] = sample16;
      this.audioBuffer[i * 2 + 1] = sample16;
      
      this.audioPhase++;
    }
    
    // Reset audio phase periodically to prevent overflow
    if (this.audioPhase > sampleRate * 10) {
      this.audioPhase = 0;
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

// Global FCEUX instance
window.FCEUX = new FCEUXWeb();

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.FCEUX.init();
  });
} else {
  window.FCEUX.init();
}

console.log('[FCEUX Web] Enhanced stub implementation loaded');