// Fixed initializeEmulator function for EmulatorJSPlayer.tsx
// This snippet replaces the existing initializeEmulator function

const initializeEmulator = async () => {
  try {
    console.log('[EmulatorJSPlayer] 🎮 Initializing EmulatorJS for:', {
      mimeType,
      coreType,
      systemName,
      romDataLength: romData?.length || 0
    });

    // Check if we have a supported core
    if (!coreType) {
      throw new Error(`Unsupported ROM type: ${mimeType}. Please use a supported game format.`);
    }

    // Validate ROM data
    if (!romData || typeof romData !== 'string') {
      throw new Error('No ROM data provided');
    }

    // Convert base64 to binary data and create blob URL
    let gameUrl: string;
    try {
      // Remove data URL prefix if present
      const base64Data = romData.includes(',') ? romData.split(',')[1] : romData;
      const binaryString = atob(base64Data);
      const binaryData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        binaryData[i] = binaryString.charCodeAt(i);
      }
      
      // Create blob and URL
      const blob = new Blob([binaryData], { type: 'application/octet-stream' });
      gameUrl = URL.createObjectURL(blob);
      
      console.log('[EmulatorJSPlayer] ✅ ROM data converted and blob URL created:', {
        size: binaryData.length,
        url: gameUrl
      });
    } catch (decodeError) {
      throw new Error(`Failed to decode ROM data: ${decodeError instanceof Error ? decodeError.message : 'Invalid data'}`);
    }

    // Get container - it should be available immediately since we always render it
    const container = emulatorContainerRef.current;
    if (!container) {
      throw new Error('Emulator container not found');
    }

    console.log('[EmulatorJSPlayer:Container] ✅ Container ready', {
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight,
      className: container.className,
      containerId,
      timestamp: new Date().toISOString()
    });

    // Clean up any existing EmulatorJS globals
    const globalAny = globalThis as any;
    if (globalAny.EJS_emulator) {
      console.log('[EmulatorJSPlayer] 🧹 Cleaning up existing emulator instance');
      try {
        globalAny.EJS_emulator.destroy?.();
      } catch (e) {
        console.warn('[EmulatorJSPlayer] Warning during cleanup:', e);
      }
    }

    // Set up EmulatorJS global variables
    // CRITICAL: EJS_player must be a CSS selector string, not a DOM element
    globalAny.EJS_player = `#${containerId}`;
    globalAny.EJS_gameUrl = gameUrl;
    globalAny.EJS_core = coreType;
    globalAny.EJS_pathtodata = '/emulatorjs/data/';  // Fixed path to include /data/
    globalAny.EJS_startOnLoaded = true;
    globalAny.EJS_DEBUG_XX = false; // Disable debug mode for cleaner console

    // Use CDN for cores since local cores may not be available
    globalAny.EJS_pathtocore = 'https://cdn.emulatorjs.org/stable/data/cores/';

    // Optional EmulatorJS settings
    globalAny.EJS_gameID = title.replace(/[^a-zA-Z0-9]/g, '_');
    globalAny.EJS_gameName = title;
    globalAny.EJS_color = '#74b9ff';
    globalAny.EJS_VirtualGamepadSettings = {
      enable: true,
      opacity: 0.7
    };

    // BIOS settings - use CDN for BIOS files too
    globalAny.EJS_pathtobios = 'https://cdn.emulatorjs.org/stable/data/bios/';

    console.log('[EmulatorJSPlayer] ⚙️ EmulatorJS globals configured:', {
      core: coreType,
      gameUrl,
      pathtodata: globalAny.EJS_pathtodata,
      gameID: globalAny.EJS_gameID,
      player: globalAny.EJS_player,
      containerId
    });

    // Load EmulatorJS loader script
    const loadEmulatorJS = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if script is already loaded
        const existingScript = document.querySelector('script[src="/emulatorjs/data/loader.js"]');
        if (existingScript) {
          console.log('[EmulatorJSPlayer] ♻️ EmulatorJS script already loaded, reinitializing...');
          
          // Try to reinitialize with existing script
          if (globalAny.EJS_emulator) {
            resolve();
            return;
          }
        }

        console.log('[EmulatorJSPlayer] 📥 Loading EmulatorJS loader script...');
        
        const script = document.createElement('script');
        script.src = '/emulatorjs/data/loader.js';
        script.async = true;
        
        script.onload = () => {
          console.log('[EmulatorJSPlayer] ✅ EmulatorJS loader script loaded successfully');
          resolve();
        };
        
        script.onerror = (error) => {
          console.error('[EmulatorJSPlayer] ❌ Failed to load EmulatorJS loader script:', error);
          reject(new Error('Failed to load EmulatorJS loader script. Make sure the files are available at /emulatorjs/data/'));
        };
        
        document.head.appendChild(script);
      });
    };

    await loadEmulatorJS();

    // Wait for emulator to initialize
    const waitForEmulator = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds timeout
        
        const checkEmulator = () => {
          attempts++;
          
          if (globalAny.EJS_emulator) {
            console.log('[EmulatorJSPlayer] ✅ EmulatorJS instance found:', globalAny.EJS_emulator);
            resolve(globalAny.EJS_emulator);
            return;
          }
          
          if (attempts >= maxAttempts) {
            reject(new Error('Timeout waiting for EmulatorJS to initialize'));
            return;
          }
          
          setTimeout(checkEmulator, 100);
        };
        
        checkEmulator();
      });
    };

    const emulator = await waitForEmulator();

    // Store the emulator instance for controls
    setEmulatorInstance({
      pause: () => {
        console.log('[EmulatorJSPlayer] ⏸️ Pausing emulator');
        emulator.pause?.();
      },
      resume: () => {
        console.log('[EmulatorJSPlayer] ▶️ Resuming emulator');
        emulator.resume?.();
      },
      restart: () => {
        console.log('[EmulatorJSPlayer] 🔄 Restarting emulator');
        emulator.restart?.();
      },
      setVolume: (vol: number) => {
        console.log('[EmulatorJSPlayer] 🔊 Setting volume to:', vol);
        emulator.setVolume?.(vol);
      },
      destroy: () => {
        console.log('[EmulatorJSPlayer] 🧹 Destroying emulator');
        try {
          emulator.destroy?.();
          URL.revokeObjectURL(gameUrl); // Clean up blob URL
          // Clean up globals
          delete globalAny.EJS_player;
          delete globalAny.EJS_gameUrl;
          delete globalAny.EJS_core;
          delete globalAny.EJS_emulator;
        } catch (e) {
          console.warn('[EmulatorJSPlayer] Warning during destroy:', e);
        }
      },
      _gameUrl: gameUrl, // Store for cleanup
      _emulator: emulator // Store reference
    });

    // Try to find the canvas element for streaming - EmulatorJS creates it dynamically
    const findCanvas = () => {
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        console.log('[EmulatorJSPlayer] 🎥 Canvas element found for streaming:', {
          width: canvas.width,
          height: canvas.height,
          className: canvas.className
        });
        setCanvasElement(canvas);
        
        // Hide the loading indicator once canvas is found
        const loadingIndicator = container.querySelector('.emulatorjs-loading-indicator') as HTMLElement;
        if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
        }
        
        return true;
      }
      return false;
    };

    // Try to find canvas immediately and then poll
    if (!findCanvas()) {
      const pollInterval = setInterval(() => {
        if (findCanvas()) {
          clearInterval(pollInterval);
        }
      }, 500);
      
      // Stop polling after 30 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        console.warn('[EmulatorJSPlayer] ⚠️ Canvas element not found after 30 seconds');
      }, 30000);
    }

    setIsReady(true);
    setError(null);
    isInitializedRef.current = true;

    console.log('[EmulatorJSPlayer] ✅ EmulatorJS initialized successfully');

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to initialize emulator';
    console.error('[EmulatorJSPlayer] ❌ Initialization error:', errorMessage);
    setError(errorMessage);
    setIsReady(false);
  }
};