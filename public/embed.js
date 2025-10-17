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

  // Set EmulatorJS configuration for 4-player support
  window.EJS_gameName = gameId;
  window.EJS_gameID = gameId;
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_gameUrl = url;
  window.EJS_core = core;
  window.EJS_startOnLoaded = startOnLoaded;
  window.EJS_mute = mute;
  window.EJS_volume = mute ? 0 : volume;
  window.EJS_player = '#game';

  // Configure 4-player support
  window.EJS_joypadType = ['standard', 'standard', 'standard', 'standard'];

  // Default controls for 4 players (P1 exactly as provided, P2-P4 added)
  window.EJS_defaultControls = {
    0: {
      0: { 'value': 'x',          'value2': 'BUTTON_2' },
      1: { 'value': 's',          'value2': 'BUTTON_4' },
      2: { 'value': 'v',          'value2': 'SELECT' },
      3: { 'value': 'enter',      'value2': 'START' },
      4: { 'value': 'up arrow',   'value2': 'DPAD_UP' },
      5: { 'value': 'down arrow', 'value2': 'DPAD_DOWN' },
      6: { 'value': 'left arrow', 'value2': 'DPAD_LEFT' },
      7: { 'value': 'right arrow','value2': 'DPAD_RIGHT' },
      8: { 'value': 'z',          'value2': 'BUTTON_1' },
      9: { 'value': 'a',          'value2': 'BUTTON_3' },
      10:{ 'value': 'q',          'value2': 'LEFT_TOP_SHOULDER' },
      11:{ 'value': 'e',          'value2': 'RIGHT_TOP_SHOULDER' },
      12:{ 'value': 'tab',        'value2': 'LEFT_BOTTOM_SHOULDER' },
      13:{ 'value': 'r',          'value2': 'RIGHT_BOTTOM_SHOULDER' },
      14:{ 'value': '',           'value2': 'LEFT_STICK' },
      15:{ 'value': '',           'value2': 'RIGHT_STICK' },
      16:{ 'value': 'h',          'value2': 'LEFT_STICK_X:+1' },
      17:{ 'value': 'f',          'value2': 'LEFT_STICK_X:-1' },
      18:{ 'value': 'g',          'value2': 'LEFT_STICK_Y:+1' },
      19:{ 'value': 't',          'value2': 'LEFT_STICK_Y:-1' },
      20:{ 'value': 'l',          'value2': 'RIGHT_STICK_X:+1' },
      21:{ 'value': 'j',          'value2': 'RIGHT_STICK_X:-1' },
      22:{ 'value': 'k',          'value2': 'RIGHT_STICK_Y:+1' },
      23:{ 'value': 'i',          'value2': 'RIGHT_STICK_Y:-1' },
      24:{ 'value': '1' },
      25:{ 'value': '2' },
      26:{ 'value': '3' },
      27:{ 'value': 'add' },
      28:{ 'value': 'space' },
      29:{ 'value': 'subtract' },
    },
    // Player 2: IJKL d-pad, M/N face buttons, O=Select, P=Start
    1: {
      0:  { value:'n',         value2:'BUTTON_2' },
      1:  { value:',',         value2:'BUTTON_4' },
      2:  { value:'o',         value2:'SELECT' },
      3:  { value:'p',         value2:'START' },
      4:  { value:'i',         value2:'DPAD_UP' },
      5:  { value:'k',         value2:'DPAD_DOWN' },
      6:  { value:'j',         value2:'DPAD_LEFT' },
      7:  { value:'l',         value2:'DPAD_RIGHT' },
      8:  { value:'m',         value2:'BUTTON_1' },
      9:  { value:'.',         value2:'BUTTON_3' },
      10: { value:'',          value2:'LEFT_TOP_SHOULDER' },
      11: { value:'',          value2:'RIGHT_TOP_SHOULDER' },
      12: { value:'',          value2:'LEFT_BOTTOM_SHOULDER' },
      13: { value:'',          value2:'RIGHT_BOTTOM_SHOULDER' },
      14: { value:'',          value2:'LEFT_STICK' },
      15: { value:'',          value2:'RIGHT_STICK' },
      16: { value:'',          value2:'LEFT_STICK_X:+1' },
      17: { value:'',          value2:'LEFT_STICK_X:-1' },
      18: { value:'',          value2:'LEFT_STICK_Y:+1' },
      19: { value:'',          value2:'LEFT_STICK_Y:-1' },
      20: { value:'',          value2:'RIGHT_STICK_X:+1' },
      21: { value:'',          value2:'RIGHT_STICK_X:-1' },
      22: { value:'',          value2:'RIGHT_STICK_Y:+1' },
      23: { value:'',          value2:'RIGHT_STICK_Y:-1' },
      24: { value:'', },
      25: { value:'', },
      26: { value:'', },
      27: { value:'', },
      28: { value:'', },
      29: { value:'', },
    },
    // Player 3: T/G/F/H d-pad, Y/U face buttons, [=Select, ]=Start, V/B as extra buttons
    2: {
      0:  { value:'u',         value2:'BUTTON_2' },
      1:  { value:'b',         value2:'BUTTON_4' },
      2:  { value:'[',         value2:'SELECT' },
      3:  { value:']',         value2:'START' },
      4:  { value:'t',         value2:'DPAD_UP' },
      5:  { value:'g',         value2:'DPAD_DOWN' },
      6:  { value:'f',         value2:'DPAD_LEFT' },
      7:  { value:'h',         value2:'DPAD_RIGHT' },
      8:  { value:'y',         value2:'BUTTON_1' },
      9:  { value:'v',         value2:'BUTTON_3' },
      10: { value:'',          value2:'LEFT_TOP_SHOULDER' },
      11: { value:'',          value2:'RIGHT_TOP_SHOULDER' },
      12: { value:'',          value2:'LEFT_BOTTOM_SHOULDER' },
      13: { value:'',          value2:'RIGHT_BOTTOM_SHOULDER' },
      14: { value:'',          value2:'LEFT_STICK' },
      15: { value:'',          value2:'RIGHT_STICK' },
      16: { value:'',          value2:'LEFT_STICK_X:+1' },
      17: { value:'',          value2:'LEFT_STICK_X:-1' },
      18: { value:'',          value2:'LEFT_STICK_Y:+1' },
      19: { value:'',          value2:'LEFT_STICK_Y:-1' },
      20: { value:'',          value2:'RIGHT_STICK_X:+1' },
      21: { value:'',          value2:'RIGHT_STICK_X:-1' },
      22: { value:'',          value2:'RIGHT_STICK_Y:+1' },
      23: { value:'',          value2:'RIGHT_STICK_Y:-1' },
      24: { value:'', },
      25: { value:'', },
      26: { value:'', },
      27: { value:'', },
      28: { value:'', },
      29: { value:'', },
    },
    // Player 4: Numpad cluster
    3: {
      0:  { value:'numpad2',      value2:'BUTTON_2' },
      1:  { value:'numpad3',      value2:'BUTTON_4' },
      2:  { value:'numpad0',      value2:'SELECT' },
      3:  { value:'numpadenter',  value2:'START' },
      4:  { value:'numpad8',      value2:'DPAD_UP' },
      5:  { value:'numpad5',      value2:'DPAD_DOWN' },
      6:  { value:'numpad4',      value2:'DPAD_LEFT' },
      7:  { value:'numpad6',      value2:'DPAD_RIGHT' },
      8:  { value:'numpad1',      value2:'BUTTON_1' },
      9:  { value:'numpad7',      value2:'BUTTON_3' },
      10: { value:'',             value2:'LEFT_TOP_SHOULDER' },
      11: { value:'',             value2:'RIGHT_TOP_SHOULDER' },
      12: { value:'',             value2:'LEFT_BOTTOM_SHOULDER' },
      13: { value:'',             value2:'RIGHT_BOTTOM_SHOULDER' },
      14: { value:'',             value2:'LEFT_STICK' },
      15: { value:'',             value2:'RIGHT_STICK' },
      16: { value:'',             value2:'LEFT_STICK_X:+1' },
      17: { value:'',             value2:'LEFT_STICK_X:-1' },
      18: { value:'',             value2:'LEFT_STICK_Y:+1' },
      19: { value:'',             value2:'LEFT_STICK_Y:-1' },
      20: { value:'',             value2:'RIGHT_STICK_X:+1' },
      21: { value:'',             value2:'RIGHT_STICK_X:-1' },
      22: { value:'',             value2:'RIGHT_STICK_Y:+1' },
      23: { value:'',             value2:'RIGHT_STICK_Y:-1' },
      24: { value:'', },
      25: { value:'', },
      26: { value:'', },
      27: { value:'', },
      28: { value:'', },
      29: { value:'', },
    }
  };

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