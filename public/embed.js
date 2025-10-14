(function() {
  'use strict';

  console.log('[EmulatorJS Embed] Starting initialization');

  const params = new URLSearchParams(window.location.search);
  const core = params.get('core');
  const url = params.get('url');
  const mute = params.get('mute') === '1';
  const volume = parseFloat(params.get('volume') || '0.5');
  const startOnLoaded = params.get('startOnLoaded') === '1';

  console.log('[EmulatorJS Embed] Query params:', { core, url, mute, volume, startOnLoaded });

  if (!core || !url) {
    const error = 'Missing required parameters: core and url';
    console.error('[EmulatorJS Embed]', error);
    document.getElementById('game').innerHTML = `<div class="error">Error: ${error}</div>`;
    window.parent.postMessage({ type: 'ejs:error', message: error }, window.location.origin);
    return;
  }

  // Generate unique game ID
  const gameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  console.log('[EmulatorJS Embed] Generated game ID:', gameId);

  // Set minimal EmulatorJS configuration
  window.EJS_gameID = gameId;
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_gameUrl = url;
  window.EJS_core = core;
  window.EJS_startOnLoaded = startOnLoaded;
  window.EJS_mute = mute;
  window.EJS_volume = mute ? 0 : volume;
  window.EJS_player = '#game';

  console.log('[EmulatorJS Embed] Configuration set:', {
    EJS_gameID: window.EJS_gameID,
    EJS_core: window.EJS_core,
    EJS_gameUrl: window.EJS_gameUrl,
    EJS_mute: window.EJS_mute,
    EJS_volume: window.EJS_volume
  });

  // Canvas detection with timeout
  let canvasFound = false;
  let detectionAttempts = 0;
  const maxAttempts = 200; // 10 seconds at 50ms intervals
  const detectionInterval = 50;

  function detectCanvas() {
    detectionAttempts++;

    const canvas = document.querySelector('canvas');
    if (canvas && !canvasFound) {
      // Check if canvas has valid dimensions
      const rect = canvas.getBoundingClientRect();
      const hasValidSize = rect.width > 2 && rect.height > 2;

      console.log('[EmulatorJS Embed] Canvas detection attempt', detectionAttempts, {
        found: !!canvas,
        width: rect.width,
        height: rect.height,
        hasValidSize
      });

      if (hasValidSize) {
        canvasFound = true;
        console.log('[EmulatorJS Embed] Canvas ready, sending ready signal');

        window.parent.postMessage({
          type: 'ejs:ready',
          width: rect.width,
          height: rect.height,
          dpr: window.devicePixelRatio || 1
        }, window.location.origin);

        return;
      }
    }

    if (detectionAttempts >= maxAttempts) {
      const errorMsg = 'Canvas detection timeout - emulator failed to initialize';
      console.error('[EmulatorJS Embed]', errorMsg);
      document.getElementById('game').innerHTML = `<div class="error">${errorMsg}</div>`;
      window.parent.postMessage({ type: 'ejs:error', message: errorMsg }, window.location.origin);
      return;
    }

    // Continue polling
    setTimeout(detectCanvas, detectionInterval);
  }

  // Optional: Double-click fullscreen support
  document.addEventListener('dblclick', function() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('[EmulatorJS Embed] Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.warn('[EmulatorJS Embed] Fullscreen exit failed:', err);
      });
    }
  });

  // Load EmulatorJS script
  console.log('[EmulatorJS Embed] Loading EmulatorJS script');
  const script = document.createElement('script');
  script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
  script.async = true;

  script.onload = function() {
    console.log('[EmulatorJS Embed] EmulatorJS script loaded, starting canvas detection');
    // Start canvas detection after script loads
    setTimeout(detectCanvas, 100);
  };

  script.onerror = function() {
    const errorMsg = 'Failed to load EmulatorJS script';
    console.error('[EmulatorJS Embed]', errorMsg);
    document.getElementById('game').innerHTML = `<div class="error">${errorMsg}</div>`;
    window.parent.postMessage({ type: 'ejs:error', message: errorMsg }, window.location.origin);
  };

  document.head.appendChild(script);

  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin) return;
    const data = e.data || {};
    try {
      if (data.type === 'ejs:set-mute') {
        const muted = !!data.muted;
        const vol = typeof data.volume === 'number' ? data.volume : (muted ? 0 : 0.5);
        window.EJS_mute = muted;
        if (window.EJS_emulator && typeof window.EJS_emulator.setVolume === 'function') {
          window.EJS_emulator.setVolume(vol);
        }
        } else if (data.type === 'ejs:pause') {
          if (window.EJS_emulator && typeof window.EJS_emulator.pause === 'function') {
            window.EJS_emulator.pause(true);
          }
        } else if (data.type === 'ejs:resume') {
          if (window.EJS_emulator && typeof window.EJS_emulator.pause === 'function') {
            window.EJS_emulator.pause(false);
          }
      } else if (data.type === 'ejs:reset') {
        if (window.EJS_emulator && typeof window.EJS_emulator.restart === 'function') {
          window.EJS_emulator.restart();
        }
      } else if (data.type === 'remote-input') {
        // Handle remote input from multiplayer guests
        const input = data.payload;
        if (input && typeof input.key === 'string' && typeof input.pressed === 'boolean') {
          console.log('[EmulatorJS Embed] Received remote input:', input);

          // Map input to emulator controls
          if (window.EJS_emulator && window.EJS_emulator.controls) {
            const key = input.key.toLowerCase();
            const player = 1; // Default to player 1

            // NES controller key mapping
            const keyMap = {
              'a': 'a',
              'b': 'b',
              'x': 'x',
              'y': 'y',
              'select': 'select',
              'start': 'start',
              'arrowup': 'up',
              'arrowdown': 'down',
              'arrowleft': 'left',
              'arrowright': 'right',
              'up': 'up',
              'down': 'down',
              'left': 'left',
              'right': 'right'
            };

            const mappedKey = keyMap[key];
            if (mappedKey) {
              if (input.pressed) {
                window.EJS_emulator.controls.pressKey(player, mappedKey);
              } else {
                window.EJS_emulator.controls.releaseKey(player, mappedKey);
              }
            }
          }
        }
      }
    } catch (_) {}
  });

})();