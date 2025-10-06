// EmulatorJS initialization helper
// This file helps initialize EmulatorJS without inline scripts

window.initEmulatorJS = function(config) {
  // Set global EmulatorJS configuration
  window.EJS_player = config.player;
  window.EJS_gameName = config.gameName;
  window.EJS_biosUrl = config.biosUrl || "";
  window.EJS_gameUrl = config.gameUrl;
  window.EJS_core = config.core;
  window.EJS_pathtodata = config.pathtodata || "/emulatorjs/";
  window.EJS_startOnLoaded = config.startOnLoaded !== false;
  window.EJS_DEBUG_XX = config.debug || false;
  window.EJS_disableDatabases = config.disableDatabases !== false;
  window.EJS_threads = config.threads || false;
  
  console.log('[EmulatorJS Init] Configuration set:', {
    player: config.player,
    core: config.core,
    gameName: config.gameName
  });
  
  return true;
};